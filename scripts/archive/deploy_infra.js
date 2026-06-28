const { ethers } = require("hardhat");
const parseUnits = ethers.utils.parseUnits;
const deployedConfig = require("../sandbox/config/deployed.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🚀 Deploying infrastructure contracts as ${deployer.address}\n`);

  const AG_TOKEN = deployedConfig.contracts.AgToken;
  const AU_TOKEN = deployedConfig.contracts.AuToken;
  const LP_NFT  = deployedConfig.contracts.QuasiCrystalLPNFT;

  console.log(`  AgToken: ${AG_TOKEN}`);
  console.log(`  AuToken: ${AU_TOKEN}`);
  console.log(`  LP NFT:  ${LP_NFT}\n`);

  // ── 1. AvOracle ─────────────────────────────────────────────────────────
  console.log("📡 Deploying AvOracle...");
  const AvOracle = await ethers.getContractFactory("AvOracle");
  const oracle = await AvOracle.deploy(
    AU_TOKEN,       // auToken
    AG_TOKEN,       // agToken
    deployer.address, // admin
    deployer.address,  // governor
    { gasLimit: 5000000, type: 2 }
  );
  const oracleReceipt = await oracle.deployTransaction.wait();
  const oracleAddr = oracleReceipt.contractAddress;
  console.log(`  ✅ AvOracle: ${oracleAddr}`);

  // ── 2. AVLPStaking_v2 (UUPS) — must deploy before PID ────────────────────
  console.log("🥩 Deploying AVLPStaking_v2...");
  const StakingImpl = await ethers.getContractFactory("AVLPStaking_v2");
  const stakingImpl = await StakingImpl.deploy({ gasLimit: 5000000, type: 2 });
  const implReceipt = await stakingImpl.deployTransaction.wait();
  const stakingImplAddr = implReceipt.contractAddress;
  console.log(`  ✅ Impl deployed: ${stakingImplAddr}`);

  // Deploy proxy without init data (ProxyHelper allows uninitialized), then initialize
  const ProxyHelper = await ethers.getContractFactory("ProxyHelper");
  const stakingProxy = await ProxyHelper.deploy(stakingImplAddr, "0x", { gasLimit: 500000, type: 2 });
  const proxyReceipt = await stakingProxy.deployTransaction.wait();
  const stakingAddr = proxyReceipt.contractAddress;
  console.log(`  ✅ Staking Proxy: ${stakingAddr}`);
  console.log(`  ✅ Staking Impl:  ${stakingImplAddr}`);

  // Initialize staking via separate call with explicit gas limit
  const staking = await ethers.getContractAt("AVLPStaking_v2", stakingAddr);
  console.log("  🔧 Initializing staking...");
  const initTx = await staking.initialize(
    AU_TOKEN,   // auToken
    AG_TOKEN,   // agToken
    LP_NFT,     // lpNFT
    { gasLimit: 300000 }
  );
  await initTx.wait();
  const storedAu = await staking.auToken();
  console.log(`  ✅ Staking initialized (auToken: ${storedAu})`);

  // Grant deployer admin roles
  const DEFAULT_ADMIN_ROLE = ethers.utils.id("DEFAULT_ADMIN_ROLE");
  await staking.grantRole(DEFAULT_ADMIN_ROLE, deployer.address, { gasLimit: 100000 });
  await staking.grantRole(ethers.utils.id("ADMIN_ROLE"), deployer.address, { gasLimit: 100000 });
  console.log(`  ✅ Deployer granted admin roles on staking`);

  // ── 3. PID_Emission_Controller_v2 ───────────────────────────────────────
  console.log("🎛️  Deploying PID_Emission_Controller_v2...");
  const PID = await ethers.getContractFactory("PID_Emission_Controller_v2");
  const pid = await PID.deploy(
    deployer.address,              // admin (gets DEFAULT_ADMIN, PARAM, EMIT roles)
    stakingAddr,                   // staking
    AG_TOKEN,                      // agToken
    parseUnits("10000000", 18),    // targetTVL
    BigInt("750000000000000"),     // kp (7.5e14, within [1e12, 1e18])
    BigInt("1000000000000"),       // ki (1e12, minimum allowed)
    BigInt("1500000000000000"),    // kd (1.5e15, within [1e12, 1e18])
    { gasLimit: 5000000, type: 2 }
  );
  const pidReceipt = await pid.deployTransaction.wait();
  const pidAddr = pidReceipt.contractAddress;
  console.log(`  ✅ PID+Emissions: ${pidAddr}`);

  // ── 4. TreasuryAMO ──────────────────────────────────────────────────────
  console.log("🏦 Deploying TreasuryAMO...");
  const TreasuryAMO = await ethers.getContractFactory("TreasuryAMO");
  const amo = await TreasuryAMO.deploy(
    AU_TOKEN,           // auToken
    AG_TOKEN,           // reserveToken
    deployer.address,   // aerodromeRouter (placeholder)
    deployer.address,   // admin
    { gasLimit: 3000000, type: 2 }
  );
  const amoReceipt = await amo.deployTransaction.wait();
  const amoAddr = amoReceipt.contractAddress;
  console.log(`  ✅ TreasuryAMO: ${amoAddr}`);

  // ── 5. Wiring ───────────────────────────────────────────────────────────
  console.log("\n🔗 Wiring contracts...");

  // PID → grant EMIT_ROLE to staking
  console.log("  → PID grant EMIT_ROLE to staking");
  const EMIT_ROLE = ethers.utils.id("EMIT_ROLE");
  await pid.grantRole(EMIT_ROLE, stakingAddr, { gasLimit: 100000 });

  // PID → grant PARAM_ROLE to deployer (governor)
  console.log("  → PID grant PARAM_ROLE to deployer");
  const PARAM_ROLE = ethers.utils.id("PARAM_ROLE");
  await pid.grantRole(PARAM_ROLE, deployer.address, { gasLimit: 100000 });

  // AgToken → grant MINTER_ROLE to PID
  console.log("  → AgToken.grantRole(MINTER_ROLE, PID)");
  const ag = await ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", AG_TOKEN);
  const MINTER_ROLE = ethers.utils.id("MINTER_ROLE");
  await ag.grantRole(MINTER_ROLE, pidAddr, { gasLimit: 100000 });

  // AuToken → grant MINTER_ROLE to AMO
  console.log("  → AuToken.grantRole(MINTER_ROLE, AMO)");
  const au = await ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", AU_TOKEN);
  await au.grantRole(MINTER_ROLE, amoAddr, { gasLimit: 100000 });

  // PID → unpause
  console.log("  → PID.unpause");
  try {
    await pid.unpause();
  } catch(e) {
    console.log("    (not paused or already unpaused)");
  }

  // ── 6. Save addresses ───────────────────────────────────────────────────
  const fs = require("fs");
  const deployedPath = __dirname + "/../sandbox/config/deployed.json";
  const deployedFinal = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));

  deployedFinal.contracts.AvOracle = oracleAddr;
  deployedFinal.contracts.PIDController = pidAddr;
  deployedFinal.contracts.TreasuryAMO = amoAddr;
  deployedFinal.contracts.Staking = stakingAddr;
  deployedFinal.contracts.StakingImpl = stakingImplAddr;
  deployedFinal.lastUpdated = new Date().toISOString();

  fs.writeFileSync(deployedPath, JSON.stringify(deployedFinal, null, 2));
  console.log(`\n📝 Addresses saved to ${deployedPath}`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  INFRASTRUCTURE DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  AvOracle:     ${oracleAddr}`);
  console.log(`  Staking:      ${stakingAddr}`);
  console.log(`  StakingImpl:  ${stakingImplAddr}`);
  console.log(`  PID+Emissions:${pidAddr}`);
  console.log(`  TreasuryAMO:  ${amoAddr}`);
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
