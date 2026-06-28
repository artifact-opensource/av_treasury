const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const USDC = "0x833589cDFeD6a02960b44d12d7734C24e059c07e";
  
  // Check Slipstream factory for any AU pools
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  
  // Check the factory's code for getPool or poolFor
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function getPool(address, address, uint24) view returns (address)",
    "function getPool(address, address, bool) view returns (address)",
    "function poolFor(address, address, uint24) view returns (address)",
  ], ethers.provider);
  
  // Try different tick spacings for volatile (1, 10, 50, 100, 200)
  for (const ts of [1, 10, 50, 100, 200]) {
    try {
      const pool = await factory.getPool(AU, WETH, ts);
      if (pool !== ethers.constants.AddressZero) {
        console.log(`Au/ETH pool (tickSpacing=${ts}):`, pool);
      }
    } catch(e) {}
  }
  
  // Try stable
  try {
    const pool = await factory.getPool(AU, WETH, true);
    if (pool !== ethers.constants.AddressZero) {
      console.log("Au/ETH stable pool:", pool);
    }
  } catch(e) {}
  
  // Try USDC
  for (const ts of [1, 10, 50, 100, 200]) {
    try {
      const pool = await factory.getPool(AU, USDC, ts);
      if (pool !== ethers.constants.AddressZero) {
        console.log(`Au/USDC pool (tickSpacing=${ts}):`, pool);
      }
    } catch(e) {}
  }
  
  // Also check the V2 factory for any AU pools
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const v2factory = new ethers.Contract(V2_FACTORY, [
    "function getPool(address, address) view returns (address)",
    "function getPool(address, address, bool) view returns (address)",
  ], ethers.provider);
  
  try {
    const pool = await v2factory.getPool(AU, WETH);
    if (pool !== ethers.constants.AddressZero) console.log("\nV2 Au/ETH pool:", pool);
  } catch(e) {}
  
  try {
    const pool = await v2factory.getPool(AU, WETH, false);
    if (pool !== ethers.constants.AddressZero) console.log("V2 Au/ETH volatile pool:", pool);
  } catch(e) {}
  
  try {
    const pool = await v2factory.getPool(AU, USDC);
    if (pool !== ethers.constants.AddressZero) console.log("V2 Au/USDC pool:", pool);
  } catch(e) {}
  
  console.log("\nDone scanning.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
