const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Try getTwapPrice directly with a specific twap duration
  const abi = [
    "function getTwapPrice(address token, uint256 twapDuration) view returns (uint256)",
    "function twapPools(address) view returns (tuple(address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget))",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  const pool = await oracle.twapPools(AU);
  console.log("Pool configured:", pool.pool, "token0IsTarget:", pool.token0IsTarget, "twapDuration:", pool.twapDuration.toString());
  
  // Try with different durations
  for (const dur of [60, 300, 600, 1800]) {
    try {
      const price = await oracle.getTwapPrice(AU, dur);
      console.log(`getTwapPrice(AU, ${dur}s):`, price.toString(), "→ $", ethers.utils.formatUnits(price, 18));
    } catch(e) {
      console.log(`getTwapPrice(AU, ${dur}s): REVERT`, e.message.slice(0, 100));
    }
  }
  
  // Try the internal _observePool by calling observe on the pool directly
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const poolAbi = ["function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)"];
  const pool = new ethers.Contract(POOL, poolAbi, ethers.provider);
  
  try {
    const result = await pool.observe([60, 600]);
    console.log("\nPool observe() works:", result[0].map(r => r.toString()));
  } catch(e) {
    console.log("\nPool observe() failed:", e.message.slice(0, 80));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
