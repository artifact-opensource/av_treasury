const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  // Try different nonce function signatures
  const abis = [
    ["function nonce() view returns (uint256)"],
    ["function getNonce() view returns (uint256)"],
    ["function _nonce() view returns (uint256)"],
  ];
  
  for (const abi of abis) {
    try {
      const safe = new ethers.Contract(SAFE, abi, ethers.provider);
      const result = await safe.nonce();
      console.log("nonce():", result.toString());
      break;
    } catch(e) {}
    try {
      const safe = new ethers.Contract(SAFE, abi, ethers.provider);
      const result = await safe.getNonce();
      console.log("getNonce():", result.toString());
      break;
    } catch(e) {}
  }
  
  // Try storage slot - nonce is typically slot 5 in Gnosis Safe
  const nonceSlot = await ethers.provider.getStorageAt(SAFE, 5);
  console.log("Storage slot 5:", nonceSlot.toString());
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
