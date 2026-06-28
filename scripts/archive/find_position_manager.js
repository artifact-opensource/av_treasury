const { ethers, network } = require("hardhat");

async function main() {
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  
  // Check storage slots for position manager
  console.log("Checking factory storage for contract references...");
  for (let i = 0; i <= 15; i++) {
    const slot = await ethers.provider.getStorageAt(FACTORY, i);
    if (slot !== ethers.constants.HashZero && slot !== "0x00") {
      const addr = "0x" + slot.slice(26);
      try {
        const checksummed = ethers.utils.getAddress(addr);
        if (checksummed !== ethers.constants.AddressZero) {
          const code = await ethers.provider.getCode(checksummed);
          if (code.length > 100) {
            console.log(`Slot ${i}: ${checksummed} (code: ${code.length})`);
          }
        }
      } catch(e) {}
    }
  }
  
  // Also check the poolDeployer pattern
  // In Uniswap V3, the Deployer stores the positionManager
  // Let me check the factory's implementation (it might be a proxy)
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d648bbc";
  const impl = await ethers.provider.getStorageAt(FACTORY, implSlot);
  const implAddr = "0x" + impl.slice(26);
  console.log("\nFactory impl:", implAddr);
  
  if (implAddr !== "0x0000000000000000000000000000000000000000") {
    const implCode = await ethers.provider.getCode(ethers.utils.getAddress(implAddr));
    console.log("Impl code:", implCode.length);
  }
  
  // Look at a known pool's creation to find the position manager
  // Check pool 0 for position manager reference
  const pool0Addr = "0x98c7A2338336d2d354663246F64676009c7bDa97";
  const pool0 = new ethers.Contract(pool0Addr, [
    "function factory() view returns (address)",
  ], ethers.provider);
  
  try {
    const poolFactory = await pool0.factory();
    console.log("\nPool0 factory:", poolFactory);
  } catch(e) {
    console.log("pool0 factory failed");
  }
  
  // Check pool0 storage for position manager
  for (let i = 0; i <= 5; i++) {
    const slot = await ethers.provider.getStorageAt(pool0Addr, i);
    if (slot !== ethers.constants.HashZero && slot !== "0x00") {
      const addr = "0x" + slot.slice(26);
      try {
        const checksummed = ethers.utils.getAddress(addr);
        if (checksummed !== ethers.constants.AddressZero) {
          const code = await ethers.provider.getCode(checksummed);
          if (code.length > 100) {
            console.log(`Pool0 slot ${i}: ${checksummed} (code: ${code.length})`);
          }
        }
      } catch(e) {}
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
