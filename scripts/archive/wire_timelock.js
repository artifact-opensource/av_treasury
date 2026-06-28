const { ethers } = require("hardhat");
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";

async function main() {
  const timelock = await ethers.getContractAt("ArtifactTimelock", TIMELOCK);
  
  const PROPOSER = await timelock.PROPOSER_ROLE();
  const EXECUTOR = await timelock.EXECUTOR_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();

  console.log("🔷 Granting Governor roles on Timelock...");
  
  let tx = await timelock.grantRole(PROPOSER, GOVERNOR);
  await tx.wait();
  console.log("✅ Governor granted PROPOSER_ROLE (tx:", tx.hash.slice(0,20) + ")");

  tx = await timelock.grantRole(EXECUTOR, GOVERNOR);
  await tx.wait();
  console.log("✅ Governor granted EXECUTOR_ROLE (tx:", tx.hash.slice(0,20) + ")");

  tx = await timelock.grantRole(CANCELLER, GOVERNOR);
  await tx.wait();
  console.log("✅ Governor granted CANCELLER_ROLE (tx:", tx.hash.slice(0,20) + ")");

  // Also grant PROPOSER to Safe for direct proposals if needed
  tx = await timelock.grantRole(PROPOSER, SAFE);
  await tx.wait();
  console.log("✅ Safe granted PROPOSER_ROLE (tx:", tx.hash.slice(0,20) + ")");

  tx = await timelock.grantRole(EXECUTOR, SAFE);
  await tx.wait();
  console.log("✅ Safe granted EXECUTOR_ROLE (tx:", tx.hash.slice(0,20) + ")");

  console.log("\n🎉 Timelock roles wired!");
  console.log("Governor can now propose, cancel, and execute through the Timelock.");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
