const { ethers, network } = require("hardhat");

async function main() {
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  
  // Check what tick spacings exist by looking at existing pools
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function allPoolsLength() view returns (uint256)",
    "function allPools(uint256) view returns (address)",
    "function getPool(address, address, int24) view returns (address)",
    "function owner() view returns (address)",
    // Try fee/tickSpacing mappings
    "function feeAmountTickSpacing(uint24) view returns (int24)",
    "function feeAmounts(uint24) view returns (bool)",
  ], ethers.provider);
  
  // Check which fee amounts are enabled
  const feeAmounts = [100, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 50000];
  console.log("Checking fee amounts and tick spacings...");
  for (const fee of feeAmounts) {
    try {
      const tickSpacing = await factory.feeAmountTickSpacing(fee);
      console.log(`  Fee ${fee} (${fee/10000}%): tickSpacing = ${tickSpacing}`);
    } catch(e) {
      // Not enabled
    }
  }
  
  // Check existing pools for their tick spacings
  const poolCount = await factory.allPoolsLength();
  console.log(`\nTotal pools: ${poolCount}`);
  
  // Sample some pools to see tick spacings
  const pool = new ethers.Contract(ethers.constants.AddressZero, [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function tickSpacing() view returns (int24)",
    "function slot0() view returns (uint160, int24, uint24, int24, uint16, bool)",
  ], ethers.provider);
  
  for (let i = 0; i < Math.min(5, poolCount.toNumber()); i++) {
    const poolAddr = await factory.allPools(i);
    const poolInstance = pool.attach(poolAddr);
    try {
      const slot0 = await poolInstance.slot0();
      const ts = await poolInstance.tickSpacing();
      console.log(`  Pool ${i} (${poolAddr}): tickSpacing=${ts}, fee=${slot0.fee}`);
    } catch(e) {
      console.log(`  Pool ${i} (${poolAddr}): read failed`);
    }
  }
  
  // Also check the Position Manager's createAndInitializePoolIfNecessary function
  // Maybe it takes a different fee parameter format
  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function createAndInitializePoolIfNecessary(address, address, int24, uint160) returns (address)",
    "function owner() view returns (address)",
    "function WETH() view returns (address)",
    "function factory() view returns (address)",
  ], ethers.provider);
  
  try { console.log("\nPosition Manager factory:", await pm.factory()); } catch(e) { console.log("PM factory failed:", e.message.substring(0,80)); }
  try { console.log("Position Manager owner:", await pm.owner()); } catch(e) { console.log("PM owner failed:", e.message.substring(0,80)); }
  try { console.log("Position Manager WETH:", await pm.WETH()); } catch(e) { console.log("PM WETH failed:", e.message.substring(0,80)); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
