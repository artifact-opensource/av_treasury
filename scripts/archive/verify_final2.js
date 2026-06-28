const { ethers } = require("hardhat");
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

async function main() {
  // DexSim
  console.log("=== DexSimulator ===");
  const ds = await ethers.getContractAt("contracts/av_suite/DexSimulator.sol:DexSimulator", "0x2C1bD0e498cEA315dA7486a41FB3Dd991DA302B2");
  const dsA = await ds.tokenA();
  const dsB = await ds.tokenB();
  console.log("  tokenA:", dsA, dsA.toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  tokenB:", dsB, dsB.toLowerCase() === AG.toLowerCase() ? "✅" : "❌");

  // FlashLoan
  console.log("\n=== FlashLoan ===");
  const fl = await ethers.getContractAt("contracts/av_suite/FlashLoan.sol:FlashLoan", "0x0FAEF7e256eF86A5c04317Eaa91C58855565f58c");
  const flTreasury = await fl.treasury();
  console.log("  treasury:", flTreasury, flTreasury.toLowerCase() === SAFE.toLowerCase() ? "✅" : "❌");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
