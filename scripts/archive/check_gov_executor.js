const { ethers } = require("hardhat");
async function main() {
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  const g = await ethers.getContractAt(["function executorAddress() view returns(address)"], GOVERNOR);
  const exec = await g.executorAddress();
  console.log("executorAddress:", exec);
  console.log("Matches Timelock?", exec.toLowerCase() === TIMELOCK.toLowerCase() ? "✅ YES" : "❌ NO");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
