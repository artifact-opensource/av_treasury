const { ethers } = require("hardhat");
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03"
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";

async function main() {
  const timelock = await ethers.getContractAt([
    "function PROPOSER_ROLE() view returns(bytes32)",
    "function EXECUTOR_ROLE() view returns(bytes32)",
    "function CANCELLER_ROLE() view returns(bytes32)",
    "function hasRole(bytes32,address) view returns(bool)",
    "function getRoleMember(bytes32,uint256) view returns(address)",
    "function getRoleAdmin(bytes32) view returns(bytes32)",
  ], TIMELOCK);

  const PROPOSER = await timelock.PROPOSER_ROLE();
  const EXECUTOR = await timelock.EXECUTOR_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();
  
  console.log("PROPOSER_ROLE members:");
  for (let i = 0; i < 10; i++) {
    try { const m = await timelock.getRoleMember(PROPOSER, i); console.log(`  [${i}] ${m}`); } catch(e) { break; }
  }
  
  console.log("\nEXECUTOR_ROLE members:");
  for (let i = 0; i < 10; i++) {
    try { const m = await timelock.getRoleMember(EXECUTOR, i); console.log(`  [${i}] ${m}`); } catch(e) { break; }
  }
  
  console.log("\nCANCELLER_ROLE members:");
  for (let i = 0; i < 10; i++) {
    try { const m = await timelock.getRoleMember(CANCELLER, i); console.log(`  [${i}] ${m}`); } catch(e) { break; }
  }

  console.log("\nGovernor has PROPOSER?", await timelock.hasRole(PROPOSER, GOVERNOR));
  console.log("Governor has EXECUTOR?", await timelock.hasRole(EXECUTOR, GOVERNOR));
  console.log("Safe has TIMELOCK_ADMIN?", await timelock.hasRole(ethers.constants.HashZero, SAFE));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
