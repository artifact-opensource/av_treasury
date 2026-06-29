/**
 * Deploy ONLY the patched GovernorV5.
 * Timelock already deployed at 0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be
 */

const TIMELOCK = "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Balance:", ethers.utils.formatEther(balance), "ETH");

  console.log("\nDeploying GovernorContractV5 (patched)...");
  console.log("  Token:", AG);
  console.log("  Timelock:", TIMELOCK);

  const Governor = await ethers.getContractFactory("GovernorContractV5");
  const governor = await Governor.deploy(AG, TIMELOCK);
  await governor.deployed();

  console.log("\n✅ Governor deployed:", governor.address);

  // Verify
  const threshold = await governor.proposalThreshold();
  console.log("  Proposal threshold:", ethers.utils.formatUnits(threshold, 18), "Ag");
  console.log("  Voting delay:", (await governor.votingDelay()).toString(), "blocks");
  console.log("  Voting period:", (await governor.votingPeriod()).toString(), "blocks");
}

main().catch(err => {
  console.error("❌ Error:", err.reason || err.message);
  process.exit(1);
});
