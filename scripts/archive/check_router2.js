const { ethers } = require("hardhat");
async function main() {
  const addr = "0x61040E143A77F165Ba44543AF4A079F2C809D14b";
  const code = await ethers.provider.getCode(addr);
  console.log("Code length:", code.length);
  console.log("First 100 chars:", code.substring(0, 100));

  // Check if it's a proxy
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const impl = await ethers.provider.getStorageAt(addr, implSlot);
  console.log("Impl slot:", impl);

  // Check selectors
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') found.add(sel);
    }
  }
  console.log(`\nFound ${found.size} selectors`);
  for (const sel of [...found].sort()) {
    console.log(`  0x${sel}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
