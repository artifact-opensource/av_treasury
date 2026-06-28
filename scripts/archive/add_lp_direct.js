const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  const isAuToken0 = token0 === AU;
  
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10); // 0.01 ETH/Au
  
  console.log("=".repeat(60));
  console.log("  CREATE AU/ETH POOL + ADD LP (direct deployer)");
  console.log("=".repeat(60));
  
  // Step 1: Create pool directly from deployer
  const pm = new ethers.Contract(PM, [
    "function createPool(address, address, int24, uint160) payable returns (address)",
    "function mint(tuple(address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  ], deployer);
  
  const TICK_SPACING = 100;
  
  // Check if pool exists
  const factory = new ethers.Contract(FACTORY, [
    "function getPool(address, address, int24) view returns (address)",
  ], ethers.provider);
  
  let poolAddress;
  try { poolAddress = await factory.getPool(token0, token1, TICK_SPACING); } catch(e) {}
  const poolExists = poolAddress && poolAddress !== ethers.constants.AddressZero;
  
  if (!poolExists) {
    console.log("\n  📦 Creating Au/ETH pool (tickSpacing=100)...");
    console.log(`  token0: ${token0} (${isAuToken0 ? "Au" : "WETH"})`);
    console.log(`  token1: ${token1} (${isAuToken0 ? "WETH" : "Au"})`);
    console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    
    try {
      const tx = await pm.createPool(token0, token1, TICK_SPACING, sqrtPriceX96, { gasLimit: 2000000 });
      const receipt = await tx.wait();
      console.log(`  ✅ Pool created! TX: ${tx.hash} (status: ${receipt.status})`);
      
      // Get pool address
      poolAddress = await factory.getPool(token0, token1, TICK_SPACING);
      console.log(`  Pool address: ${poolAddress}`);
    } catch(e) {
      console.log(`  ❌ createPool failed: ${e.reason || e.message.substring(0,200)}`);
      
      // Try with different tick spacings
      for (const ts of [1, 10, 50, 60, 200]) {
        console.log(`\n  Trying tickSpacing=${ts}...`);
        try {
          const tx = await pm.createPool(token0, token1, ts, sqrtPriceX96, { gasLimit: 2000000 });
          const receipt = await tx.wait();
          console.log(`  ✅ Pool created with tickSpacing=${ts}! TX: ${tx.hash}`);
          poolAddress = await factory.getPool(token0, token1, ts);
          console.log(`  Pool address: ${poolAddress}`);
          break;
        } catch(e2) {
          console.log(`  ❌ tickSpacing=${ts} failed: ${e2.reason || e2.message.substring(0,100)}`);
        }
      }
    }
  } else {
    console.log(`  Pool already exists: ${poolAddress}`);
  }
  
  if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
    console.log("\n  ❌ Could not create pool. Aborting.");
    process.exit(1);
  }
  
  // Step 2: Add liquidity
  // Calculate ticks for price range 0.0085 - 0.0115 ETH/Au
  const PRICE_LOWER = 0.0085;
  const PRICE_UPPER = 0.0115;
  
  let tickLower, tickUpper;
  if (isAuToken0) {
    tickLower = Math.floor(Math.log(PRICE_LOWER) / Math.log(1.0001));
    tickUpper = Math.ceil(Math.log(PRICE_UPPER) / Math.log(1.0001));
  } else {
    tickLower = Math.floor(Math.log(1 / PRICE_UPPER) / Math.log(1.0001));
    tickUpper = Math.ceil(Math.log(1 / PRICE_LOWER) / Math.log(1.0001));
  }
  tickLower = Math.floor(tickLower / TICK_SPACING) * TICK_SPACING;
  tickUpper = Math.ceil(tickUpper / TICK_SPACING) * TICK_SPACING;
  
  console.log(`\n  Tick lower: ${tickLower}, Tick upper: ${tickUpper}`);
  
  // One-sided: 100K Au, 0 WETH
  const AU_AMOUNT = ethers.utils.parseUnits("100000", 18);
  const amount0Desired = isAuToken0 ? AU_AMOUNT : 0;
  const amount1Desired = isAuToken0 ? 0 : AU_AMOUNT;
  
  // Approve PM to spend Au
  const auToken = await ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", AU);
  console.log("\n  📦 Approving AuToken for Position Manager...");
  const approveTx = await auToken.approve(PM, AU_AMOUNT);
  await approveTx.wait();
  console.log(`  ✅ Approved: ${approveTx.hash}`);
  
  // Mint position
  const block = await ethers.provider.getBlock("latest");
  const deadline = block.timestamp + 3600;
  
  console.log("\n  📦 Minting LP position (100K Au, one-sided)...");
  const mintParams = {
    token0, token1,
    tickSpacing: TICK_SPACING,
    tickLower, tickUpper,
    amount0Desired, amount1Desired,
    amount0Min: 0, amount1Min: 0,
    recipient: TREASURY,
    deadline,
  };
  
  try {
    const mintTx = await pm.mint(mintParams, { gasLimit: 2000000 });
    const receipt = await mintTx.wait();
    console.log(`  ✅ LP position minted! TX: ${mintTx.hash} (status: ${receipt.status})`);
    
    // Parse the Mint event to get tokenId
    const mintEvent = receipt.logs.find(log => {
      try {
        const iface = new ethers.utils.Interface([
          "event Mint(address sender, uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
        ]);
        iface.parseLog(log);
        return true;
      } catch(e) { return false; }
    });
    
    console.log("\n" + "=".repeat(60));
    console.log("  ✅ LP POSITION CREATED");
    console.log("=".repeat(60));
    console.log(`  Pool:     ${poolAddress}`);
    console.log(`  Range:    ${PRICE_LOWER} - ${PRICE_UPPER} ETH/Au`);
    console.log(`  Ticks:    ${tickLower} to ${tickUpper}`);
    console.log(`  Amount:   100,000 Au (one-sided)`);
    console.log(`  Owner:    ${TREASURY}`);
    console.log("=".repeat(60));
  } catch(e) {
    console.log(`  ❌ Mint failed: ${e.reason || e.message.substring(0,200)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
