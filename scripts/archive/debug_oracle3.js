const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Let's try calling getTwapPrice with 0 duration (should fail differently)
  // And also try calling the internal functions via external wrappers
  
  // First, let's get the pool info
  const poolAbi = [
    "function twapPools(address) view returns (tuple(address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget))",
  ];
  const oracle = new ethers.Contract(ORACLE, poolAbi, ethers.provider);
  const poolInfo = await oracle.twapPools(AU);
  
  // The issue might be: getTwapPrice uses pool.twapDuration as the duration
  // but the pool was configured with twapDuration=600
  // Let's try calling with the EXACT configured duration
  const fullAbi = [
    "function getTwapPrice(address token, uint256 customDuration) view returns (uint256)",
  ];
  const oracleFull = new ethers.Contract(ORACLE, fullAbi, ethers.provider);
  
  // Try with the exact configured duration
  try {
    const price = await oracleFull.getTwapPrice(AU, poolInfo.twapDuration);
    console.log("✅ getTwapPrice with configured duration:", price.toString());
  } catch(e) {
    console.log("❌ getTwapPrice with configured duration:", e.reason || e.data || e.message.slice(0,120));
  }
  
  // Try with 1 (minimum)
  try {
    const price = await oracleFull.getTwapPrice(AU, 1);
    console.log("✅ getTwapPrice(AU, 1):", price.toString());
  } catch(e) {
    console.log("❌ getTwapPrice(AU, 1):", e.reason || e.data || e.message.slice(0,120));
  }
  
  // The revert might be from timeElapsed being 0 when block.timestamp == twatvlLastUpdate
  // Let's check twatvlLastUpdate
  const stateAbi = ["function twatvlLastUpdate() view returns (uint256)"];
  const oracleState = new ethers.Contract(ORACLE, stateAbi, ethers.provider);
  const lastUpdate = await oracleState.twatvlLastUpdate();
  console.log("\ntwatvlLastUpdate:", lastUpdate.toString());
  console.log("Current block timestamp:", (await ethers.provider.getBlock()).timestamp);
  
  // If twatvlLastUpdate is 0, the first call initializes it
  // After that, subsequent calls need timeElapsed > 0
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
