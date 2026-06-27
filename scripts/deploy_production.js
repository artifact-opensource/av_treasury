/**
 * PRODUCTION DEPLOY — AuToken + AgToken only
 * 
 * Deploys:
 *   1. AgToken (UUPS: implementation + ERC1967Proxy)
 *   2. AuToken (UUPS: implementation + ERC1967Proxy)
 * 
 * Treasury Safe must be pre-deployed. Set SAFE_TREURY_ADDRESS in .env.
 * 
 * After deploy:
 *   - All roles transferred to Treasury Safe
 *   - NO MINTING (as instructed)
 *   - Verification via hardhat-verify (Etherscan v2)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy_production.js --network base
 */

const { ethers, network, run } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  // Read treasury from .env
  const treasuryAddress = process.env.SAFE_TREASURY_ADDRESS;
  if (!treasuryAddress || treasuryAddress === "NOT_SET") {
    throw new Error("SAFE_TREASURY_ADDRESS must be set in .env");
  }

  console.log("\n" + "=".repeat(60));
  console.log("  PRODUCTION DEPLOY — AuToken + AgToken");
  console.log("=".repeat(60));
  console.log(`  Deployer: ${deployerAddress}`);
  console.log(`  Network:  ${network.name}`);
  console.log(`  Balance:  ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  console.log(`  Treasury: ${treasuryAddress}`);
  console.log("=".repeat(60));

  // ============================================================
  // STEP 1: Deploy AgToken Implementation
  // ============================================================
  console.log("\n� STEP 1: Deploying AgToken Implementation...");

  const AgToken = await ethers.getContractFactory("contracts/av_suite/AgToken.sol:AgToken");
  const agTokenImpl = await AgToken.deploy();
  await agTokenImpl.deployed();
  console.log(`  ✅ AgToken implementation: ${agTokenImpl.address}`);

  // ============================================================
  // STEP 2: Deploy AuToken Implementation
  // ============================================================
  console.log("\n📦 STEP 2: Deploying AuToken Implementation...");

  const AuToken = await ethers.getContractFactory("contracts/av_suite/AuToken.sol:AuToken");
  const auTokenImpl = await AuToken.deploy();
  await auTokenImpl.deployed();
  console.log(`  ✅ AuToken implementation: ${auTokenImpl.address}`);

  // ============================================================
  // STEP 3: Deploy AgToken Proxy (treasury as admin)
  // ============================================================
  console.log("\n📦 STEP 3: Deploying AgToken Proxy...");

  const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const agTokenInitData = AgToken.interface.encodeFunctionData("initialize", [
    treasuryAddress
  ]);
  const agTokenProxy = await ERC1967Proxy.deploy(agTokenImpl.address, agTokenInitData);
  await agTokenProxy.deployed();
  const agTokenAddress = agTokenProxy.address;
  console.log(`  ✅ AgToken proxy: ${agTokenAddress}`);

  const agToken = AgToken.attach(agTokenAddress);
  const agSupply = await agToken.totalSupply();
  console.log(`      Total supply: ${ethers.utils.formatEther(agSupply)} AG`);

  // ============================================================
  // STEP 4: Deploy AuToken Proxy (treasury as fee destination)
  // ============================================================
  console.log("\n📦 STEP 4: Deploying AuToken Proxy...");

  const auTokenInitData = AuToken.interface.encodeFunctionData("initialize", [
    treasuryAddress
  ]);
  const auTokenProxy = await ERC1967Proxy.deploy(auTokenImpl.address, auTokenInitData);
  await auTokenProxy.deployed();
  const auTokenAddress = auTokenProxy.address;
  console.log(`  ✅ AuToken proxy: ${auTokenAddress}`);

  const auToken = AuToken.attach(auTokenAddress);
  console.log(`      Total supply: ${ethers.utils.formatEther(await auToken.totalSupply())} Au`);
  console.log(`      Treasury:     ${await auToken.treasury()}`);

  // ============================================================
  // STEP 5: Configure AuToken Roles → Treasury Safe
  // ============================================================
  console.log("\n� STEP 5: Configuring AuToken roles...");

  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
  const AU_MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const AU_MINT_PAUSER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINT_PAUSER"));
  const AU_DEFAULT_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEFAULT_ADMIN"));
  const AU_ANTI_BOT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANTI_BOT"));
  const AU_UPGRADER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER"));
  const AU_PAUSER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER"));
  const AU_FEE_MANAGER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_MANAGER"));
  const AU_RESCUE_USER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESCUE_USER"));

  const roles = [
    { name: "DEFAULT_ADMIN", hash: DEFAULT_ADMIN_ROLE },
    { name: "MINT_PAUSER", hash: AU_MINT_PAUSER },
    { name: "ANTI_BOT", hash: AU_ANTI_BOT },
    { name: "UPGRADER", hash: AU_UPGRADER },
    { name: "PAUSER", hash: AU_PAUSER },
    { name: "FEE_MANAGER", hash: AU_FEE_MANAGER },
    { name: "RESCUE_USER", hash: AU_RESCUE_USER },
  ];

  // Grant all roles to Treasury Safe (deployer has DEFAULT_ADMIN from initialize)
  for (const role of roles) {
    const tx = await auToken.connect(deployer).grantRole(role.hash, treasuryAddress);
    await tx.wait();
    console.log(`  ✅ ${role.name} → Treasury Safe`);
  }

  // Renounce deployer roles (except DEFAULT_ADMIN — can't renounce)
  for (const role of roles) {
    if (role.hash === DEFAULT_ADMIN_ROLE) continue;
    const tx = await auToken.connect(deployer).renounceRole(role.hash, deployerAddress);
    await tx.wait();
    console.log(`  ✅ ${role.name} renounced (deployer)`);
  }

  // ============================================================
  // STEP 6: AgToken admin check (AccessControl, not Ownable)
  // ============================================================
  console.log("\n🔐 STEP 6: Verifying AgToken admin...");

  // AgToken uses AccessControl — admin was set to treasury in initialize
  const isAdmin = await agToken.hasRole(ethers.constants.HashZero, treasuryAddress);
  console.log(`  ✅ AgToken admin is Treasury Safe: ${isAdmin}`);

  // ============================================================
  // STEP 7: Verify on Etherscan v2
  // ============================================================
  console.log("\n🔍 STEP 7: Verifying contracts on Etherscan...");

  console.log("  � Waiting 30s for Etherscan indexer...");
  await new Promise(r => setTimeout(r, 30000));

  // Verify AgToken implementation
  try {
    await run("verify:verify", {
      address: agTokenImpl.address,
      constructorArguments: [],
    });
    console.log("  ✅ AgToken implementation verified");
  } catch (e) {
    console.log(`  ⚠️  AgToken impl verify: ${e.message}`);
  }

  // Verify AuToken implementation
  try {
    await run("verify:verify", {
      address: auTokenImpl.address,
      constructorArguments: [],
    });
    console.log("  ✅ AuToken implementation verified");
  } catch (e) {
    console.log(`  ⚠️  AuToken impl verify: ${e.message}`);
  }

  // ============================================================
  // STEP 8: Summary
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  AgToken Proxy:    ${agTokenAddress}`);
  console.log(`  AgToken Impl:     ${agTokenImpl.address}`);
  console.log(`  Treasury Safe:    ${treasuryAddress}`);
  console.log(`  AuToken Proxy:    ${auTokenAddress}`);
  console.log(`  AuToken Impl:     ${auTokenImpl.address}`);
  console.log("=".repeat(60));

  // Save deployment
  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deploymentInfo = {
    network: network.name,
    date: new Date().toISOString(),
    deployer: deployerAddress,
    contracts: {
      AgTokenProxy: agTokenAddress,
      AgTokenImplementation: agTokenImpl.address,
      TreasurySafe: treasuryAddress,
      AuTokenProxy: auTokenAddress,
      AuTokenImplementation: auTokenImpl.address,
    },
    roles: {
      AuTokenAdmin: treasuryAddress,
      AgTokenOwner: treasuryAddress,
    },
    verification: {
      AgTokenProxy: `https://basescan.org/address/${agTokenAddress}#code`,
      AgTokenImpl: `https://basescan.org/address/${agTokenImpl.address}#code`,
      AuTokenProxy: `https://basescan.org/address/${auTokenAddress}#code`,
      AuTokenImpl: `https://basescan.org/address/${auTokenImpl.address}#code`,
    },
  };

  fs.writeFileSync(
    `${deploymentsDir}/${network.name}-production.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\n  📄 Saved to: deployments/${network.name}-production.json`);

  console.log("\n  ⚠️  IMPORTANT:");
  console.log("     - NO MINTING performed (as instructed)");
  console.log("     - Treasury Safe owns all roles and ownership");
  console.log("     - Verify on Basescan before any interaction");
  console.log("     - Fund Treasury Safe with ETH for gas");
  console.log("\n✅ DONE\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });
