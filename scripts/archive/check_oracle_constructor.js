const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  
  // Check stored token addresses (set in constructor)
  const abi = [
    "function auToken() view returns (address)",
    "function agToken() view returns (address)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  try {
    console.log("auToken:", await oracle.auToken());
  } catch(e) {
    console.log("auToken() reverted:", e.message.slice(0, 100));
    
    // Try raw storage - auToken is storage slot 0 in most layouts
    // But with UUPS upgradeable, the storage layout is from the implementation
    // Let's check slot 0
    for (let i = 0; i < 5; i++) {
      const val = await ethers.provider.getStorageAt(ORACLE, i);
      console.log(`Slot ${i}:`, val);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
