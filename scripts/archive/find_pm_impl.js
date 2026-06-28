const { ethers } = require("hardhat");
async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";

  // Check multiple proxy patterns
  const slots = {
    "EIP-1967": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    "EIP-1967 beacon": "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
    "OpenZeppelin": "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
    "Gnosis Safe": "0x0000000000000000000000000000000000000000000000000000000000000000",
  };

  for (const [name, slot] of Object.entries(slots)) {
    const val = await ethers.provider.getStorageAt(PM, slot);
    const addr = "0x" + val.slice(26);
    if (addr !== "0x0000000000000000000000000000000000000000") {
      const code = await ethers.provider.getCode(addr);
      console.log(`${name}: ${addr} (code: ${code.length})`);
    }
  }

  // Also check slot 0-5 for the implementation
  for (let i = 0; i < 10; i++) {
    const val = await ethers.provider.getStorageAt(PM, i);
    const addr = "0x" + val.slice(26);
    if (addr !== "0x0000000000000000000000000000000000000000") {
      const code = await ethers.provider.getCode(addr);
      if (code.length > 100) {
        console.log(`Slot ${i}: ${addr} (code: ${code.length})`);
      }
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
