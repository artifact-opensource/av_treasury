const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const abi = [
    "function nonce() view returns (uint256)",
    "function getNonce() view returns (uint256)",
    "function getNextNonce() view returns (uint256)",
  ];
  const safe = new ethers.Contract(SAFE, abi, ethers.provider);
  try { console.log("nonce():", (await safe.nonce()).toString()); } catch(e) { console.log("no nonce()"); }
  try { console.log("getNonce():", (await safe.getNonce()).toString()); } catch(e) { console.log("no getNonce()"); }
  try { console.log("getNextNonce():", (await safe.getNextNonce()).toString()); } catch(e) { console.log("no getNextNonce()"); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.slice(0,60)); process.exit(1); });
