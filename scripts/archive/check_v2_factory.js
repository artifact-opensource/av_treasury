const { ethers, network } = require("hardhat");
async function main() {
  // The V2 Router should be accessible
  // Let me check the factory storage
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  
  // Check storage slots
  console.log("V2 Factory storage:");
  for (let i = 0; i <= 10; i++) {
    const slot = await ethers.provider.getStorageAt(V2_FACTORY, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const addr = "0x" + slot.slice(26);
      try {
        const c = ethers.utils.getAddress(addr);
        const code = await ethers.provider.getCode(c);
        if (code.length > 100) {
          console.log(`  Slot ${i}: ${c} (code: ${code.length})`);
        }
      } catch(e) {}
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
