const { ethers } = require("hardhat");

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

async function main() {
  const results = {};

  // 1. Staking
  console.log("=== 1. Staking ===");
  const staking = await ethers.getContractAt("AVLPStaking_v2", "0x8F638B6C2ebD61A638561B6993930cf25d53Acb9");
  const sAu = await staking.auToken();
  const sAg = await staking.agToken();
  const sNFT = await staking.lpNFT();
  console.log("  auToken:", sAu, sAu.toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  agToken:", sAg, sAg.toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
  console.log("  lpNFT:", sNFT, sNFT.toLowerCase() === NFT.toLowerCase() ? "✅" : "❌");
  results.staking = sAu === AU && sAg === AG && sNFT === NFT;

  // 2. FlashBuy
  console.log("\n=== 2. FlashBuy ===");
  const fb = await ethers.getContractAt("TreasuryFlashBuy", "0x99E6C7c215138084B2F21D6c574b9e5b69E2c074");
  const fbAg = await fb.agToken();
  const fbAu = await fb.auToken();
  const fbTreasury = await fb.treasury();
  console.log("  agToken:", fbAg, fbAg.toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
  console.log("  auToken:", fbAu, fbAu.toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  treasury:", fbTreasury, fbTreasury.toLowerCase() === SAFE.toLowerCase() ? "✅" : "❌");
  results.flashbuy = fbAg === AG && fbAu === AU && fbTreasury === SAFE;

  // 3. Oracle
  console.log("\n=== 3. Oracle ===");
  const oracle = await ethers.getContractAt("AvOracle", "0x6B68B65D063C13C0da7a26968f1086f59c533654");
  const oAu = await oracle.auToken();
  const oAg = await oracle.agToken();
  console.log("  auToken:", oAu, oAu.toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  agToken:", oAg, oAg.toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
  results.oracle = oAu === AU && oAg === AG;

  // 4. DexSim
  console.log("\n=== 4. DexSimulator ===");
  const ds = await ethers.getContractAt("DexSimulator", "0x2C1bD0e498cEA315dA7486a41FB3Dd991DA302B2");
  const dsA = await ds.tokenA();
  const dsB = await ds.tokenB();
  console.log("  tokenA:", dsA, dsA.toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  tokenB:", dsB, dsB.toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
  results.dexsim = dsA === AU && dsB === AG;

  // 5. FlashLoan
  console.log("\n=== 5. FlashLoan ===");
  const fl = await ethers.getContractAt("FlashLoan", "0x0FAEF7e256eF86A5c04317Eaa91C58855565f58c");
  const flAu = fl.auToken ? "skip" : "skip";
  const flTreasury = await fl.treasury();
  const flDex = await fl.dex();
  console.log("  treasury:", flTreasury, flTreasury.toLowerCase() === SAFE.toLowerCase() ? "✅" : "❌");
  console.log("  dex:", flDex);
  results.flashloan = flTreasury === SAFE;

  console.log("\n" + "═".repeat(50));
  console.log("  VERIFICATION SUMMARY");
  console.log("═".repeat(50));
  for (const [name, ok] of Object.entries(results)) {
    console.log(`  ${ok ? "✅" : "❌"} ${name}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
