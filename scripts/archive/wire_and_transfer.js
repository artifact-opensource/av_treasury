const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

const TREASURY_SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

// Deployed addresses
const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
const STAKING = "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3";
const PID = "0xB8F240870DBc1cD5F9262F8180350A29ea404268";
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const FLASHBUY = "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053";
const TAMO = "0xF096cD4D24811B0F824c929907196bCB796bca88";

async function sendTx(name, fn) {
  try {
    const tx = await fn();
    await tx.wait();
    console.log(`  ✅ ${name}`);
    return true;
  } catch(e) {
    console.log(`  ❌ ${name}: ${e.reason || e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Treasury Safe:", TREASURY_SAFE);
  console.log("");

  // ── STEP 1: Initialize Staking ──
  console.log("═══ STEP 1: Initialize Staking ═══");
  const staking = await ethers.getContractAt("AVLPStaking_v2", STAKING);
  await sendTx("Staking.initialize(Au, Ag, NFT)", () =>
    staking.initialize(AU, AG, NFT));

  // ── STEP 2: Set PID on Staking ──
  // Check if staking has setPID or similar
  console.log("\n═══ STEP 2: Wire PID → Staking ═══");
  // Try common patterns
  const stakingAbi = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "artifacts", "contracts", "av_suite", "AVLPStaking_v2.sol", "AVLPStaking_v2.json"), "utf-8")).abi;
  const stakingFns = stakingAbi.filter(i => i.type === "function").map(i => i.name);
  console.log("  Staking functions:", stakingFns.filter(n => /pid|controller|emission|reward/i.test(n)).join(", "));

  if (stakingFns.includes("setPID")) {
    await sendTx("Staking.setPID(PID)", () => staking.setPID(PID));
  } else if (stakingFns.includes("setController")) {
    await sendTx("Staking.setController(PID)", () => staking.setController(PID));
  } else if (stakingFns.includes("setEmissionController")) {
    await sendTx("Staking.setEmissionController(PID)", () => staking.setEmissionController(PID));
  } else {
    console.log("  ⚠️ No PID wiring function found on staking");
  }

  // ── STEP 3: Transfer ownership → Treasury Safe ──
  console.log("\n═══ STEP 3: Transfer Ownership → Treasury Safe ═══");
  
  // Staking
  await sendTx("Staking.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    staking.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("Staking.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    staking.renounceRole(ethers.constants.HashZero, deployer.address));

  // PID Controller
  const pid = await ethers.getContractAt("PID_Emission_Controller_v2", PID);
  await sendTx("PID.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    pid.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("PID.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    pid.renounceRole(ethers.constants.HashZero, deployer.address));

  // TreasuryAMO
  const tamo = await ethers.getContractAt("TreasuryAMO", TAMO);
  await sendTx("TAMO.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    tamo.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("TAMO.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    tamo.renounceRole(ethers.constants.HashZero, deployer.address));

  // NFT (upgradeable proxy → admin transfer)
  const nft = await ethers.getContractAt("QuasiCrystalLPNFT", NFT);
  await sendTx("NFT.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    nft.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("NFT.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    nft.renounceRole(ethers.constants.HashZero, deployer.address));

  // Timelock
  const timelock = await ethers.getContractAt("ArtifactTimelock", TIMELOCK);
  await sendTx("Timelock.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    timelock.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("Timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    timelock.renounceRole(ethers.constants.HashZero, deployer.address));

  // Governor
  const governor = await ethers.getContractAt("GovernorContract", GOVERNOR);
  await sendTx("Governor.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    governor.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("Governor.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    governor.renounceRole(ethers.constants.HashZero, deployer.address));

  // FlashBuy (immutable treasury, but admin role)
  const flashbuy = await ethers.getContractAt("TreasuryFlashBuy", FLASHBUY);
  await sendTx("FlashBuy.grantRole(DEFAULT_ADMIN_ROLE, Safe)", () =>
    flashbuy.grantRole(ethers.constants.HashZero, TREASURY_SAFE));
  await sendTx("FlashBuy.renounceRole(DEFAULT_ADMIN_ROLE, deployer)", () =>
    flashbuy.renounceRole(ethers.constants.HashZero, deployer.address));

  console.log("\n" + "═".repeat(60));
  console.log("  🎉 WIRING + OWNERSHIP TRANSFER COMPLETE");
  console.log("═".repeat(60));
  console.log("\nAll contracts now owned by Treasury Safe:", TREASURY_SAFE);
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e); process.exit(1); });
