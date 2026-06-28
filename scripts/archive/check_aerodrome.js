const { ethers, network } = require("hardhat");

async function main() {
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Check an existing Slipstream pool
  const pool0 = new ethers.Contract("0x98c7A2338336d2d354663246F64676009c7bDa97", [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function tickSpacing() view returns (int24)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint24 fee, int24 tickSpacing, uint16 protocolFee, bool unlocked)",
    "function factory() view returns (address)",
  ], ethers.provider);
  
  try { console.log("Pool0 token0:", await pool0.token0()); } catch(e) { console.log("token0 failed:", e.message.substring(0,60)); }
  try { console.log("Pool0 token1:", await pool0.token1()); } catch(e) { console.log("token1 failed:", e.message.substring(0,60)); }
  try { console.log("Pool0 fee:", (await pool0.fee()).toString()); } catch(e) { console.log("fee failed:", e.message.substring(0,60)); }
  try { console.log("Pool0 tickSpacing:", (await pool0.tickSpacing()).toString()); } catch(e) { console.log("tickSpacing failed:", e.message.substring(0,60)); }
  try { 
    const slot0 = await pool0.slot0();
    console.log("Pool0 sqrtPriceX96:", slot0.sqrtPriceX96.toString());
    console.log("Pool0 tick:", slot0.tick.toString());
    console.log("Pool0 fee:", slot0.fee.toString());
    console.log("Pool0 tickSpacing:", slot0.tickSpacing.toString());
  } catch(e) { console.log("slot0 failed:", e.message.substring(0,60)); }
  try { console.log("Pool0 factory:", await pool0.factory()); } catch(e) { console.log("factory failed:", e.message.substring(0,60)); }
  
  // Now find the NonfungiblePositionManager
  // In Slipstream (Uniswap V3 fork), it's usually deployed alongside the factory
  // Common pattern: search for it via the factory owner or by checking known addresses
  
  // The Aerodrome Slipstream was deployed by 0xE6A41fE61E7a1996B59d508661e3f524d6A32075
  // Let me check the Slipstream Factory for more methods
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function owner() view returns (address)",
    "function implementation() view returns (address)",
    // Slipstream-specific
    "function POOL_IMPLEMENTATION() view returns (address)",
    "function POSITION_MANAGER() view returns (address)",
    "function positionManager() view returns (address)",
    "function swapRouter() view returns (address)",
    "function quoter() view returns (address)",
  ], ethers.provider);
  
  try { console.log("\nFactory POSITION_MANAGER:", await factory.POSITION_MANAGER()); } catch(e) { console.log("POSITION_MANAGER failed"); }
  try { console.log("Factory positionManager:", await factory.positionManager()); } catch(e) { console.log("positionManager failed"); }
  try { console.log("Factory swapRouter:", await factory.swapRouter()); } catch(e) { console.log("swapRouter failed"); }
  try { console.log("Factory quoter:", await factory.quoter()); } catch(e) { console.log("quoter failed"); }
  try { console.log("Factory POOL_IMPLEMENTATION:", await factory.POOL_IMPLEMENTATION()); } catch(e) { console.log("POOL_IMPLEMENTATION failed"); }
  
  // Let me also check the V2 factory for the router
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const v2Factory = new ethers.Contract(V2_FACTORY, [
    "function router() view returns (address)",
    "function defaultRouter() view returns (address)",
    "function allPoolsLength() view returns (uint256)",
  ], ethers.provider);
  
  try { console.log("\nV2 defaultRouter:", await v2Factory.defaultRouter()); } catch(e) { console.log("defaultRouter failed"); }
  try { console.log("V2 router:", await v2Factory.router()); } catch(e) { console.log("router failed"); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
