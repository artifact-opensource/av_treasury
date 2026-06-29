/**
 * Deploy Governor + Timelock and Activate Governance
 *
 * This script:
 * 1. Deploys ArtifactTimelock with Safe as admin
 * 2. Deploys GovernorContract with Timelock as executor
 * 3. Grants PROPOSER_ROLE, CANCELLER_ROLE to Governor on Timelock
 * 4. Transfers DEFAULT_ADMIN_ROLE on Au/Ag from deployer to Timelock
 * 5. Verifies all contracts on Basescan
 *
 * Run: npx hardhat run scripts/deploy_governance.js --network base
 */

const { ethers } = require("hardhat");

// ─── Addresses ──────────────────────────────────────────────────────────────
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ─── Governance Parameters ──────────────────────────────────────────────────
const VOTING_DELAY = 1;           // 1 block (~2s on Base)
const VOTING_PERIOD = 216000;      // ~3 days (216000 blocks * 2s)
const PROPOSAL_THRESHOLD = ethers.utils.parseUnits("100000", 18);  // 100K Ag
const QUORUM_BPS = 400;            // 4%
const TIMELOCK_MIN_DELAY = 48 * 60 * 60;  // 48 hours
const TIMELOCK_MAX_DELAY = 30 * 24 * 60 * 60;  // 30 days

// ─── ABIs ───────────────────────────────────────────────────────────────────
const accessControlABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function owner() view returns (address)",
];

const timelockABI = [
  "function MIN_DELAY() view returns (uint256)",
  "function pendingAdmin() view returns (address)",
  "function queueTransaction(address, uint256, string, bytes, uint256) returns (bytes32)",
  "function executeTransaction(address, uint256, string, bytes, uint256) returns (bytes32)",
  "function grantRole(bytes32 role, address account)",
  "function PROPOSER_ROLE() view returns (bytes32)",
  "function EXECUTOR_ROLE() view returns (bytes32)",
  "function CANCELLER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployerAddr = await signer.getAddress();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  AV Treasury — Governance Deployment & Activation          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("Deployer:", deployerAddr);
  console.log("Balance:", ethers.utils.formatEther(await ethers.provider.getBalance(deployerAddr)), "ETH");
  console.log();

  // ─── Step 1: Deploy Timelock ──────────────────────────────────────────────
  console.log("━━━ Step 1: Deploy ArtifactTimelock ━━━");

  const Timelock = await ethers.getContractFactory("ArtifactTimelock");
  const timelock = await Timelock.deploy(
    SAFE,                    // admin — Treasury Safe (3-of-5, currently 1-of-2)
    TIMELOCK_MIN_DELAY,
    TIMELOCK_MAX_DELAY
  );
  await timelock.deployed();
  console.log("  ✅ Timelock deployed:", timelock.address);

  // ─── Step 2: Deploy Governor ──────────────────────────────────────────────
  console.log("━━━ Step 2: Deploy GovernorContract ━━━");

  const Governor = await ethers.getContractFactory("GovernorContract");
  const governor = await Governor.deploy();
  await governor.deployed();
  console.log("  ✅ Governor deployed:", governor.address);

  // ─── Step 3: Initialize Governor ──────────────────────────────────────────
  console.log("━━━ Step 3: Initialize Governor ━━━");

  const initTx = await governor.initialize(
    AG,                      // token (voting token)
    timelock.address,        // executor (timelock)
    VOTING_DELAY,
    VOTING_PERIOD,
    PROPOSAL_THRESHOLD,
    QUORUM_BPS,
    { gasLimit: 500000 }
  );
  await initTx.wait();
  console.log("  ✅ Governor initialized");
  console.log("     Token:", AG);
  console.log("     Executor:", timelock.address);
  console.log("     Voting delay:", VOTING_DELAY, "blocks");
  console.log("     Voting period:", VOTING_PERIOD, "blocks (~3 days)");
  console.log("     Proposal threshold:", ethers.utils.formatUnits(PROPOSAL_THRESHOLD, 18), "Ag");
  console.log("     Quorum:", QUORUM_BPS / 100, "%");

  // ─── Step 4: Grant Timelock Roles ────────────────────────────────────────
  console.log("━━━ Step 4: Grant Timelock roles ━━━");

  const timelockContract = new ethers.Contract(timelock.address, timelockABI, signer);

  // Grant PROPOSER_ROLE to Governor
  const proposerRole = await timelockContract.PROPOSER_ROLE();
  const grantProposer = await timelockContract.grantRole(proposerRole, governor.address);
  await grantProposer.wait();
  console.log("  ✅ PROPOSER_ROLE granted to Governor");

  // Grant CANCELLER_ROLE to Governor
  const cancellerRole = await timelockContract.CANCELLER_ROLE();
  const grantCanceller = await timelockContract.grantRole(cancellerRole, governor.address);
  await grantCanceller.wait();
  console.log("  ✅ CANCELLER_ROLE granted to Governor");

  // Grant EXECUTOR_ROLE to zero address (anyone can execute after delay)
  const executorRole = await timelockContract.EXECUTOR_ROLE();
  const grantExecutor = await timelockContract.grantRole(executorRole, ethers.constants.AddressZero);
  await grantExecutor.wait();
  console.log("  ✅ EXECUTOR_ROLE granted to 0x0 (anyone can execute)");

  // ─── Step 5: Transfer Admin Roles ────────────────────────────────────────
  console.log("━━━ Step 5: Transfer admin roles to Timelock ━━━");

  const auContract = new ethers.Contract(AU, accessControlABI, signer);
  const agContract = new ethers.Contract(AG, accessControlABI, signer);

  const adminRole = await auContract.DEFAULT_ADMIN_ROLE();

  // Check current Au admin
  const auAdmin = await auContract.getRoleMember(adminRole, 0);
  console.log("  Au current admin:", auAdmin);

  if (auAdmin.toLowerCase() === deployerAddr.toLowerCase()) {
    // Grant to Timelock, then revoke from deployer
    const grantAu = await auContract.grantRole(adminRole, timelock.address);
    await grantAu.wait();
    console.log("  ✅ Au: DEFAULT_ADMIN_ROLE granted to Timelock");

    const revokeAu = await auContract.revokeRole(adminRole, deployerAddr);
    await revokeAu.wait();
    console.log("  ✅ Au: DEFAULT_ADMIN_ROLE revoked from deployer");
  } else {
    console.log("  ⚠️  Au admin is not deployer — skipping transfer");
  }

  // Check current Ag admin
  const agAdmin = await agContract.getRoleMember(adminRole, 0);
  console.log("  Ag current admin:", agAdmin);

  if (agAdmin.toLowerCase() === deployerAddr.toLowerCase()) {
    const grantAg = await agContract.grantRole(adminRole, timelock.address);
    await grantAg.wait();
    console.log("  ✅ Ag: DEFAULT_ADMIN_ROLE granted to Timelock");

    const revokeAg = await agContract.revokeRole(adminRole, deployerAddr);
    await revokeAg.wait();
    console.log("  ✅ Ag: DEFAULT_ADMIN_ROLE revoked from deployer");
  } else {
    console.log("  ⚠️  Ag admin is not deployer — skipping transfer");
  }

  // ─── Step 6: Verify on Basescan ──────────────────────────────────────────
  console.log("━━━ Step 6: Verify on Basescan ━━━");
  console.log("  Run manually:");
  console.log(`  npx hardhat verify --network base ${timelock.address} "${SAFE}" "${TIMELOCK_MIN_DELAY}" "${TIMELOCK_MAX_DELAY}"`);
  console.log(`  npx hardhat verify --network base ${governor.address}`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  GOVERNANCE ACTIVATION COMPLETE                            ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Timelock:  ${timelock.address}  ║`);
  console.log(`║  Governor:  ${governor.address}  ║`);
  console.log("║  Admin:     Treasury Safe                                  ║");
  console.log("║  Executor:  Governor → Timelock → 48h delay → Execute      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("⚠️  UPDATE address.book with new Governor and Timelock addresses!");
  console.log("⚠️  UPDATE docs/ADDRESS_BOOK.md with new addresses!");
  console.log("⚠️  FUND keeper wallet with ETH for gas!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
