const { ethers } = require("hardhat");
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";

async function main() {
  const timelock = await ethers.getContractAt([
    "function PROPOSER_ROLE() view returns(bytes32)",
    "function EXECUTOR_ROLE() view returns(bytes32)",
    "function CANCELLER_ROLE() view returns(bytes32)",
    "function hasRole(bytes32,address) view returns(bool)",
  ], TIMELOCK);

  const PROPOSER = await timelock.PROPOSER_ROLE();
  const EXECUTOR = await timelock.EXECUTOR_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();

  console.log("Timelock Role Verification:");
  console.log("Governor PROPOSER:", await timelock.hasRole(PROPOSER, GOVERNOR) ? "✅" : "❌");
  console.log("Governor EXECUTOR:", await timelock.hasRole(EXECUTOR, GOVERNOR) ? "✅" : "❌");
  console.log("Governor CANCELLER:", await timelock.hasRole(CANCELLER, GOVERNOR) ? "✅" : "❌");
  console.log("Safe PROPOSER:", await timelock.hasRole(PROPOSER, SAFE) ? "✅" : "❌");
  console.log("Safe EXECUTOR:", await timelock.hasRole(EXECUTOR, SAFE) ? "✅" : "❌");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
