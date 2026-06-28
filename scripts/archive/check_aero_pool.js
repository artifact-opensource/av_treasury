const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const abi = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function tickSpacing() view returns (int24)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
  ];
  
  const pool = new ethers.Contract(POOL, abi, provider);
  
  try {
    const t0 = await pool.token0();
    const t1 = await pool.token1();
    console.log("Token0:", t0, t0.toLowerCase() === AU.toLowerCase() ? "(AU)" : t0.toLowerCase() === WETH.toLowerCase() ? "(WETH)" : "(unknown)");
    console.log("Token1:", t1, t1.toLowerCase() === AU.toLowerCase() ? "(AU)" : t1.toLowerCase() === WETH.toLowerCase() ? "(WETH)" : "(unknown)");
  } catch(e) { console.log("Token read error:", e.message.slice(0,60)); }
  
  try {
    const slot0 = await pool.slot0();
    console.log("Current tick:", slot0.tick.toString());
    console.log("SqrtPriceX96:", slot0.sqrtPriceX96.toString().slice(0, 20) + "...");
    console.log("Liquidity:", (await pool.liquidity()).toString());
    console.log("Fee:", (await pool.fee()).toString(), "bps");
    console.log("Tick spacing:", (await pool.tickSpacing()).toString());
  } catch(e) { console.log("Slot0 error:", e.message.slice(0,60)); }
  
  // Get TWAP
  try {
    const ticks = [60, 600, 1800]; // 1min, 10min, 30min
    const result = await pool.observe(ticks);
    console.log("\n=== TWAP Data ===");
    for (let i = 0; i < ticks.length; i++) {
      const tickCumulativeDelta = result[0][i];
      // Calculate average tick over period
      const avgTick = tickCumulativeDelta / ticks[i];
      console.log(`${ticks[i]}s: tickCumulative=${tickCumulativeDelta.toString()}, avgTick=${avgTick.toFixed(2)}`);
    }
  } catch(e) { console.log("TWAP error:", e.message.slice(0,60)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
