const { ethers } = require("hardhat");
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const STAKING = "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3";

async function main() {
  const staking = await ethers.getContractAt([
    "function hasRole(bytes32,address) view returns(bool)",
    "function getRoleMember(bytes32,uint256) view returns(address)",
  ], STAKING);
  
  const DEFAULT_ADMIN = ethers.constants.HashZero;
  
  console.log("Staking DEFAULT_ADMIN_ROLE members:");
  for (let i = 0; i < 10; i++) {
    try { 
      const m = await staking.getRoleMember(DEFAULT_ADMIN, i); 
      console.log(`  [${i}] ${m}`); 
    } catch(e) { break; }
  }
  
  console.log("\nSafe has ADMIN?", await staking.hasRole(DEFAULT_ADMIN, SAFE));
  
  // Check if initialize is still callable (it shouldn't be after initialization)
  const initSlot = await ethers.provider.getStorageAt(STAKING, "0x00");
  console.log("\nStorage slot 0 (initialized flag):", initSlot);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
