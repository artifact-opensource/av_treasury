const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
  
  const abi = [
    "function getPrice(address token) view returns (uint256 price, uint8 decimals)",
    "function getAuPrice() view returns (uint256)",
    "function getAgPrice() view returns (uint256)",
    "function getAuAgPrices() view returns (uint256 auPrice, uint256 agPrice)",
    "function tvlSources(uint256) view returns (address)",
    "function getTvlSourceCount() view returns (uint256)",
    "function twapSources(address) view returns (address)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  console.log("=== Oracle Configuration ===");
  
  // Check TWAP source for AU
  try {
    const twapPool = await oracle.twapSources(AU);
    console.log("AU TWAP source:", twapPool === ethers.constants.AddressZero ? "❌ NOT SET" : "✅ " + twapPool);
  } catch(e) { console.log("twapSources error:", e.message.slice(0,60)); }
  
  // Check TVL sources
  try {
    const count = await oracle.getTvlSourceCount();
    console.log("TVL source count:", count.toString());
    if (count.gt(0)) {
      for (let i = 0; i < count.toNumber(); i++) {
        const src = await oracle.tvlSources(i);
        console.log(`  TVL source ${i}:`, src, src.toLowerCase() === STAKING.toLowerCase() ? "✅ (Staking)" : "");
      }
    }
  } catch(e) { console.log("TVL error:", e.message.slice(0,60)); }
  
  // Check prices
  try {
    const auPrice = await oracle.getAuPrice();
    console.log("\nAu price (raw):", auPrice.toString());
    console.log("Au price (formatted):", ethers.utils.formatUnits(auPrice, 8), "USD (if 8 decimals)");
  } catch(e) { console.log("getAuPrice error:", e.message.slice(0,60)); }
  
  try {
    const [auPrice, agPrice] = await oracle.getAuAgPrices();
    console.log("getAuAgPrices():", auPrice.toString(), agPrice.toString());
  } catch(e) { console.log("getAuAgPrices error:", e.message.slice(0,60)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
