const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  
  const abi = [
    "function executorAddress() view returns (address)",
    "function proposeTransaction(address target, uint256 value, bytes calldata data, uint256 locktime) returns (uint256)",
    "function proposalCount() view returns (uint256)",
  ];
  
  const governor = new ethers.Contract(GOVERNOR, abi, provider);
  
  const ex = await governor.executorAddress();
  console.log("executorAddress:", ex);
  console.log("Is Timelock?", ex.toLowerCase() === TIMELOCK.toLowerCase() ? "✅ YES" : "❌ NO");
  
  const count = await governor.proposalCount();
  console.log("Proposal count:", count.toString());
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
