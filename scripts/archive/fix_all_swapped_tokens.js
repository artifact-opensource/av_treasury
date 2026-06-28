const { ethers } = require("hardhat");
const fs = require("fs");

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

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
  
  // ═══════════════════════════════════════════════════
  // FIX 1: Staking — needs re-initialize with correct tokens
  // Current: auToken=AG, agToken=NFT, lpNFT=SAFE
  // Should be: auToken=AU, agToken=AG, lpNFT=NFT
  // ═══════════════════════════════════════════════════
  console.log("\n═══ FIX 1: Staking — Re-initialize ═══");
  const staking = await ethers.getContractAt("AVLPStaking_v2", "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3");
  
  // Check current state
  const curAu = await staking.auToken();
  const curAg = await staking.agToken();
  const curNFT = await staking.lpNFT();
  console.log(`  Current auToken: ${curAu} (should be ${AU})`);
  console.log(`  Current agToken: ${curAg} (should be ${AG})`);
  console.log(`  Current lpNFT:   ${curNFT} (should be ${NFT})`);
  
  const needsFix = curAu.toLowerCase() !== AU.toLowerCase() || 
                   curAg.toLowerCase() !== AG.toLowerCase() ||
                   curNFT.toLowerCase() !== NFT.toLowerCase();
  
  if (needsFix) {
    await sendTx("Staking.initialize(AU, AG, NFT)", () =>
      staking.initialize(AU, AG, NFT));
  } else {
    console.log("  ✅ Already correct");
  }

  // ═══════════════════════════════════════════════════
  // FIX 2: TreasuryFlashBuy — tokens swapped
  // Constructor: (dex, treasury, agToken, auToken)
  // Deployed with agToken=AU, auToken=AG (swapped)
  // Cannot fix — immutable. Must redeploy.
  // ═══════════════════════════════════════════════════
  console.log("\n═══ FIX 2: TreasuryFlashBuy — REDEPLOY (immutable swap) ═══");
  const FB = await ethers.getContractFactory("TreasuryFlashBuy");
  const fb = await FB.deploy(ROUTER, SAFE, AG, AU); // correct order
  await fb.deployed();
  console.log(`  ✅ New FlashBuy: ${fb.address}`);
  
  // Save new address
  const FILE = require("path").join(__dirname, "..", "deployed_stack.json");
  const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  d.TreasuryFlashBuy = { proxy: fb.address, impl: fb.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // Verify
  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", {
      address: fb.address,
      constructorArguments: [ROUTER, SAFE, AG, AU]
    });
    console.log("  ✅ New FlashBuy verified");
    d.TreasuryFlashBuy.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch(e) {
    console.log("  ⚠️ Verify:", e.message.split('\n')[0]);
  }

  // ═══════════════════════════════════════════════════
  // FIX 3: AvOracle — tokens swapped, no price feeds
  // Constructor: (_auToken, _agToken, _admin, _governor)
  // Deployed with auToken=AG, agToken=AU (swapped)
  // Cannot fix — needs re-deploy or storage manipulation
  // ═══════════════════════════════════════════════════
  console.log("\n═══ FIX 3: AvOracle — REDEPLOY (immutable swap + add feeds) ═══");
  const ORACLE = "0x39E7A01da3fD73df7eED92a52F82237a381A01FE";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  
  // Check if we can fix via admin (storage write)
  const oracle = await ethers.getContractAt("AvOracle", ORACLE);
  const hasAdmin = await oracle.hasRole(ethers.constants.HashZero, deployer.address);
  
  if (hasAdmin) {
    console.log("  Deployer has admin — can fix in-place");
    // Check what storage slots need fixing
    const slot0 = await ethers.provider.getStorageAt(ORACLE, 0);
    const slot1 = await ethers.provider.getStorageAt(ORACLE, 1);
    console.log(`  slot[0]: ${slot0}`);
    console.log(`  slot[1]: ${slot1}`);
    
    // Try to call admin functions to fix
    // Check if there's a setTokens or similar
    const oracleAbi = JSON.parse(fs.readFileSync(
      "artifacts/contracts/av_suite/AvOracle.sol/AvOracle.json", "utf-8")).abi;
    const oracleFns = oracleAbi.filter(i => i.type === "function").map(i => i.name);
    const fixFns = oracleFns.filter(n => /set|update|config|add|replace|write/i.test(n));
    console.log("  Available fix functions:", fixFns.join(", "));
  } else {
    console.log("  Deployer has no admin — need redeploy");
    const OracleFac = await ethers.getContractFactory("AvOracle");
    const newOracle = await OracleFac.deploy(AU, AG, SAFE, GOVERNOR);
    await newOracle.deployed();
    console.log(`  ✅ New Oracle: ${newOracle.address}`);
    
    d.AvOracle = { proxy: newOracle.address, impl: newOracle.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    
    await new Promise(r => setTimeout(r, 30000));
    try {
      await require("hardhat").run("verify:verify", {
        address: newOracle.address,
        constructorArguments: [AU, AG, SAFE, GOVERNOR]
      });
      console.log("  ✅ New Oracle verified");
      d.AvOracle.verified = true;
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    } catch(e) {
      console.log("  ⚠️ Verify:", e.message.split('\n')[0]);
    }
  }

  // ═══════════════════════════════════════════════════
  // FIX 4: DexSimulator — tokens swapped
  // Constructor: (_tokenA, _tokenB)
  // Deployed with (AG, AU) — may or may not matter depending on usage
  // ═══════════════════════════════════════════════════
  console.log("\n═══ FIX 4: DexSimulator — REDEPLOY (swapped tokens) ═══");
  const DS = "0xED29f07E7b6F017619D83FD55DA673eE648c613c";
  const dsContract = await ethers.getContractAt("DexSimulator", DS);
  const hasAdminDS = await dsContract.hasRole(ethers.constants.HashZero, deployer.address);
  
  if (hasAdminDS) {
    console.log("  Deployer has admin — checking if fixable in-place");
    const dsAbi = JSON.parse(fs.readFileSync(
      "artifacts/contracts/av_suite/DexSimulator.sol/DexSimulator.json", "utf-8")).abi;
    const dsFns = dsAbi.filter(i => i.type === "function").map(i => i.name);
    console.log("  DexSimulator functions:", dsFns.join(", "));
  } else {
    console.log("  Deployer has no admin — redeploying");
    const DS_Fac = await ethers.getContractFactory("DexSimulator");
    const newDS = await DS_Fac.deploy(AU, AG);
    await newDS.deployed();
    console.log(`  ✅ New DexSimulator: ${newDS.address}`);
    
    d.DexSimulator = { proxy: newDS.address, impl: newDS.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    
    await new Promise(r => setTimeout(r, 30000));
    try {
      await require("hardhat").run("verify:verify", {
        address: newDS.address,
        constructorArguments: [AU, AG]
      });
      console.log("  ✅ New DexSimulator verified");
      d.DexSimulator.verified = true;
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    } catch(e) {
      console.log("  ⚠️ Verify:", e.message.split('\n')[0]);
    }
  }

  // ═══════════════════════════════════════════════════
  // FIX 5: PID Controller — check if it needs wiring
  // ═══════════════════════════════════════════════════
  console.log("\n═══ FIX 5: PID Controller — Check state ═══");
  const PID = "0xB8F240870DBc1cD5F9262F8180350A29ea404268";
  const pid = await ethers.getContractAt("PID_Emission_Controller_v2", PID);
  
  const pidAbi = JSON.parse(fs.readFileSync(
    "artifacts/contracts/av_suite/PID_Emission_Controller_v2.sol/PID_Emission_Controller_v2.json", "utf-8")).abi;
  const pidFns = pidAbi.filter(i => i.type === "function").map(i => i.name);
  console.log("  PID functions:", pidFns.join(", "));
  
  // Check key state vars
  for (const fn of ["treasuryAMO", "stakingContract", "targetTVL", "bootstrapActive", "auToken", "agToken"]) {
    try {
      const r = await pid[fn]();
      console.log(`  ${fn} = ${r}`);
    } catch(e) {}
  }

  console.log("\n" + "═".repeat(60));
  console.log("  FIX BATCH COMPLETE");
  console.log("═".repeat(60));
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e); process.exit(1); });
