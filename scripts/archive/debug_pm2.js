const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10); // ~0.01 ETH/Au
  
  console.log("token0:", token0, "(Au)");
  console.log("token1:", token1, "(WETH)");
  
  // Try 5-arg variant: createAndInitializePoolIfNecessary(address, address, uint24, int24, uint160)
  // fee=10000 (1%), tickSpacing=100
  const pm5 = new ethers.Contract(PM, [
    "function createAndInitializePoolIfNecessary(address, address, uint24, int24, uint160) returns (address)",
  ], ethers.provider);
  
  console.log("\n=== 5-arg variant (fee=10000, tickSpacing=100) ===");
  try {
    const result = await pm5.callStatic.createAndInitializePoolIfNecessary(token0, token1, 10000, 100, sqrtPriceX96);
    console.log("Result:", result);
  } catch(e) {
    console.log("Failed:", e.message.substring(0,200));
  }
  
  // Try different fee/tickSpacing combos
  const combos = [
    [500, 10],    // 0.05%
    [3000, 60],   // 0.3%
    [10000, 100], // 1%
    [10000, 200], // 1% wider
  ];
  
  for (const [fee, ts] of combos) {
    console.log(`\n=== fee=${fee}, tickSpacing=${ts} ===`);
    try {
      const result = await pm5.callStatic.createAndInitializePoolIfNecessary(token0, token1, fee, ts, sqrtPriceX96);
      console.log("Result:", result);
    } catch(e) {
      console.log("Failed:", e.reason || e.message.substring(0,100));
    }
  }
  
  // Also try the 4-arg variant with different tickSpacings
  const pm4 = new ethers.Contract(PM, [
    "function createAndInitializePoolIfNecessary(address, address, int24, uint160) returns (address)",
  ], ethers.provider);
  
  for (const ts of [1, 10, 50, 60, 100, 200]) {
    console.log(`\n=== 4-arg variant, tickSpacing=${ts} ===`);
    try {
      const result = await pm4.callStatic.createAndInitializePoolIfNecessary(token0, token1, ts, sqrtPriceX96);
      console.log("Result:", result);
    } catch(e) {
      console.log("Failed:", e.reason || e.message.substring(0,100));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
