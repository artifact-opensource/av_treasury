const { ethers } = require("hardhat");

async function main() {
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const [deployer] = await ethers.getSigners();
  
  // Safe ABI (minimal)
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool)",
    "function owners(uint256) view returns (address)",
    "function getThreshold() view returns (uint256)",
    "function getOwners() view returns (address[])",
    "function isOwner(address) view returns (bool)",
    "function approveHash(bytes32, address) returns (bool)",
  ];
  
  const treasury = new ethers.Contract(TREASURY, safeAbi, deployer);
  
  try { console.log("Threshold:", (await treasury.getThreshold()).toString()); } catch(e) { console.log("getThreshold failed"); }
  try { console.log("isOwner(deployer):", await treasury.isOwner(deployer.address)); } catch(e) { console.log("isOwner failed"); }
  try { console.log("owners(0):", await treasury.owners(0)); } catch(e) { console.log("owners(0) failed"); }
  try { console.log("owners(1):", await treasury.owners(1)); } catch(e) { console.log("owners(1) failed"); }
  
  // Also check the implementation
  const code = await ethers.provider.getCode(TREASURY);
  // Check if it's a minimal proxy (EIP-1167)
  // EIP-1167 pattern: 36 bytes of bytecode that delegates to master copy
  console.log("\nTreasury bytecode:", code.substring(0, 100));
  
  // Check if it's a Gnosis Safe proxy
  // The implementation address is stored in a specific slot
  const IMPLEMENTATION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
  const impl = await ethers.provider.getStorageAt(TREASURY, IMPLEMENTATION_SLOT);
  console.log("Implementation:", "0x" + impl.slice(26));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
