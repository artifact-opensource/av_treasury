const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const pool = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  ], ethers.provider);
  
  const slot0 = await pool.slot0();
  console.log("observationCardinality:", slot0.observationCardinality.toString());
  console.log("observationCardinalityNext:", slot0.observationCardinalityNext.toString());
  console.log("observationIndex:", slot0.observationIndex.toString());
  
  // Now try observe with different durations
  // If cardinality is low, only short durations work
  const poolWithObserve = new ethers.Contract(POOL, [
    "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
  ], ethers.provider);
  
  for (const dur of [1, 5, 10, 30, 60, 120, 300, 600, 1800]) {
    try {
      const [tc] = await poolWithObserve.observe([dur, 0]);
      console.log(`observe([${dur}, 0]): ✅ delta=${tc[0].sub(tc[1]).toString()}`);
    } catch(e) {
      console.log(`observe([${dur}, 0]): ❌ revert`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
