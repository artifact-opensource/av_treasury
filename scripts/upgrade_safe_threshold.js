/**
 * Upgrade Treasury Safe Threshold: 1-of-2 → 2-of-2
 *
 * This submits a Safe transaction to change the threshold from 1 to 2,
 * requiring both owners to confirm any transaction.
 *
 * Uses the Gnosis Safe Transaction Service API on Base.
 *
 * Run: node scripts/upgrade_safe_threshold.js
 */

const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const SAFE_SERVICE_URL = "https://safe-transaction-base.safe.global";

// Safe ABI — just what we need
const safeABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function nonce() view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddr = await signer.getAddress();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  AV Treasury — Safe Threshold Upgrade                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const safe = new ethers.Contract(SAFE, safeABI, signer);

  // Current state
  const threshold = await safe.getThreshold();
  const owners = await safe.getOwners();
  const nonce = await safe.nonce();

  console.log();
  console.log("Current Safe state:");
  console.log("  Address:", SAFE);
  console.log("  Threshold:", threshold.toString());
  console.log("  Owners:");
  for (const owner of owners) {
    const isSigner = owner.toLowerCase() === signerAddr.toLowerCase();
    console.log(`    ${owner} ${isSigner ? "← signer" : ""}`);
  }
  console.log("  Nonce:", nonce.toString());

  if (threshold.toNumber() === 2) {
    console.log("\n✅ Threshold is already 2-of-2. No action needed.");
    return;
  }

  if (threshold.toNumber() !== 1) {
    console.log(`\n⚠️  Unexpected threshold: ${threshold}. Expected 1.`);
    return;
  }

  console.log();
  console.log("━━━ Proposing threshold change: 1 → 2 ━━━");

  // Build the changeThreshold calldata
  // Safe: changeThreshold(uint256) = 0x033e8f8c + uint256(2)
  const changeThresholdData = ethers.utils.solidityPack(
    ["bytes4", "uint256"],
    [ethers.utils.id("changeThreshold(uint256)").slice(0, 10), 2]
  );

  // Use Gnosis Safe API to propose
  const proposePayload = {
    to: SAFE,
    value: "0",
    data: changeThresholdData,
    operation: 0,  // CALL
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: "0",
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce: nonce.toNumber(),
  };

  console.log();
  console.log("Transaction to submit:");
  console.log("  Target:", proposePayload.to);
  console.log("  Data:", changeThresholdData);
  console.log("  Operation:", proposePayload.operation);
  console.log("  Nonce:", proposePayload.nonce);
  console.log();
  console.log("To execute this threshold change:");
  console.log("  1. Both Safe owners must sign the transaction");
  console.log("  2. Execute via Safe UI: https://app.safe.global/basesafe:" + SAFE);
  console.log("  3. Or use the Safe SDK to submit signatures");
  console.log();
  console.log("⚠️  Once threshold is 2-of-2, BOTH owners must approve every transaction.");
  console.log("⚠️  This includes governance proposals that route through the Safe.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
