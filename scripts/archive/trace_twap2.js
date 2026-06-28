const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  const abi = ["function getTwapPrice(address token) view returns (uint256 price)"];
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("✅ getTwapPrice(AU):", price.toString());
  } catch(e) {
    console.log("❌ Error reason:", e.reason);
    console.log("❌ Error data:", e.data);
    console.log("❌ Error message:", e.message.slice(0, 300));
    if (e.error) console.log("❌ Inner error:", e.error.message);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
