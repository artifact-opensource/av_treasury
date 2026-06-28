const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const code = await ethers.provider.getCode(ORACLE);
  console.log("Bytecode length:", code.length);
  console.log("First 100 hex chars:", code.slice(0, 100));
  console.log("Last 20 hex chars:", code.slice(-20));
  
  // Check if it's a proxy
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const slot = await ethers.provider.getStorageAt(ORACLE, IMPLEMENTATION_SLOT);
  const impl = ethers.utils.getAddress("0x" + slot.slice(26));
  console.log("\nERC-1977 impl slot:", impl);
  
  // Check if this is verified on Basescan
  console.log("\nCheck on Basescan: https://basescan.org/address/ORACLE#code");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
