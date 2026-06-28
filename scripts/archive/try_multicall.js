const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  
  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  const isAuToken0 = token0 === AU;
  
  console.log("=".repeat(60));
  console.log("  TRYING V2 AMM (not Slipstream) FOR LP");
  console.log("=".repeat(60));
  
  // Check V2 Factory
  const v2Factory = new ethers.Contract(V2_FACTORY, [
    "function allPoolsLength() view returns (uint256)",
    "function router() view returns (address)",
    "function voter() view returns (address)",
    "function getPool(address, address, bool) view returns (address)",
  ], ethers.provider);
  
  console.log("V2 pool count:", (await v2Factory.allPoolsLength()).toString());
  
  let v2Router;
  try { v2Router = await v2Factory.router(); console.log("V2 Router:", v2Router); } catch(e) { console.log("V2 router() failed"); }
  try { v2Router = await v2Factory.voter(); console.log("V2 Voter:", v2Router); } catch(e) {}
  
  // Check if Au/ETH pool exists on V2
  try {
    const pool = await v2Factory.getPool(token0, token1, true); // stable=false
    console.log("V2 Au/ETH (volatile) pool:", pool);
  } catch(e) { console.log("getPool failed:", e.message.substring(0,80)); }
  
  try {
    const pool = await v2Factory.getPool(token0, token1, false); // stable=true
    console.log("V2 Au/ETH (stable) pool:", pool);
  } catch(e) { console.log("getPool(stable) failed:", e.message.substring(0,80)); }
  
  // Check the router interface
  if (v2Router) {
    const routerCode = await ethers.provider.getCode(v2Router);
    console.log("V2 Router code length:", routerCode.length);
    
    // Try the standard Velodrome V2 Router interface
    const router = new ethers.Contract(v2Router, [
      "function addLiquidity(address, address, bool, uint256, uint256, uint256, uint256, address, uint256) returns (uint256, uint256, uint256)",
      "function WETH() view returns (address)",
      "function defaultFactory() view returns (address)",
    ], ethers.provider);
    
    try { console.log("Router WETH:", await router.WETH()); } catch(e) { console.log("WETH failed"); }
    try { console.log("Router defaultFactory:", await router.defaultFactory()); } catch(e) { console.log("defaultFactory failed"); }
  }
  
  // Actually, let me try the Slipstream with multicall pattern
  // Real Aerodrome transactions use multicall to batch createPool + mint
  console.log("\n" + "=".repeat(60));
  console.log("  TRYING MULTICALL PATTERN");
  console.log("=".repeat(60));
  
  const pm = new ethers.Contract(PM, [
    "function createPool(address, address, int24, uint160) payable returns (address)",
    "function mint(tuple(address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    "function multicall(bytes[]) payable returns (bytes[])",
  ], deployer);
  
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10);
  
  // Calculate ticks
  const PRICE_LOWER = 0.0085;
  const PRICE_UPPER = 0.0115;
  const TICK_SPACING = 100;
  
  let tickLower = Math.floor(Math.log(PRICE_LOWER) / Math.log(1.0001));
  let tickUpper = Math.ceil(Math.log(PRICE_UPPER) / Math.log(1.0001));
  tickLower = Math.floor(tickLower / TICK_SPACING) * TICK_SPACING;
  tickUpper = Math.ceil(tickUpper / TICK_SPACING) * TICK_SPACING;
  
  const AU_AMOUNT = ethers.utils.parseUnits("100000", 18);
  const amount0Desired = isAuToken0 ? AU_AMOUNT : 0;
  const amount1Desired = isAuToken0 ? 0 : AU_AMOUNT;
  
  const block = await ethers.provider.getBlock("latest");
  const deadline = block.timestamp + 3600;
  
  // Build calldatas
  const createPoolData = pm.interface.encodeFunctionData("createPool", [
    token0, token1, TICK_SPACING, sqrtPriceX96
  ]);
  
  const mintData = pm.interface.encodeFunctionData("mint", [{
    token0, token1,
    tickSpacing: TICK_SPACING,
    tickLower, tickUpper,
    amount0Desired, amount1Desired,
    amount0Min: 0, amount1Min: 0,
    recipient: deployerAddress,
    deadline,
  }]);
  
  // Try multicall with both createPool + mint
  console.log("\n  Trying multicall([createPool, mint])...");
  try {
    const tx = await pm.multicall([createPoolData, mintData], { gasLimit: 5000000 });
    const receipt = await tx.wait();
    console.log(`  ✅ Multicall succeeded! TX: ${tx.hash} (status: ${receipt.status})`);
    console.log("  Gas used:", receipt.gasUsed.toString());
  } catch(e) {
    console.log(`  ❌ Multicall failed: ${e.reason || e.message.substring(0,200)}`);
  }
  
  // Also try just createPool alone (not via Safe)
  console.log("\n  Trying createPool alone...");
  try {
    const tx = await pm.createPool(token0, token1, TICK_SPACING, sqrtPriceX96, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log(`  ✅ createPool succeeded! TX: ${tx.hash}`);
  } catch(e) {
    console.log(`  ❌ createPool failed: ${e.reason || e.message.substring(0,200)}`);
    
    // Try to get more info via debug_traceTransaction
    console.log("\n  Trying eth_call simulation...");
    try {
      await ethers.provider.call({
        from: deployerAddress,
        to: PM,
        data: createPoolData,
        gasLimit: ethers.utils.hexlify(2000000),
      });
    } catch(e2) {
      console.log(`  Simulation error: ${e2.reason || e2.message.substring(0,200)}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
