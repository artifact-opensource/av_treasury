const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  
  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  console.log("token0 (Au):", token0);
  console.log("token1 (WETH):", token1);
  
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10); // 0.01 ETH/Au
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  
  // Try calling createAndInitializePoolIfNecessary directly
  const pm = new ethers.Contract(PM, [
    "function createAndInitializePoolIfNecessary(address, address, int24, uint160) payable returns (address)",
  ], deployer);
  
  // Try different tick spacings
  for (const ts of [1, 10, 50, 60, 100, 200]) {
    console.log(`\n--- tickSpacing=${ts} ---`);
    try {
      const result = await pm.callStatic.createAndInitializePoolIfNecessary(token0, token1, ts, sqrtPriceX96);
      console.log("✅ Result:", result);
    } catch(e) {
      const reason = e.reason || e.error?.message || e.message.substring(0, 200);
      console.log("❌ Error:", reason);
      // Try to decode custom error
      if (e.data && e.data !== "0x") {
        console.log("Error data:", e.data);
      }
    }
  }
  
  // Also try with the factory directly
  console.log("\n\n=== Trying factory.getPool ===");
  const factory = new ethers.Contract(FACTORY, [
    "function getPool(address, address, int24) view returns (address)",
  ], ethers.provider);
  
  for (const ts of [1, 10, 50, 60, 100, 200]) {
    try {
      const pool = await factory.getPool(token0, token1, ts);
      console.log(`tickSpacing=${ts}: pool=${pool}`);
    } catch(e) {
      console.log(`tickSpacing=${ts}: failed - ${e.message.substring(0,80)}`);
    }
  }
  
  // Check what the PM's factory() returns
  const pmInfo = new ethers.Contract(PM, [
    "function factory() view returns (address)",
    "function owner() view returns (address)",
  ], ethers.provider);
  
  console.log("\nPM factory:", await pmInfo.factory());
  console.log("PM owner:", await pmInfo.owner());
  
  // Check the factory for feeAmountTickSpacing mapping
  const factoryFull = new ethers.Contract(FACTORY, [
    "function feeAmountTickSpacing(uint24) view returns (int24)",
    "function owner() view returns (address)",
  ], ethers.provider);
  
  console.log("\nFactory owner:", await factoryFull.owner());
  for (const fee of [100, 500, 1000, 2500, 3000, 10000]) {
    try {
      const ts = await factoryFull.feeAmountTickSpacing(fee);
      console.log(`fee=${fee} (${fee/10000}%): tickSpacing=${ts}`);
    } catch(e) {}
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
