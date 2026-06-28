const { ethers } = require("hardhat");
async function main() {
  const addr = "0x61040E143A77F165Ba44543AF4A079F2C809D14b";
  const code = await ethers.provider.getCode(addr);
  console.log("Code length:", code.length);

  // Check selectors
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') found.add(sel);
    }
  }
  console.log(`Found ${found.size} selectors`);

  // Check if it's a router
  const targets = {
    "0d390afd": "???",
    "88316456": "addLiquidity",
    "b5007d1f": "mint(tuple)",
    "6d70c415": "mint(tuple11)",
    "ac9650d8": "multicall",
    "3593bc73": "exactInput",
    "f780bc8d": "exactOutput",
    "c07f5255": "exactInputSingle",
    "414bf389": "exactOutputSingle",
  };
  for (const sel of [...found].sort()) {
    const name = targets[sel] || "???";
    console.log(`  0x${sel}: ${name}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
