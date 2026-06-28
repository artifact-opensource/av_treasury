const { ethers } = require("hardhat");

async function main() {
  const oracle = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19");
  
  console.log("=== AvOracle ===");
  
  // Check owner
  try {
    const owner = await oracle.owner();
    console.log("Owner:", owner);
  } catch(e) { console.log("No owner() function"); }
  
  // Check tokens
  try {
    console.log("auToken:", await oracle.auToken());
    console.log("agToken:", await oracle.agToken());
  } catch(e) { console.log("Token read error:", e.message.split('\n')[0]); }
  
  // Check price feeds
  try {
    console.log("auPriceFeed:", await oracle.auPriceFeed());
    console.log("agPriceFeed:", await oracle.agPriceFeed());
  } catch(e) { console.log("No price feeds set:", e.message.split('\n')[0]); }
  
  // Check if it has a price function
  try {
    const auPrice = await oracle.getAuPrice();
    const agPrice = await oracle.getAgPrice();
    console.log("Au price:", ethers.utils.formatUnits(auPrice, 8));
    console.log("Ag price:", ethers.utils.formatUnits(agPrice, 8));
  } catch(e) { console.log("getPrice error:", e.message.split('\n')[0]); }
  
  // Check TWAP
  try {
    const twap = await oracle.getTwap();
    console.log("TWAP:", twap);
  } catch(e) { console.log("No TWAP:", e.message.split('\n')[0]); }
  
  // List all public functions by checking the interface
  console.log("\n=== Available methods (from ABI) ===");
  const abi = oracle.interface.fragments.filter(f => f.type === "function" && f.stateMutability !== undefined);
  abi.forEach(f => console.log(`  ${f.name} (${f.stateMutability})`));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
