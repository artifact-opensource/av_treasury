const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Try calling getTwapPrice with eth_call (no tx context needed)
  try {
    const result = await provider.call({
      to: ORACLE,
      data: "0xd1e4d97f" + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2),
    });
    console.log("Raw result:", result.slice(0, 66) + "...");
    const decoded = ethers.utils.defaultAbiCoder.decode(["uint256"], result);
    console.log("Decoded price:", decoded[0].toString());
  } catch(e) {
    console.log("Static call error:", e.message.slice(0,300));
  }
  
  // Let's try to understand what selector getTwapPrice has
  const selector = ethers.utils.id("getTwapPrice(address)").slice(0, 10);
  console.log("getTwapPrice selector:", selector);
  
  // Try with manual selector
  try {
    const result = await provider.call({
      to: ORACLE,
      data: selector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2),
    });
    console.log("Manual selector result:", result.slice(0, 66));
  } catch(e) {
    console.log("Manual selector error:", e.message.slice(0,300));
  }
  
  // Check: does getTwapPrice exist on the contract?
  // Check by looking at deployed bytecode for function selectors
  const code = await provider.getCode(ORACLE);
  console.log("\nContract bytecode length:", code.length);
  console.log("Selector 0xd1e4d97f in bytecode?", code.includes("d1e4d97f") ? "✅" : "❌");
  console.log("Selector for getPrice:", ethers.utils.id("getPrice(address)").slice(0, 10));
  console.log("Selector for updatePrice:", ethers.utils.id("updatePrice(address)").slice(0, 10));
  
  // Check if getTwapPrice selector is in bytecode
  // The actual selector might differ if the ABI differs
  // Let's try common selectors
  const selectors = [
    "getTwapPrice(address)",
    "getPrice(address)", 
    "updatePrice(address)",
    "updateTVL(address)",
  ];
  for (const sig of selectors) {
    const sel = ethers.utils.id(sig).slice(0, 10);
    console.log(`  ${sig}: ${sel} ${code.includes(sel.slice(2)) ? "found" : "NOT found"}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
