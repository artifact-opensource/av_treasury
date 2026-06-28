const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  const abi = [
    "function auToken() view returns (address)",
    "function agToken() view returns (address)",
    "function twapPools(address) view returns (tuple(address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget))",
    "function getTwapPrice(address token) view returns (uint256 price)",
    "function getTvlSourceCount() view returns (uint256)",
    "function getPrice(address token) view returns (uint256 price, uint8 decimals)",
    "function getAuPrice() view returns (uint256)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  console.log("auToken:", await oracle.auToken());
  console.log("agToken:", await oracle.agToken());
  
  const poolInfo = await oracle.twapPools(AU);
  console.log("\ntwapPools(AU):");
  console.log("  pool:", poolInfo.pool);
  console.log("  token0:", poolInfo.token0);
  console.log("  token1:", poolInfo.token1);
  console.log("  twapDuration:", poolInfo.twapDuration.toString());
  console.log("  token0IsTarget:", poolInfo.token0IsTarget);
  
  console.log("\ngetTvlSourceCount:", (await oracle.getTvlSourceCount()).toString());
  
  // Now try getTwapPrice
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("\n✅ getTwapPrice(AU):", price.toString());
    console.log("   $", parseFloat(ethers.utils.formatUnits(price, 18)).toFixed(8));
  } catch(e) {
    console.log("\n❌ getTwapPrice(AU):", e.message.slice(0, 200));
  }
  
  try {
    const [price, dec] = await oracle.getPrice(AU);
    console.log("\n✅ getPrice(AU):", price.toString(), "decimals:", dec);
  } catch(e) {
    console.log("\n❌ getPrice(AU):", e.message.slice(0, 200));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
