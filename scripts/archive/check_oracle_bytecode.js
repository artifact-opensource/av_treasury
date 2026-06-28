const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Try to decompile by looking at function selectors in bytecode
  const code = await provider.getCode(ORACLE);
  
  // Check all function signatures from the current source
  const signatures = [
    "getTwapPrice(address)",
    "getPrice(address)",
    "updatePrice(address)",
    "configureTwapPool(address,address,address,address,uint256,bool)",
    "addTvlSource(address)",
    "getTvlSourceCount()",
    "tvlSources(uint256)",
    "twapPools(address)",
    "configurePriceFeed(address,address,uint8)",
    "updateTVL(address)",
    "getAuPrice()",
    "getAgPrice()",
    "getAuAgPrices()",
    "setMaxDeviation(uint256)",
    "setMinAnswers(uint8)",
    "pause()",
    "unpause()",
  ];
  
  console.log("=== Function Selector Check ===");
  for (const sig of signatures) {
    const sel = ethers.utils.id(sig).slice(0, 10);
    const found = code.includes(sel.slice(2));
    console.log(`  ${found ? "✅" : "❌"} ${sig}: ${sel}`);
  }
  
  // The real issue: try calling getTwapPrice and getPrice with proper error decoding
  console.log("\n=== Attempting Calls ===");
  
  // Try getTwapPrice
  const twapSelector = ethers.utils.id("getTwapPrice(address)").slice(0, 10);
  try {
    await provider.call({
      to: ORACLE,
      data: twapSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2),
    });
  } catch(e) {
    console.log("getTwapPrice revert data:", e.data || "empty");
    console.log("Error:", e.reason || e.message.slice(0, 100));
  }
  
  // Try getPrice
  const priceSelector = ethers.utils.id("getPrice(address)").slice(0, 10);
  try {
    await provider.call({
      to: ORACLE,
      data: priceSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2),
    });
  } catch(e) {
    console.log("getPrice revert data:", e.data || "empty");
    console.log("Error:", e.reason || e.message.slice(0, 100));
  }
  
  // Try updatePrice - this might need a separate signer but let's try static call first
  const updateSelector = ethers.utils.id("updatePrice(address)").slice(0, 10);
  try {
    await provider.call({
      from: ORACLE,  // call as itself (it has ORACLE_ADMIN)
      to: ORACLE,
      data: updateSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2),
    });
    console.log("✅ updatePrice from Oracle itself succeeded");
  } catch(e) {
    console.log("❌ updatePrice error:", e.reason || e.message.slice(0, 100));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
