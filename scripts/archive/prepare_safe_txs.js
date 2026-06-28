const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";

async function main() {
  // We need to simulate from the Safe's perspective
  const timelockArtifact = require("../artifacts/contracts/av_suite/ArtifactTimelock.sol/ArtifactTimelock.json");
  const iface = new ethers.utils.Interface(timelockArtifact.abi);

  // Get role hashes
  const timelock = await ethers.getContractAt("ArtifactTimelock", TIMELOCK);
  const PROPOSER = await timelock.PROPOSER_ROLE();
  const EXECUTOR = await timelock.EXECUTOR_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();

  const txs = [];

  // 1. Grant PROPOSER to Governor
  txs.push({
    description: "Grant PROPOSER_ROLE to Governor on Timelock",
    to: TIMELOCK,
    data: iface.encodeFunctionData("grantRole", [PROPOSER, GOVERNOR]),
    value: "0",
  });

  // 2. Grant EXECUTOR to Governor
  txs.push({
    description: "Grant EXECUTOR_ROLE to Governor on Timelock",
    to: TIMELOCK,
    data: iface.encodeFunctionData("grantRole", [EXECUTOR, GOVERNOR]),
    value: "0",
  });

  // 3. Grant CANCELLER to Governor
  txs.push({
    description: "Grant CANCELLER_ROLE to Governor on Timelock",
    to: TIMELOCK,
    data: iface.encodeFunctionData("grantRole", [CANCELLER, GOVERNOR]),
    value: "0",
  });

  // 4. Grant PROPOSER to Safe (for direct governance actions)
  txs.push({
    description: "Grant PROPOSER_ROLE to Safe on Timelock",
    to: TIMELOCK,
    data: iface.encodeFunctionData("grantRole", [PROPOSER, SAFE]),
    value: "0",
  });

  // 5. Grant EXECUTOR to Safe
  txs.push({
    description: "Grant EXECUTOR_ROLE to Safe on Timelock",
    to: TIMELOCK,
    data: iface.encodeFunctionData("grantRole", [EXECUTOR, SAFE]),
    value: "0",
  });

  console.log("═══ SAFE TRANSACTION BATCH ═══");
  console.log("These need to be executed via the Safe multisig:\n");
  
  txs.forEach((tx, i) => {
    console.log(`${i + 1}. ${tx.description}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Data: ${tx.data}`);
    console.log(`   Value: ${tx.value}`);
    console.log("");
  });

  // Also check: does the Governor's executor() return the Timelock?
  const governorArtifact = require("../artifacts/contracts/av_suite/GovernorContract.sol/GovernorContract.json");
  const governor = await ethers.getContractAt("GovernorContract", GOVERNOR);
  try {
    const executor = await governor.executor();
    console.log("Governor executor():", executor);
    console.log("Matches Timelock?", executor.toLowerCase() === TIMELOCK.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch(e) {
    console.log("Governor.executor() error:", e.message.split('\n')[0]);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
