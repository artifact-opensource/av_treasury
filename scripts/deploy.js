/**
 * AV Treasury v3.1 — Mainnet Deployment Script (Base Network)
 * 
 * Deployment Order:
 * 1. AgToken (ARTIFACT) — ERC20 governance token
 * 2. AuToken (Artifact Utility) — ERC20 utility token
 * 3. ArtifactTimelock — Timelock controller for governance
 * 4. GovernorContract — DAO governance (2 params: token, executor)
 * 5. AVLPStaking_v2 — LP staking with 2.5x multiplier (BEFORE PID — PID needs staking)
 * 6. PID_Emission_Controller_v2 — Emission controller with dynamic cap (7 params)
 * 7. TreasuryAMO — Automated Market Operations (4 params: auToken, reserve, router, admin)
 * 8. Configure: Grant roles, set controllers, transfer ownership
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network base
 *   npx hardhat run scripts/deploy.js --network base_sepolia
 * 
 * Environment variables required (see .env):
 *   PRIVATE_KEY_BASE — Deployer private key
 *   RPC_URL_BASE — Base mainnet RPC
 *   DEVELOPER_WALLET_ADDRESS — Admin/timelock proposer
 *   MULTISIG_1_ADDRESS — First multisig signer
 *   MULTISIG_2_ADDRESS — Second multisig signer
 *   SAFE_TREASURY_ADDRESS — Gnosis Safe treasury
 *   ETHERSCAN_API_V2 — Basescan/Etherscan API key
 */

const { ethers, network: hardhatNetwork } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Ethers v5 API: parseEther is on utils
const { parseEther, formatEther, keccak256, toUtf8Bytes } = ethers.utils;

// ─── Configuration ───────────────────────────────────────────────
const CONFIG = {
  // Governance
  TIMELOCK_DELAY: 2 * 24 * 3600, // 2 days (48 hours)
  
  // Token
  AG_NAME: "ARTIFACT",
  AG_SYMBOL: "ART",
  AU_NAME: "Artifact Utility",
  AU_SYMBOL: "AU",
  
  // Initial supply (for initial minting if needed)
  INITIAL_MINT: parseEther("100000"), // 100K tokens for deployer
  
  // Emission — PID controller constants
  PID_TVL_TARGET: parseEther("10000000"), // $10M TVL target
  PID_KP: parseEther("0.0001"),  // Proportional gain
  PID_KI: parseEther("0.00001"), // Integral gain
  PID_KD: parseEther("0.00005"), // Derivative gain
  
  // Staking
  AG_THRESHOLD: parseEther("1000"), // 1000 AG for max multiplier
  
  // Treasury
  RESERVE_TOKEN_ADDRESS: process.env.USDC_BASE_ADDRESS || ethers.utils.getAddress("0x833589f4cdb0a6e3bc84827a6bd4c6b4a7a2eb3e"),
  AERODROME_ROUTER_ADDRESS: process.env.AERODROME_ROUTER_ADDRESS || ethers.utils.getAddress("0x4752bA5Db23f44F6821471A762f7D6f2d65F10B9"),
  BUYBACK_PCT: 12, // 12% of excess reserves
  MIN_BUYBACK_USD: 500,
  MAX_BUYBACK_EPOCH_BPS: 500, // 5% per epoch
};

// ─── Utilities ───────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
}

function getAddress(name, envVar) {
  const value = process.env[envVar];
  if (!value || value === "NOT_SET") {
    throw new Error(`Missing required address: ${name} (${envVar})`);
  }
  return value;
}

async function verifyContract(name, address, constructorArgs = []) {
  console.log(`\n📋 Verifying ${name} on Basescan...`);
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✅ ${name} verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`  ✅ ${name} already verified`);
    } else {
      console.log(`  ⚠️  Verification failed: ${error.message}`);
      console.log(`  📌 Manual verification command:`);
      console.log(`     npx hardhat verify --network base --contract contracts/${name}.sol:${name} ${address} ${constructorArgs.join(" ")}`);
    }
  }
}

async function waitConfirmations(tx, confirmations = 5) {
  console.log(`  ⏳ Waiting for ${confirmations} confirmations...`);
  const receipt = await tx.wait(confirmations);
  console.log(`  ✅ Confirmed (block ${receipt.blockNumber})`);
  return receipt;
}

// ─── Main Deployment ─────────────────────────────────────────────
async function main() {
  loadEnv();
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       AV TREASURY v3.1 — MAINNET DEPLOYMENT            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);
  console.log(`🌐 Network: ${hre.network.name} (chain ID: ${hre.network.config.chainId})`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);
  
  // Load config addresses
  const admin = getAddress("Admin", "DEVELOPER_WALLET_ADDRESS");
  const multisig1 = getAddress("Multisig 1", "MULTISIG_1_ADDRESS");
  const multisig2 = getAddress("Multisig 2", "MULTISIG_2_ADDRESS");
  const treasury = getAddress("Treasury Safe", "SAFE_TREASURY_ADDRESS");
  
  const deployerAddress = deployer.address;
  
  // ─── STEP 1: Deploy AgToken ───────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 1/7: AgToken (ARTIFACT)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const AgToken = await ethers.getContractFactory("AgToken");
  const agToken = await AgToken.deploy();
  await agToken.deployed();
  const agTokenAddress = agToken.address;
  console.log(`  ✅ AgToken deployed: ${agTokenAddress}`);
  
  // ─── STEP 2: Deploy AuToken ───────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 2/7: AuToken (Artifact Utility)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const AuToken = await ethers.getContractFactory("AuToken");
  const auToken = await AuToken.deploy();
  await auToken.deployed();
  const auTokenAddress = auToken.address;
  console.log(`  ✅ AuToken deployed: ${auTokenAddress}`);

  // Initialize AuToken with Treasury Safe
  console.log(`  🔧 Initializing AuToken treasury to: ${treasury}`);
  await auToken.initialize(treasury);
  console.log(`  ✅ AuToken treasury initialized`);
  
  // ─── STEP 3: Deploy ArtifactTimelock ──────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 3/7: ArtifactTimelock");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const ArtifactTimelock = await ethers.getContractFactory("ArtifactTimelock");
  const timelock = await ArtifactTimelock.deploy(
    admin,           // _proposer
    admin,           // _executor
    admin            // _canceler
  );
  await timelock.deployed();
  const timelockAddress = timelock.address;
  console.log(`  ✅ ArtifactTimelock deployed: ${timelockAddress}`);
  console.log(`     Delay: ${CONFIG.TIMELOCK_DELAY}s (${CONFIG.TIMELOCK_DELAY / 3600}h)`);
  console.log(`     Proposer/Executor/Canceler: ${admin}`);
  
  // ─── STEP 4: Deploy GovernorContract ──────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 4/7: GovernorContract");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const GovernorContract = await ethers.getContractFactory("GovernorContract");
  const governor = await GovernorContract.deploy(
    agTokenAddress,           // IVotes _token
    timelockAddress           // address _executor
  );
  await governor.deployed();
  const governorAddress = governor.address;
  console.log(`  ✅ GovernorContract deployed: ${governorAddress}`);
  console.log(`     Token: ${agTokenAddress}`);
  console.log(`     Executor: ${timelockAddress}`);
  
  // ─── STEP 5: Deploy AVLPStaking_v2 (BEFORE PID — PID needs staking)
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 5/7: AVLPStaking_v2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // AVLPStaking_v2 is UUPS upgradeable — deploy implementation + call initialize
  const AVLPStaking = await ethers.getContractFactory("AVLPStaking_v2");
  const staking = await AVLPStaking.deploy();
  await staking.deployed();
  const stakingAddress = staking.address;
  console.log(`  ✅ AVLPStaking_v2 implementation deployed: ${stakingAddress}`);
  
  // Call initialize
  console.log("  ⚙️  Initializing AVLPStaking_v2...");
  await staking.initialize(
    ethers.utils.getAddress(auTokenAddress),    // _auToken
    ethers.utils.getAddress(agTokenAddress),    // _agToken
    deployerAddress                             // _lpNFT (placeholder, update via governance)
  );
  console.log(`  ✅ AVLPStaking_v2 initialized`);
  console.log(`     AuToken: ${auTokenAddress}`);
  console.log(`     AgToken: ${agTokenAddress}`);
  console.log(`     LP NFT: ${deployerAddress} (placeholder)`);
  console.log(`     Max Multiplier: 2.5x`);
  
  // ─── STEP 6: Deploy PID_Emission_Controller_v2 ────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 6/7: PID_Emission_Controller_v2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const PIDController = await ethers.getContractFactory("PID_Emission_Controller_v2");
  const pidController = await PIDController.deploy(
    deployerAddress,                              // admin (will transfer to timelock)
    ethers.utils.getAddress(stakingAddress),     // staking_ (AVLPStaking_v2)
    ethers.utils.getAddress(agTokenAddress),     // agToken_
    CONFIG.PID_TVL_TARGET,                        // targetTVL_
    CONFIG.PID_KP,                                // kp_
    CONFIG.PID_KI,                                // ki_
    CONFIG.PID_KD                                 // kd_
  );
  await pidController.deployed();
  const pidControllerAddress = pidController.address;
  console.log(`  ✅ PID_Emission_Controller_v2 deployed: ${pidControllerAddress}`);
  console.log(`     Admin: ${deployerAddress}`);
  console.log(`     Staking: ${stakingAddress}`);
  console.log(`     AgToken: ${agTokenAddress}`);
  console.log(`     TVL Target: ${formatEther(CONFIG.PID_TVL_TARGET)}`);
  console.log(`     KP: ${formatEther(CONFIG.PID_KP)}`);
  console.log(`     KI: ${formatEther(CONFIG.PID_KI)}`);
  console.log(`     KD: ${formatEther(CONFIG.PID_KD)}`);
  
  // ─── STEP 7: Deploy TreasuryAMO ───────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 7/7: TreasuryAMO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const TreasuryAMO = await ethers.getContractFactory("TreasuryAMO");
  const treasuryAMO = await TreasuryAMO.deploy(
    ethers.utils.getAddress(auTokenAddress),       // _auToken
    CONFIG.RESERVE_TOKEN_ADDRESS,                 // _reserveToken (USDC on Base)
    CONFIG.AERODROME_ROUTER_ADDRESS,              // _aerodromeRouter
    treasury                                      // _admin (= Treasury Safe)
  );
  await treasuryAMO.deployed();
  const treasuryAMOAddress = treasuryAMO.address;
  console.log(`  ✅ TreasuryAMO deployed: ${treasuryAMOAddress}`);
  console.log(`     AuToken: ${auTokenAddress}`);
  console.log(`     Reserve Token: ${CONFIG.RESERVE_TOKEN_ADDRESS}`);
  console.log(`     Aerodrome Router: ${CONFIG.AERODROME_ROUTER_ADDRESS}`);
  
  // ─── STEP 8: Configure Roles ──────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚙️  STEP 8: Configuration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Grant MINTER role to PID controller on AgToken
  console.log("\n  🔐 Granting MINTER role to PID Controller...");
  const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
  await agToken.grantRole(MINTER_ROLE, pidControllerAddress);
  console.log(`  ✅ AgToken MINTER_ROLE → PID Controller`);
  
  // Grant MINTER role to TreasuryAMO on AuToken
  console.log("  🔐 Granting MINTER role to TreasuryAMO...");
  await auToken.grantRole(MINTER_ROLE, treasuryAMOAddress);
  console.log(`  ✅ AuToken MINTER_ROLE → TreasuryAMO`);
  
  // Transfer ownership to timelock
  console.log("\n  🏛️  Transferring governance to Timelock...");
  await agToken.grantRole(await agToken.DEFAULT_ADMIN_ROLE(), timelockAddress);
  await agToken.renounceRole(await agToken.DEFAULT_ADMIN_ROLE(), deployerAddress);
  console.log(`  ✅ AgToken admin → Timelock`);
  
  await pidController.transferOwnership(timelockAddress);
  console.log(`  ✅ PID Controller owner → Timelock`);
  
  await treasuryAMO.transferOwnership(timelockAddress);
  console.log(`  ✅ TreasuryAMO owner → Timelock`);
  
  await staking.transferOwnership(timelockAddress);
  console.log(`  ✅ AVLPStaking owner → Timelock`);
  
  // ─── Verification ─────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 ETHERSCAN VERIFICATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (process.env.ETHERSCAN_API_V2 && process.env.ETHERSCAN_API_V2 !== "NOT_SET") {
    console.log("\n  Waiting 30s for Basescan to index contracts...");
    await new Promise(r => setTimeout(r, 30000));
    
    await verifyContract("AgToken", agTokenAddress, []);
    await verifyContract("AuToken", auTokenAddress, []);
    await verifyContract("ArtifactTimelock", timelockAddress, [
      admin,
      admin,
      admin
    ]);
    await verifyContract("GovernorContract", governorAddress, [
      agTokenAddress,
      timelockAddress
    ]);
    // AVLPStaking_v2 is UUPS proxy — verify implementation, not proxy
    console.log("  ⚠️  AVLPStaking_v2 is UUPS proxy — verify implementation manually");
    await verifyContract("PID_Emission_Controller_v2", pidControllerAddress, [
      deployerAddress,
      stakingAddress,
      agTokenAddress,
      CONFIG.PID_TVL_TARGET,
      CONFIG.PID_KP,
      CONFIG.PID_KI,
      CONFIG.PID_KD
    ]);
    await verifyContract("TreasuryAMO", treasuryAMOAddress, [
      auTokenAddress,
      CONFIG.RESERVE_TOKEN_ADDRESS,
      CONFIG.AERODROME_ROUTER_ADDRESS,
      deployerAddress
    ]);
  } else {
    console.log("  ⚠️  ETHERSCAN_API_V2 not set — skipping verification");
  }
  
  // ─── Summary ──────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              DEPLOYMENT COMPLETE                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      AgToken: agTokenAddress,
      AuToken: auTokenAddress,
      ArtifactTimelock: timelockAddress,
      GovernorContract: governorAddress,
      PID_Emission_Controller_v2: pidControllerAddress,
      TreasuryAMO: treasuryAMOAddress,
      AVLPStaking_v2: stakingAddress,
    },
    config: {
      timelockDelay: CONFIG.TIMELOCK_DELAY,
      votingPeriod: CONFIG.VOTING_PERIOD,
      quorumPercent: CONFIG.QUORUM_PERCENT,
      tvlTarget: CONFIG.PID_TVL_TARGET.toString(),
      bootstrapTVL: CONFIG.PID_BOOTSTRAP_TVL.toString(),
      agThreshold: CONFIG.AG_THRESHOLD.toString(),
      maxMultiplier: 25000,
      buybackPct: CONFIG.BUYBACK_PCT,
      minBuybackUSD: CONFIG.MIN_BUYBACK_USD,
    },
    admin: admin,
    multisig1: multisig1,
    multisig2: multisig2,
    treasury: treasury,
  };
  
  // Save deployment manifest
  const manifestPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment manifest saved: ${manifestPath}\n`);
  
  // Print summary table
  console.log("┌─────────────────────────────────────┬────────────────────────────────────────────┐");
  console.log("│ Contract                            │ Address                                    │");
  console.log("├─────────────────────────────────────┼────────────────────────────────────────────┤");
  for (const [name, addr] of Object.entries(deploymentInfo.contracts)) {
    console.log(`│ ${name.padEnd(35)} │ ${addr.padEnd(42)} │`);
  }
  console.log("└─────────────────────────────────────┴────────────────────────────────────────────┘\n");
  
  console.log("🏛️  All governance roles transferred to Timelock");
  console.log(`🔒 Timelock address: ${timelockAddress}`);
  console.log(`⏱️  Delay: ${CONFIG.TIMELOCK_DELAY / 3600} hours\n`);
  
  console.log("📌 Next steps:");
  console.log("   1. Review deployment manifest");
  console.log("   2. Verify all contracts on Basescan");
  console.log("   3. Fund TreasuryAMO with reserve tokens (USDC)");
  console.log("   4. Initialize PID controller parameters via governance");
  console.log("   5. Test buyback execution via governance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
