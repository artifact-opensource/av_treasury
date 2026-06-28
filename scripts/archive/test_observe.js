const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const pool = new ethers.Contract(
    POOL,
    ["function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)"],
    ethers.provider
  );
  
  // This is what the oracle does: observe([600, 0])
  try {
    const [tc] = await pool.observe([600, 0]);
    console.log("✅ observe([600, 0]) works:", tc.map(t => t.toString()));
  } catch(e) {
    console.log("❌ observe([600, 0]) reverted:", e.message.slice(0, 200));
    
    // Try smaller values
    for (const dur of [1, 10, 60, 300]) {
      try {
        const [tc] = await pool.observe([dur, 0]);
        console.log(`✅ observe([${dur}, 0]) works:`, tc.map(t => t.toString()));
        break;
      } catch(e2) {
        console.log(`❌ observe([${dur}, 0]) reverted`);
      }
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
