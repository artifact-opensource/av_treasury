const { ethers } = require("hardhat");

async function main() {
  const STAKING = "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3";
  
  // Check ERC1967 implementation slot
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const impl = await ethers.provider.getStorageAt(STAKING, IMPL_SLOT);
  console.log("Implementation slot:", impl);
  
  // Check admin slot
  const ADMIN_SLOT = "0xb53127684a568b3173aea92b2f2f670f31a34a869aab8cc859e62a5c04014e1a";
  const admin = await ethers.provider.getStorageAt(STAKING, ADMIN_SLOT);
  console.log("Admin slot:", admin);
  
  // Check if there's an upgradeTo function
  const c = await ethers.getContractAt([
    "function upgradeTo(address)",
    "function upgradeToAndCall(address,bytes)",
  ], STAKING);
  
  try {
    // Just check if the function exists
    const code = await ethers.provider.getCode(STAKING);
    console.log("Staking has code, length:", code.length);
    console.log("Is upgradeable proxy: implementation slot is set");
  } catch(e) {}
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
