const { ethers, network } = require("hardhat");
async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  
  // Try different positions() signatures
  // Aerodrome Slipstream uses tickSpacing instead of fee
  const pm = new ethers.Contract(PM, [
    "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  ], ethers.provider);
  
  for (const id of [1, 100, 21692246]) {
    try {
      const pos = await pm.positions(id);
      console.log(`Position ${id}:`);
      console.log(`  nonce: ${pos.nonce}`);
      console.log(`  token0: ${pos.token0}`);
      console.log(`  token1: ${pos.token1}`);
      console.log(`  tickSpacing: ${pos.tickSpacing}`);
      console.log(`  tickLower: ${pos.tickLower}`);
      console.log(`  tickUpper: ${pos.tickUpper}`);
      console.log(`  liquidity: ${pos.liquidity.toString()}`);
    } catch(e) {
      console.log(`Position ${id}: failed - ${(e.reason || e.message).substring(0,80)}`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
