const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const abi = [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  ];
  const pool = new ethers.Contract(POOL, abi, ethers.provider);
  const slot0 = await pool.slot0();
  console.log("observationCardinality:", slot0.observationCardinality.toString());
  console.log("observationCardinalityNext:", slot0.observationCardinalityNext.toString());
  console.log("Current tick:", slot0.tick.toString());
  
  // The pool was recently created, so cardinality is probably low (64 or similar)
  // If twatvlLastUpdate = 0, timeElapsed = block.timestamp ≈ 1.78 billion seconds
  // But the pool only has observations for maybe the last few hours
  // This would cause observe() to revert!
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
