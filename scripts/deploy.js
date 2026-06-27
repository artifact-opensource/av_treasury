/**
 * AV Treasury v3.1 — Mainnet Deployment Script (Base Network)
 * 
 * Deployment Order:
 * 1. AgToken (ARTIFACT) — UUPS upgradeable governance token (implementation + ERC1967Proxy)
 * 2. AuToken (Artifact Utility) — UUPS upgradeable utility token (implementation + ERC1967Proxy)
 * 3. ArtifactTimelock — Timelock controller for governance
 * 4. GovernorContract — DAO governance (token, executor)
 * 5. AVLPStaking_v2 — LP staking (implementation + ERC1967Proxy)
 * 6. PID_Emission_Controller_v2 — Emission controller
 * 7. TreasuryAMO — Automated Market Operations
 * 8. Configure: Grant roles, set controllers, transfer ownership to Treasury Safe
 * 
 * ALL admin/ownership roles → Treasury Safe (SAFE_TREASURY_ADDRESS)
 * Verification: Etherscan V2 (not Basescan)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network base
 * 
 * Environment variables required (see .env):
 *   PRIVATE_KEY_BASE     — Deployer private key
 *   RPC_URL_BASE         — Base mainnet RPC
 *   SAFE_TREASURY_ADDRESS — Gnosis Safe treasury (receives ALL admin roles)
 *   ETHERSCAN_API_V2     — Etherscan V2 API key
 *   AERODROME_ROUTER_ADDRESS — Aerodrome router on Base mainnet
 *   LP_NFT_ADDRESS       — Aerodrome LP NFT (if known, else Treasury Safe as placeholder)
 */

const { ethers, network: hardhatNetwork, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ─── Configuration ───────────────────────────────────────────────
const CONFIG = {
  TIMELOCK_DELAY: 2 * 24 * 3600, // 2 days
  
  AG_NAME: "ARTIFACT",
  AG_SYMBOL: "ART",
  AU_NAME: "Artifact Utility",
  AU_SYMBOL: "AU",
  
  // PID controller constants
  PID_TVL_TARGET: ethers.utils.parseEther("10000000"),
  PID_KP: ethers.utils.parseEther("0.0001"),
  PID_KI: ethers.utils.parseEther("0.00001"),
  PID_KD: ethers.utils.parseEther("0.00005"),
  
  // Staking
  AG_THRESHOLD: ethers.utils.parseEther("1000"),
  
  // Treasury
  BUYBACK_PCT: 12,
  MIN_BUYBACK_USD: 500,
  MAX_BUYBACK_EPOCH_BPS: 500,
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
  return ethers.utils.getAddress(value);
}

async function verifyOnEtherscan(name, address, constructorArgs = []) {
  console.log(`\n  📋 Verifying ${name} on Etherscan...`);
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✅ ${name} verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`  ✅ ${name} already verified`);
    } else {
      console.log(`  ⚠️  Verification failed: ${error.message}`);
      console.log(`  📌 Manual: npx hardhat verify --network base --contract contracts/${name}.sol:${name} ${address} ${constructorArgs.join(" ")}`);
    }
  }
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
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH\n`);
  
  // ─── Load addresses from .env ─────────────────────────────────
  const treasury = getAddress("Treasury Safe", "SAFE_TREASURY_ADDRESS");
  const reserveToken = process.env.USDC_BASE_ADDRESS
    ? ethers.utils.getAddress(process.env.USDC_BASE_ADDRESS)
    : ethers.utils.getAddress("0x833589fCDB0A6e3bC84827A6bD4C6B4a7A2eB3e"); // USDC Base mainnet
  
  // Aerodrome router + LP NFT are ONLY needed for TreasuryAMO (buyback/swap)
  // Phase 1 (tokens/governance/staking) does NOT need them
  const aerodromeRouterAddr = process.env.AERODROME_ROUTER_ADDRESS;
  const hasRouter = aerodromeRouterAddr && aerodromeRouterAddr !== "NOT_SET";
  const lpNFTAddr = process.env.LP_NFT_ADDRESS;
  const hasLPNFT = lpNFTAddr && lpNFTAddr !== "NOT_SET";
  
  const aerodromeRouter = hasRouter ? ethers.utils.getAddress(aerodromeRouterAddr) : ethers.constants.AddressZero;
  const lpNFTAddress = hasLPNFT ? ethers.utils.getAddress(lpNFTAddr) : treasury; // placeholder until LP exists
  
  console.log(`🏛️  Treasury Safe: ${treasury}`);
  console.log(`💵 Reserve Token: ${reserveToken}`);
  console.log(`🔄 Aerodrome Router: ${hasRouter ? aerodromeRouter : "⚠️  NOT SET — TreasuryAMO will be skipped"}`);
  console.log(`🎫 LP NFT: ${hasLPNFT ? lpNFTAddress : "⚠️  NOT SET — using Treasury Safe as placeholder"}\n`);
  
  // ─── STEP 1: Deploy AgToken (UUPS: implementation + proxy) ────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 1/7: AgToken (ARTIFACT) — UUPS Proxy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const AgToken = await ethers.getContractFactory("AgToken");
  const agTokenImpl = await AgToken.deploy();
  await agTokenImpl.deployed();
  console.log(`  ✅ AgToken implementation: ${agTokenImpl.address}`);
  
  // Deploy ERC1967Proxy with initialize call
  const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const agTokenInitData = AgToken.interface.encodeFunctionData("initialize", [
    treasury  // admin → Treasury Safe
  ]);
  const agTokenProxy = await ERC1967Proxy.deploy(agTokenImpl.address, agTokenInitData);
  await agTokenProxy.deployed();
  const agTokenAddress = agTokenProxy.address;
  console.log(`  ✅ AgToken proxy: ${agTokenAddress}`);
  
  // Use proxy address for contract interactions
  const agToken = AgToken.attach(agTokenAddress);
  
  // ─── STEP 2: Deploy AuToken (UUPS: implementation + proxy) ────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 2/7: AuToken (Artifact Utility) — UUPS Proxy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const AuToken = await ethers.getContractFactory("AuToken");
  const auTokenImpl = await AuToken.deploy();
  await auTokenImpl.deployed();
  console.log(`  ✅ AuToken implementation: ${auTokenImpl.address}`);
  
  const auTokenInitData = AuToken.interface.encodeFunctionData("initialize", [
    treasury  // treasury → Treasury Safe
  ]);
  const auTokenProxy = await ERC1967Proxy.deploy(auTokenImpl.address, auTokenInitData);
  await auTokenProxy.deployed();
  const auTokenAddress = auTokenProxy.address;
  console.log(`  ✅ AuToken proxy: ${auTokenAddress}`);
  
  const auToken = AuToken.attach(auTokenAddress);
  
  // ─── STEP 3: Deploy ArtifactTimelock ──────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 3/7: ArtifactTimelock");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const ArtifactTimelock = await ethers.getContractFactory("ArtifactTimelock");
  const timelock = await ArtifactTimelock.deploy(
    treasury,   // _proposer → Treasury Safe
    treasury,   // _executor → Treasury Safe
    treasury    // _canceler → Treasury Safe
  );
  await timelock.deployed();
  const timelockAddress = timelock.address;
  console.log(`  ✅ ArtifactTimelock deployed: ${timelockAddress}`);
  console.log(`     Delay: ${CONFIG.TIMELOCK_DELAY}s (${CONFIG.TIMELOCK_DELAY / 3600}h)`);
  console.log(`     Proposer/Executor/Canceler: ${treasury}`);
  
  // ─── STEP 4: Deploy GovernorContract ──────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 4/7: GovernorContract");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const GovernorContract = await ethers.getContractFactory("GovernorContract");
  const governor = await GovernorContract.deploy(
    agTokenAddress,   // IVotes _token
    timelockAddress   // address _executor
  );
  await governor.deployed();
  const governorAddress = governor.address;
  console.log(`  ✅ GovernorContract deployed: ${governorAddress}`);
  console.log(`     Token: ${agTokenAddress}`);
  console.log(`     Executor: ${timelockAddress}`);
  
  // ─── STEP 5: Deploy AVLPStaking_v2 (UUPS: impl + proxy) ──────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 5/7: AVLPStaking_v2 — UUPS Proxy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const AVLPStaking = await ethers.getContractFactory("AVLPStaking_v2");
  const stakingImpl = await AVLPStaking.deploy();
  await stakingImpl.deployed();
  console.log(`  ✅ AVLPStaking_v2 implementation: ${stakingImpl.address}`);
  
  const stakingInitData = AVLPStaking.interface.encodeFunctionData("initialize", [
    auTokenAddress,   // _auToken
    agTokenAddress,   // _agToken
    lpNFTAddress      // _lpNFT (Treasury Safe until LP NFT is provided)
  ]);
  const stakingProxy = await ERC1967Proxy.deploy(stakingImpl.address, stakingInitData);
  await stakingProxy.deployed();
  const stakingAddress = stakingProxy.address;
  console.log(`  ✅ AVLPStaking_v2 proxy: ${stakingAddress}`);
  console.log(`     AuToken: ${auTokenAddress}`);
  console.log(`     AgToken: ${agTokenAddress}`);
  console.log(`     LP NFT: ${lpNFTAddress}`);
  
  const staking = AVLPStaking.attach(stakingAddress);
  
  // ─── STEP 6: Deploy PID_Emission_Controller_v2 ────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 STEP 6/7: PID_Emission_Controller_v2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const PIDController = await ethers.getContractFactory("PID_Emission_Controller_v2");
  const pidController = await PIDController.deploy(
    treasury,                                    // admin → Treasury Safe
    stakingAddress,                              // staking_
    agTokenAddress,                              // agToken_
    CONFIG.PID_TVL_TARGET,                       // targetTVL_
    CONFIG.PID_KP,                               // kp_
    CONFIG.PID_KI,                               // ki_
    CONFIG.PID_KD                                // kd_
  );
  await pidController.deployed();
  const pidControllerAddress = pidController.address;
  console.log(`  ✅ PID_Emission_Controller_v2 deployed: ${pidControllerAddress}`);
  console.log(`     Admin: ${treasury}`);
  console.log(`     Staking: ${stakingAddress}`);
  console.log(`     AgToken: ${agTokenAddress}`);
  console.log(`     TVL Target: ${ethers.utils.formatEther(CONFIG.PID_TVL_TARGET)}`);
  
  // ─── STEP 7: Deploy TreasuryAMO (only if router is set) ───────
  let treasuryAMOAddress = ethers.constants.AddressZero;
  if (hasRouter) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 STEP 7/7: TreasuryAMO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const TreasuryAMO = await ethers.getContractFactory("TreasuryAMO");
    const treasuryAMO = await TreasuryAMO.deploy(
      auTokenAddress,       // _auToken
      reserveToken,         // _reserveToken (USDC on Base)
      aerodromeRouter,      // _aerodromeRouter
      treasury              // _admin → Treasury Safe
    );
    await treasuryAMO.deployed();
    treasuryAMOAddress = treasuryAMO.address;
    console.log(`  ✅ TreasuryAMO deployed: ${treasuryAMOAddress}`);
    console.log(`     AuToken: ${auTokenAddress}`);
    console.log(`     Reserve Token: ${reserveToken}`);
    console.log(`     Aerodrome Router: ${aerodromeRouter}`);
    console.log(`     Admin: ${treasury}`);
  } else {
    console.log("\n⏭️  STEP 7/7: TreasuryAMO — SKIPPED (set AERODROME_ROUTER_ADDRESS to deploy)");
  }
  
  // ─── STEP 8: Configure Roles ──────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚙️  STEP 8: Configuration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Grant MINTER role to PID controller on AgToken (TREASURY has DEFAULT_ADMIN)
  console.log("\n  🔐 Granting MINTER role to PID Controller...");
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  await agToken.connect(treasury).grantRole(MINTER_ROLE, pidControllerAddress);
  console.log(`  ✅ AgToken MINTER_ROLE → PID Controller`);
  
  // Grant EMIT_ROLE to staking contract on PID controller
  console.log("  🔐 Granting EMIT_ROLE to Staking contract...");
  const EMIT_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMIT_ROLE"));
  await pidController.grantRole(EMIT_ROLE, stakingAddress);
  console.log(`  ✅ PID Controller EMIT_ROLE → Staking`);
  
  // Grant MINTER role to TreasuryAMO on AuToken (only if deployed)
  if (hasRouter) {
    console.log("  🔐 Granting MINTER role to TreasuryAMO...");
    await auToken.grantRole(MINTER_ROLE, treasuryAMOAddress);
    console.log(`  ✅ AuToken MINTER_ROLE → TreasuryAMO`);
  }
  
  // Transfer ALL admin roles to Treasury Safe
  console.log("\n  🏛️  Transferring ALL governance to Treasury Safe...");
  
  // AgToken: initialize(admin) already grants DEFAULT_ADMIN_ROLE + UPGRADER_ROLE to Treasury Safe
  // Deployer never has roles — nothing to transfer or renounce
  console.log(`  ✅ AgToken: Treasury Safe already has all roles (set in initialize)`);
  
  // AuToken: ALL roles → Treasury Safe (initialize grants roles to msg.sender=deployer)
  console.log("  🔐 AuToken: transferring all roles to Treasury Safe...");
  const AU_DEFAULT_ADMIN = await auToken.DEFAULT_ADMIN_ROLE();
  const AU_ANTI_BOT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANTI_BOT_ROLE"));
  const AU_UPGRADER = await auToken.UPGRADER_ROLE();
  
  // Grant Treasury Safe all roles (except MINTER — that stays with TreasuryAMO)
  await auToken.grantRole(AU_DEFAULT_ADMIN, treasury);
  await auToken.grantRole(AU_ANTI_BOT, treasury);
  await auToken.grantRole(AU_UPGRADER, treasury);
  
  // Renounce deployer's roles
  await auToken.renounceRole(AU_DEFAULT_ADMIN, deployer.address);
  await auToken.renounceRole(AU_ANTI_BOT, deployer.address);
  await auToken.renounceRole(AU_UPGRADER, deployer.address);
  console.log(`  ✅ AuToken all roles → Treasury Safe (MINTER stays with TreasuryAMO)`);
  
  // AVLPStaking_v2: DEFAULT_ADMIN_ROLE → Treasury Safe (deployer has it from initialize)
  await staking.grantRole(DEFAULT_ADMIN_ROLE, treasury);
  await staking.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(`  ✅ AVLPStaking_v2 admin → Treasury Safe`);
  
  // PID Controller: DEFAULT_ADMIN_ROLE → Treasury Safe (deployer is admin from constructor)
  await pidController.grantRole(DEFAULT_ADMIN_ROLE, treasury);
  await pidController.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(`  ✅ PID Controller admin → Treasury Safe`);
  
  // TreasuryAMO: DEFAULT_ADMIN_ROLE → Treasury Safe (only if deployed)
  if (hasRouter) {
    await treasuryAMO.grantRole(DEFAULT_ADMIN_ROLE, treasury);
    await treasuryAMO.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log(`  ✅ TreasuryAMO admin → Treasury Safe`);
  }
  
  // Deployer renounces any remaining roles
  console.log("\n  🚫 Renouncing deployer roles...");
  if (hasRouter) {
    try {
      const DEFAULT_ADMIN = await treasuryAMO.DEFAULT_ADMIN_ROLE();
      if (await treasuryAMO.hasRole(DEFAULT_ADMIN, deployer.address)) {
        await treasuryAMO.renounceRole(DEFAULT_ADMIN, deployer.address);
      }
    } catch (e) { /* already transferred */ }
  }
  
  // ─── Verification (Etherscan V2) ──────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 ETHERSCAN V2 VERIFICATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (process.env.ETHERSCAN_API_V2 && process.env.ETHERSCAN_API_V2 !== "NOT_SET") {
    console.log("\n  ⏳ Waiting 30s for Etherscan to index contracts...");
    await new Promise(r => setTimeout(r, 30000));
    
    // Verify implementations (what matters for source code)
    await verifyOnEtherscan("AgToken", agTokenImpl.address, []);
    await verifyOnEtherscan("AuToken", auTokenImpl.address, []);
    await verifyOnEtherscan("AVLPStaking_v2", stakingImpl.address, []);
    await verifyOnEtherscan("ArtifactTimelock", timelockAddress, [
      treasury, treasury, treasury
    ]);
    await verifyOnEtherscan("GovernorContract", governorAddress, [
      agTokenAddress,
      timelockAddress
    ]);
    await verifyOnEtherscan("PID_Emission_Controller_v2", pidControllerAddress, [
      treasury,
      stakingAddress,
      agTokenAddress,
      CONFIG.PID_TVL_TARGET,
      CONFIG.PID_KP,
      CONFIG.PID_KI,
      CONFIG.PID_KD
    ]);
    if (hasRouter) {
      await verifyOnEtherscan("TreasuryAMO", treasuryAMOAddress, [
        auTokenAddress,
        reserveToken,
        aerodromeRouter,
        treasury
      ]);
    }
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
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AgToken_impl: agTokenImpl.address,
      AgToken: agTokenAddress,
      AuToken_impl: auTokenImpl.address,
      AuToken: auTokenAddress,
      ArtifactTimelock: timelockAddress,
      GovernorContract: governorAddress,
      AVLPStaking_v2_impl: stakingImpl.address,
      AVLPStaking_v2: stakingAddress,
      PID_Emission_Controller_v2: pidControllerAddress,
      TreasuryAMO: treasuryAMOAddress,
    },
    config: {
      timelockDelay: CONFIG.TIMELOCK_DELAY,
      tvlTarget: CONFIG.PID_TVL_TARGET.toString(),
      kp: CONFIG.PID_KP.toString(),
      ki: CONFIG.PID_KI.toString(),
      kd: CONFIG.PID_KD.toString(),
      buybackPct: CONFIG.BUYBACK_PCT,
    },
    treasury: treasury,
    reserveToken: reserveToken,
    aerodromeRouter: aerodromeRouter,
    lpNFT: lpNFTAddress,
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
  
  console.log(`🏛️  All governance roles → Treasury Safe: ${treasury}`);
  console.log(`⏱️  Timelock delay: ${CONFIG.TIMELOCK_DELAY / 3600} hours\n`);
  
  console.log("📌 Next steps:");
  console.log("   1. Review deployment manifest");
  console.log("   2. Verify all contracts on Etherscan");
  console.log("   3. Fund TreasuryAMO with reserve tokens (USDC)");
  console.log("   4. Create AgToken/AuToken LP on Aerodrome → get LP NFT");
  console.log("   5. Update AVLPStaking_v2 lpNFT via governance");
  console.log("   6. Initialize PID controller parameters via governance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
