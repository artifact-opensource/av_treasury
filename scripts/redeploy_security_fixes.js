/**
 * Redeploy Security Fixes (Spectre Pentest v2)
 * 
 * Deploys updated contracts with all security fixes:
 * 1. GovernorContractV5 — quorum fix (use block.number-1 instead of 0)
 * 2. TreasuryFlashBuy_v2 — reentrancy guard + CEI + Pausable
 * 3. FlashLoan — AccessControl on withdrawFee
 * 
 * Then reconfigures all roles and permissions.
 */

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

// Existing deployments
const OLD_TIMELOCK = "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be";
const OLD_GOVERNOR = "0x1Dc51EccAeA0c9fb41Bc42d6e452D2c27225f0a9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Spectre Pentest v2 — Security Fix Redeployment            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ─── Step 1: Deploy new Governor (quorum fix) ─────────────────────────
  console.log("━━━ Step 1: Deploy GovernorContractV5 (quorum fix) ━━━");

  const Governor = await ethers.getContractFactory("GovernorContractV5");
  const governor = await Governor.deploy(AG, OLD_TIMELOCK);
  await governor.deployed();
  console.log("  ✅ New Governor:", governor.address);

  // ─── Step 2: Deploy FlashBuy v2 (reentrancy + Pausable) ────────────────
  console.log("\n━━━ Step 2: Deploy TreasuryFlashBuy_v2 (security fixes) ━━━");

  // FlashBuy deployment skipped — needs real oracleWrapper and DEX addresses
  // The fixed contract is compiled and ready for deployment when those are available
  console.log("  ⏸️  FlashBuy deployment skipped (needs oracleWrapper + DEX addresses)");
  console.log("     Contract is compiled and ready — deploy when DEX integration is configured");
  const flashBuy = { address: "DEPLOY_WHEN_READY" };

  // ─── Step 3: Deploy FlashLoan (AccessControl) ─────────────────────────
  console.log("\n━━━ Step 3: Deploy FlashLoan (AccessControl) ━━━");

  // FlashLoan deployment skipped — needs real DEX simulator address
  console.log("  ⏸️  FlashLoan deployment skipped (needs DEX simulator address)");
  console.log("     Contract is compiled and ready — deploy when DEX is configured");
  const flashLoan = { address: "DEPLOY_WHEN_READY" };

  // ─── Step 4: Configure FlashBuy (skip if not deployed) ───────────────
  console.log("\n━━━ Step 4: Configure FlashBuy ━━━");
  if (flashBuy.address !== "DEPLOY_WHEN_READY") {
    const EXECUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));
    await flashBuy.grantRole(EXECUTOR_ROLE, governor.address);
    console.log("  ✅ Granted EXECUTOR_ROLE to new Governor");
  } else {
    console.log("  ⏸️  Skipped (FlashBuy not deployed yet)");
  }

  // ─── Output ───────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("DEPLOYMENT COMPLETE — New Addresses:");
  console.log("  Governor (new):", governor.address);
  console.log("  FlashBuy (new):", flashBuy.address);
  console.log("  FlashLoan (new):", flashLoan.address);
  console.log("\nSAFE TRANSACTIONS NEEDED:");
  console.log("  1. Grant PROPOSER_ROLE + CANCELLER_ROLE to new Governor on Timelock");
  console.log("  2. Renounce Safe admin on Timelock");
  console.log("  3. Transfer Au/Ag admin to Timelock");
  console.log("  4. Grant ADMIN_ROLE on FlashLoan to Safe");
  console.log("  5. Set FlashBuy oracle wrapper, DEX, treasury addresses");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Output calldata for Safe transactions
  const timelockABI = ["function grantRole(bytes32 role, address account)", "function renounceRole(bytes32 role, address account)"];
  const tl = new ethers.utils.Interface(timelockABI);

  const PROPOSER_ROLE = "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1";
  const CANCELLER_ROLE = "0x71a93f4e4345348d82222d19e03b647b43ed591762bf19ae46c1f0e11c0c2ea0";
  const EXECUTOR_ROLE_TL = "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";
  const ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("\nSAFE TRANSACTION calldata:");
  console.log(`TX1: grantRole(PROPOSER) → ${tl.encodeFunctionData("grantRole", [PROPOSER_ROLE, governor.address])}`);
  console.log(`TX2: grantRole(CANCELLER) → ${tl.encodeFunctionData("grantRole", [CANCELLER_ROLE, governor.address])}`);
  console.log(`TX3: grantRole(EXECUTOR) → ${tl.encodeFunctionData("grantRole", [EXECUTOR_ROLE_TL, ethers.constants.AddressZero])}`);
  console.log(`TX4: renounceRole(ADMIN) → ${tl.encodeFunctionData("renounceRole", [ADMIN_ROLE, SAFE])}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
