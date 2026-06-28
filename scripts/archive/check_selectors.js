const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const code = await ethers.provider.getCode(PM);
  
  const selectors = {
    "createAndInit(4)": "63f126fb67",
    "createAndInit(5)": "63c3d854ed",
    "createPool(4)": "63232aa5ac",
    "mint(tuple)": "636d70c415",
    "mint(V3-style)": "63b5007d1f", // This is what the real tx uses!
    "multicall": "63ac9650d8",
  };
  
  for (const [name, hex] of Object.entries(selectors)) {
    const found = code.toLowerCase().includes(hex.toLowerCase());
    console.log(`${name}: ${found ? "✅ FOUND" : "❌ NOT FOUND"}`);
  }
  
  // Also find ALL PUSH4 instructions that could be function selectors
  console.log("\nSearching for likely function selectors...");
  const found = new Set();
  const codeLower = code.toLowerCase();
  
  // Look for JUMPI patterns that follow PUSH4 (dispatcher pattern)
  for (let i = 0; i < code.length - 20; i += 2) {
    // PUSH4 is 0x63
    if (codeLower.substring(i, i+2) === '63') {
      const sel = codeLower.substring(i+2, i+10);
      if (!found.has(sel) && sel !== 'ffffffff' && sel !== '00000000') {
        found.add(sel);
      }
    }
  }
  
  // Check the important ones
  const important = {
    "f126fb67": "createAndInit(4)",
    "c3d854ed": "createAndInit(5)",
    "232aa5ac": "createPool(4)",
    "6d70c415": "mint(tuple)",
    "b5007d1f": "mint(V3-style)",
    "ac9650d8": "multicall(bytes[])",
    "88316456": "multicall(uint256,bytes[])",
  };
  
  console.log("\nImportant selectors:");
  for (const sel of Object.keys(important)) {
    const inCode = found.has(sel);
    console.log(`  0x${sel} (${important[sel]}): ${inCode ? "✅" : "❌"}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
