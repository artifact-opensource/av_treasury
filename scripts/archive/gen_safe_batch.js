const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";

  const timelock = await ethers.getContractAt("ArtifactTimelock", TIMELOCK);
  const PROPOSER = await timelock.PROPOSER_ROLE();
  const EXECUTOR = await timelock.EXECUTOR_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();

  const iface = new ethers.utils.Interface(timelock.interface.fragments);

  const calls = [
    { desc: "Grant PROPOSER_ROLE to Governor", to: TIMELOCK, data: iface.encodeFunctionData("grantRole", [PROPOSER, GOVERNOR]) },
    { desc: "Grant EXECUTOR_ROLE to Governor", to: TIMELOCK, data: iface.encodeFunctionData("grantRole", [EXECUTOR, GOVERNOR]) },
    { desc: "Grant CANCELLER_ROLE to Governor", to: TIMELOCK, data: iface.encodeFunctionData("grantRole", [CANCELLER, GOVERNOR]) },
    { desc: "Grant PROPOSER_ROLE to Safe", to: TIMELOCK, data: iface.encodeFunctionData("grantRole", [PROPOSER, SAFE]) },
    { desc: "Grant EXECUTOR_ROLE to Safe", to: TIMELOCK, data: iface.encodeFunctionData("grantRole", [EXECUTOR, SAFE]) },
  ];

  // Output as Safe Transaction Builder JSON
  const batch = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: {
      name: "Wire Timelock Roles",
      description: "Grant PROPOSER/EXECUTOR/CANCELLER roles on Timelock to Governor and Safe",
    },
    transactions: calls.map(c => ({
      to: c.to,
      value: "0",
      data: c.data,
      contractMethod: { name: "grantRole", parameters: [{ name: "role", type: "bytes32", value: "" }, { name: "account", type: "address", value: "" }] },
      contractInputsValues: {},
    })),
  };

  // Output raw calls for manual use
  console.log("═══ SAFE BATCH TRANSACTION DATA ═══\n");
  calls.forEach((c, i) => {
    console.log(`${i+1}. ${c.desc}`);
    console.log(`   To: ${c.to}`);
    console.log(`   Value: 0`);
    console.log(`   Data: ${c.data}`);
    console.log("");
  });

  // Also output as JSON for Safe import
  console.log("\n═══ SAFE TX BUILDER JSON ═══");
  const safeJson = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: {
      name: "Wire Timelock Roles",
      description: "Grant PROPOSER/EXECUTOR/CANCELLER roles to Governor and Safe",
    },
    transactions: calls.map(c => ({
      to: c.to,
      value: "0",
      data: c.data,
    })),
  };
  console.log(JSON.stringify(safeJson, null, 2));

  // Save to file
  fs.writeFileSync("safe_batch_wire_timelock.json", JSON.stringify(safeJson, null, 2));
  console.log("\n✅ Saved to safe_batch_wire_timelock.json");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
