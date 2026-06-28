const { ethers } = require("hardhat");

async function main() {
  const oracle = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19");
  
  // Check current price feeds
  console.log("=== Price Feeds ===");
  try {
    const pf = await oracle.priceFeeds(0);
    console.log("Au Chainlink feed:", pf);
  } catch(e) { console.log("No Au feed (index 0)"); }
  try {
    const pf = await oracle.priceFeeds(1);
    console.log("Ag Chainlink feed:", pf);
  } catch(e) { console.log("No Ag feed (index 1)"); }
  
  // Check current prices
  console.log("\n=== Prices ===");
  try {
    const p = await oracle.getPrice(0); // Au
    console.log("Au price (raw):", p.toString());
  } catch(e) { console.log("getPrice(0) error:", e.message.split('\n')[0]); }
  try {
    const p = await oracle.getPrice(1); // Ag
    console.log("Ag price (raw):", p.toString());
  } catch(e) { console.log("getPrice(1) error:", e.message.split('\n')[0]); }
  
  try {
    const p = await oracle.getAuAgPrices();
    console.log("getAuAgPrices():", p);
  } catch(e) { console.log("getAuAgPrices error:", e.message.split('\n')[0]); }
  
  // Check TVL sources
  console.log("\n=== TVL ===");
  const count = await oracle.getTvlSourceCount();
  console.log("TVL source count:", count.toString());
  
  // Check TWAP
  console.log("\n=== TWAP ===");
  try {
    const twap = await oracle.getTwapPrice(0);
    console.log("Au TWAP:", twap.toString());
  } catch(e) { console.log("getTwapPrice(0) error:", e.message.split('\n')[0]); }
  
  // Check roles
  console.log("\n=== Roles ===");
  const GOVERNOR = await oracle.GOVERNOR();
  const adminAddr = await oracle.getRoleAdmin(GOVERNOR);
  console.log("GOVERNOR role:", GOVERNOR);
  console.log("GOVERNOR admin:", adminAddr);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
