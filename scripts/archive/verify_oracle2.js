const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  const abi = [
    "function twapPools(address) view returns (address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function getTwapPrice(address token) view returns (uint256)",
    "function getPrice(address token) view returns (uint256 price, uint8 decimals)",
    "function getAuPrice() view returns (uint256)",
    "function getAgPrice() view returns (uint256)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  // Check twapPools for AU
  try {
    const pool = await oracle.twapPools(AU);
    console.log("AU twapPool:");
    console.log("  pool:", pool.pool);
    console.log("  token0:", pool.token0);
    console.log("  token1:", pool.token1);
    console.log("  twapDuration:", pool.twapDuration.toString());
    console.log("  token0IsTarget:", pool.token0IsTarget);
  } catch(e) { console.log("twapPools error:", e.message.slice(0,80)); }
  
  // Try getTwapPrice
  try {
    const twapPrice = await oracle.getTwapPrice(AU);
    console.log("\nAU TWAP price (raw):", twapPrice.toString());
    console.log("AU TWAP price (18 dec):", ethers.utils.formatUnits(twapPrice, 18));
  } catch(e) { console.log("getTwapPrice error:", e.message.slice(0,100)); }
  
  // Try getPrice
  try {
    const [price, decimals] = await oracle.getPrice(AU);
    console.log("\nAU getPrice:", price.toString(), "decimals:", decimals);
    console.log("Formatted:", ethers.utils.formatUnits(price, decimals));
  } catch(e) { console.log("getPrice error:", e.message.slice(0,100)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
