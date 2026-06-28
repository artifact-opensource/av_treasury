const { ethers } = require("hardhat");
const FACTORY = "0x33128a8fC17869991970885ff98c4537d53e0E60"; // Uniswap V3 Factory on Base

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const factory = await ethers.getContractAt("IUniswapV3Factory", FACTORY);
  
  // Check existing pools
  const auWethPool = await factory.getPool(AU, WETH, 3000);
  const agWethPool = await factory.getPool(AG, WETH, 3000);
  const auAgPool = await factory.getPool(AU, AG, 3000);
  const auWethPool100 = await factory.getPool(AU, WETH, 100);
  
  console.log("AU/WETH 0.3% pool:", auWethPool);
  console.log("AG/WETH 0.3% pool:", agWethPool);
  console.log("AU/AG 0.3% pool:", auAgPool);
  console.log("AU/WETH 0.01% pool:", auWethPool100);
  
  // Check if pools have liquidity
  const pools = [auWethPool, agWethPool, auAgPool, auWethPool100].filter(p => p !== ethers.constants.AddressZero);
  for (const p of pools) {
    try {
      const pool = await ethers.getContractAt("IUniswapV3Pool", p);
      const slot0 = await pool.slot0();
      const liquidity = await pool.liquidity();
      console.log(`Pool ${p}: sqrtPrice=${slot0[0].toString().slice(0,20)}... liquidity=${liquidity.toString().slice(0,10)}...`);
    } catch(e) {}
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
