const { ethers, network } = require("hardhat");

async function main() {
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  
  // Get the V2 Router address
  const factory = new ethers.Contract(V2_FACTORY, [
    "function allPoolsLength() view returns (uint256)",
    "function router() view returns (address)",
    "function voter() view returns (address)",
  ], ethers.provider);
  
  const router = await factory.router();
  const voter = await factory.voter();
  console.log("V2 Router:", router);
  console.log("V2 Voter:", voter);
  
  // Check the router interface
  const routerCode = await ethers.provider.getCode(router);
  console.log("Router code length:", routerCode.length);
  
  // Scan for function selectors in the router
  const foundSelectors = new Set();
  const codeLower = routerCode.toLowerCase();
  for (let i = 0; i < codeLower.length - 10; i += 2) {
    if (codeLower.substring(i, i + 2) === '63') {
      const sel = codeLower.substring(i + 2, i + 10);
      if (sel !== 'ffffffff' && sel !== '00000000') {
        foundSelectors.add(sel);
      }
    }
  }
  
  // Check key selectors
  const important = {
    "addLiquidity": "88316456", // addLiquidity(address,address,bool,uint256,uint256,uint256,uint256,address,uint256)
    "addLiquidity2": "e8ea3a57", // alternative
    "swapExactTokensForTokens": "38ed1739",
    "getAmountsOut": "d9ca4125",
    "WETH": "ad5c4648",
    "factory": "c45a0155",
  };
  
  console.log("\nRouter function selectors:");
  for (const [name, sel] of Object.entries(important)) {
    console.log(`  ${name} (0x${sel}): ${foundSelectors.has(sel) ? "✅" : "❌"}`);
  }
  
  // Try the standard Velodrome V2 Router interface
  const routerContract = new ethers.Contract(router, [
    "function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
    "function WETH() view returns (address)",
    "function factory() view returns (address)",
  ], ethers.provider);
  
  try { console.log("\nRouter WETH:", await routerContract.WETH()); } catch(e) { console.log("WETH failed:", e.message.substring(0,60)); }
  try { console.log("Router factory:", await routerContract.factory()); } catch(e) { console.log("factory failed:", e.message.substring(0,60)); }
  
  // Check if Au/ETH pool exists on V2
  // Velodrome V2 uses getPool(address, address, bool)
  const factoryFull = new ethers.Contract(V2_FACTORY, [
    "function getPool(address, address, bool) view returns (address)",
  ], ethers.provider);
  
  try {
    const pool = await factoryFull.getPool(AU, WETH, false); // volatile
    console.log("\nAu/ETH volatile pool:", pool);
  } catch(e) { console.log("getPool(volatile) failed:", e.message.substring(0,80)); }
  
  try {
    const pool = await factoryFull.getPool(AU, WETH, true); // stable
    console.log("Au/ETH stable pool:", pool);
  } catch(e) { console.log("getPool(stable) failed:", e.message.substring(0,80)); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
