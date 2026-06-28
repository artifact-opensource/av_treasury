const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  
  const abi = [
    "function executor() view returns (address)",
    "function _executor() view returns (address)",
    "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
    "function proposeTransaction(address target, uint256 value, bytes calldata data, uint256 locktime)",
  ];
  
  const governor = new ethers.Contract(GOVERNOR, abi, provider);
  
  try {
    const ex = await governor.executor();
    console.log("executor():", ex, ex.toLowerCase() === TIMELOCK.toLowerCase() ? "✅ == Timelock" : "❌ != Timelock");
  } catch(e) { console.log("executor() failed:", e.message.slice(0,40)); }
  
  try {
    const ex = await governor._executor();
    console.log("_executor():", ex);
  } catch(e) { console.log("_executor() failed (expected)"); }
  
  // Check owner
  try {
    const owner = await governor.owner();
    console.log("Governor owner:", owner);
  } catch(e) { console.log("No owner()"); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
