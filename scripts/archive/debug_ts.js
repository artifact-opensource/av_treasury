const { ethers, network } = require("hardhat");

async function main() {
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  
  // Check the factory for enabled tick spacings
  // Slipstream uses enableTickSpacing(int24) and feeAmountTickSpacing(uint24)
  const factory = new ethers.Contract(FACTORY, [
    "function feeAmountTickSpacing(uint24) view returns (int24)",
    "function owner() view returns (address)",
  ], ethers.provider);
  
  console.log("Checking feeAmountTickSpacing mapping...");
  const feeAmounts = [100, 200, 500, 1000, 2500, 3000, 4000, 5000, 6000, 10000, 20000, 50000, 100000];
  for (const fee of feeAmounts) {
    try {
      const ts = await factory.feeAmountTickSpacing(fee);
      console.log(`  fee=${fee} (${fee/10000}%): tickSpacing=${ts}`);
    } catch(e) {
      console.log(`  fee=${fee}: not enabled`);
    }
  }
  
  // Also check existing pools to find valid tickSpacings
  const factory2 = new ethers.Contract(FACTORY, [
    "function allPoolsLength() view returns (uint256)",
    "function allPools(uint256) view returns (address)",
  ], ethers.provider);
  
  const poolCount = await factory2.allPoolsLength();
  console.log(`\nTotal pools: ${poolCount}`);
  
  // Sample pools to find tick spacings
  const tickSpacingSet = new Set();
  const pool = new ethers.Contract(ethers.constants.AddressZero, [
    "function tickSpacing() view returns (int24)",
  ], ethers.provider);
  
  // Check a spread of pools
  const indices = [0, 1, 2, 3, 4, 5, 10, 50, 100, 500, 1000, 2000, 3000];
  for (const i of indices) {
    if (i >= poolCount.toNumber()) continue;
    try {
      const poolAddr = await factory2.allPools(i);
      const poolInstance = pool.attach(poolAddr);
      const ts = await poolInstance.tickSpacing();
      tickSpacingSet.add(ts.toString());
    } catch(e) {}
  }
  
  console.log("Found tick spacings:", [...tickSpacingSet].sort((a,b) => a-b).join(", "));
  
  // Try createPool directly (not via Safe)
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10);
  
  const pm = new ethers.Contract(PM, [
    "function createPool(address, address, int24, uint160) payable returns (address)",
  ], ethers.provider);
  
  for (const ts of [1, 10, 50, 60, 100, 200]) {
    console.log(`\nTrying createPool with tickSpacing=${ts}...`);
    try {
      const result = await pm.callStatic.createPool(token0, token1, ts, sqrtPriceX96);
      console.log(`  ✅ Result: ${result}`);
    } catch(e) {
      console.log(`  ❌ Error: ${e.reason || e.message.substring(0,100)}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
