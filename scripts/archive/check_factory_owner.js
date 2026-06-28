const { ethers, network } = require("hardhat");
async function main() {
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const factory = new ethers.Contract(FACTORY, [
    "function owner() view returns (address)",
  ], ethers.provider);
  const owner = await factory.owner();
  console.log("Factory owner:", owner);
  console.log("Is deployer:", owner.toLowerCase() === "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E".toLowerCase());
  
  // Check if createPool has access control
  // Maybe it's only callable by the owner or a designated poolDeployer
  // Let me check the factory for poolDeployer or createPool access
  const factory2 = new ethers.Contract(FACTORY, [
    "function owner() view returns (address)",
    "function poolDeployer() view returns (address)",
    "function positionManager() view returns (address)",
    "function swapRouter() view returns (address)",
  ], ethers.provider);
  
  try { console.log("poolDeployer:", await factory2.poolDeployer()); } catch(e) { console.log("poolDeployer() failed"); }
  try { console.log("positionManager:", await factory2.positionManager()); } catch(e) { console.log("positionManager() failed"); }
  try { console.log("swapRouter:", await factory2.swapRouter()); } catch(e) { console.log("swapRouter() failed"); }
  
  // Check storage slots for more info
  for (let i = 0; i <= 5; i++) {
    const slot = await ethers.provider.getStorageAt(FACTORY, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const addr = "0x" + slot.slice(26);
      try {
        const c = ethers.utils.getAddress(addr);
        const code = await ethers.provider.getCode(c);
        if (code.length > 100) {
          console.log(`Slot ${i}: ${c} (code: ${code.length})`);
        }
      } catch(e) {}
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
