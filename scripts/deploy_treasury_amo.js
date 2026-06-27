/**
 * AV Treasury v3.1 — TreasuryAMO Deployment (Phase 2)
 * 
 * Deploys TreasuryAMO after LP is created on Aerodrome.
 * Run this AFTER the main deploy script + LP creation.
 * 
 * Required .env:
 *   PRIVATE_KEY_BASE, SAFE_TREASURY_ADDRESS, AERODROME_ROUTER_ADDRESS
 *   + AU_TOKEN_ADDRESS, AG_TOKEN_ADDRESS (from phase 1 deployment)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy_treasury_amo.js --network base
 */

const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

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
    }
  }
}

async function main() {
  loadEnv();
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       TREASURY AMO — Phase 2 Deployment                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);
  
  // Load addresses
  const treasury = ethers.utils.getAddress(process.env.SAFE_TREASURY_ADDRESS);
  const auTokenAddress = ethers.utils.getAddress(process.env.AU_TOKEN_ADDRESS);
  const agTokenAddress = ethers.utils.getAddress(process.env.AG_TOKEN_ADDRESS);
  const aerodromeRouter = ethers.utils.getAddress(process.env.AERODROME_ROUTER_ADDRESS);
  const reserveToken = process.env.USDC_BASE_ADDRESS
    ? ethers.utils.getAddress(process.env.USDC_BASE_ADDRESS)
    : ethers.utils.getAddress("0x833589fCDB0A6e3bC84827A6bD4C6B4a7A2eB3e");
  
  console.log(`🏛️  Treasury Safe: ${treasury}`);
  console.log(`🪙 AuToken: ${auTokenAddress}`);
  console.log(`🪙 AgToken: ${agTokenAddress}`);
  console.log(`🔄 Aerodrome Router: ${aerodromeRouter}`);
  console.log(`💵 Reserve Token: ${reserveToken}\n`);
  
  // Deploy TreasuryAMO
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 Deploying TreasuryAMO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const TreasuryAMO = await ethers.getContractFactory("TreasuryAMO");
  const treasuryAMO = await TreasuryAMO.deploy(
    auTokenAddress,
    reserveToken,
    aerodromeRouter,
    treasury
  );
  await treasuryAMO.deployed();
  const treasuryAMOAddress = treasuryAMO.address;
  console.log(`  ✅ TreasuryAMO deployed: ${treasuryAMOAddress}`);
  
  // Grant MINTER role to TreasuryAMO on AuToken
  console.log("\n  🔐 Granting MINTER role to TreasuryAMO on AuToken...");
  const AuToken = await ethers.getContractFactory("AuToken");
  const auToken = AuToken.attach(auTokenAddress);
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  await auToken.grantRole(MINTER_ROLE, treasuryAMOAddress);
  console.log(`  ✅ AuToken MINTER_ROLE → TreasuryAMO`);
  
  // Transfer ownership to Treasury Safe
  console.log("  🏛️  Transferring ownership to Treasury Safe...");
  await treasuryAMO.transferOwnership(treasury);
  console.log(`  ✅ TreasuryAMO owner → Treasury Safe`);
  
  // Renounce deployer roles
  console.log("  🚫 Renouncing deployer roles...");
  try {
    const DEFAULT_ADMIN = await treasuryAMO.DEFAULT_ADMIN_ROLE();
    if (await treasuryAMO.hasRole(DEFAULT_ADMIN, deployer.address)) {
      await treasuryAMO.renounceRole(DEFAULT_ADMIN, deployer.address);
    }
  } catch (e) { /* ok */ }
  
  // Verification
  if (process.env.ETHERSCAN_API_V2 && process.env.ETHERSCAN_API_V2 !== "NOT_SET") {
    console.log("\n  ⏳ Waiting 30s for Etherscan to index...");
    await new Promise(r => setTimeout(r, 30000));
    await verifyOnEtherscan("TreasuryAMO", treasuryAMOAddress, [
      auTokenAddress,
      reserveToken,
      aerodromeRouter,
      treasury
    ]);
  }
  
  // Save to deployments file
  const manifestPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    manifest.contracts.TreasuryAMO = treasuryAMOAddress;
    manifest.aerodromeRouter = aerodromeRouter;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📄 Updated deployment manifest: ${manifestPath}`);
  }
  
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              TREASURY AMO DEPLOYED                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  TreasuryAMO: ${treasuryAMOAddress}`);
  console.log(`  Owner: ${treasury}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
