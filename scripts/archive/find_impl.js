const { ethers } = require("hardhat");
async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";

  // EIP-1967 implementation slot
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const impl = await ethers.provider.getStorageAt(PM, implSlot);
  const implAddr = "0x" + impl.slice(26);
  console.log("Implementation:", implAddr);

  // Check if it's verified on Basescan
  const code = await ethers.provider.getCode(implAddr);
  console.log("Code length:", code.length);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
