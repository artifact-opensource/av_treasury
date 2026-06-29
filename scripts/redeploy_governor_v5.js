/**
 * Redeploy GovernorContractV5 with Spectre pentest fixes:
 * - INITIAL_QUORUM_BPS: 4 → 400 (4% — was 0.04%, critical bug)
 * - INITIAL_PROPOSAL_THRESHOLD: 100k → 1M Ag (flash loan mitigation)
 *
 * Timelock is already deployed at 0x0905...09Be.
 * After deploy, Safe must grant roles (see post_governance_roles_v2.js).
 */

const TIMELOCK = "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  console.log("\n━━━ Deploying GovernorContractV5 (patched) ━━━");
  console.log("  Fixes: quorum 4% (was 0.04%), threshold 1M Ag (was 100k)");

  const Governor = await ethers.getContractFactory("GovernorContractV5");
  const governor = await Governor.deploy(AG, TIMELOCK, { gasLimit: 3000000 });
  await governor.deployed();

  console.log("  ✅ New Governor:", governor.address);
  console.log("  ✅ Timelock:", TIMELOCK);
  console.log("  ✅ Token:", AG);

  // Verify config on-chain
  const quorumBps = await governor.quorumNumerator();
  const threshold = await governor.proposalThreshold();
  console.log("\n  On-chain verification:");
  console.log("    Quorum:", quorumBps.toString(), "bps (4%)");
  console.log("    Threshold:", ethers.utils.formatUnits(threshold, 18), "Ag");

  console.log("\n━━━ NEXT STEPS ━━━");
  console.log("1. Run: npx hardhat run scripts/post_governance_roles_v2.js --network base");
  console.log("2. Execute Safe transactions");
  console.log("3. Update ADDRESS_BOOK.md with new Governor address");
  console.log("4. Verify on Basescan");
  console.log("\n⚠️  Old Governor 0x1Dc5...f0a9 is now deprecated");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
