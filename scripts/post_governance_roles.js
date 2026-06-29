/**
 * Post-Governance Role Configuration — Calldata Generator
 * 
 * These transactions must be executed by the Treasury Safe via https://.app.safe.global
 * The Safe is the only address with DEFAULT_ADMIN_ROLE on the Timelock.
 * 
 * 6 transactions total:
 *   1-3: Configure Timelock roles (proposer, executor, canceler)
 *   4:   Renounce Safe's admin role (decentralize)
 *   5-6: Transfer Au/Ag admin to Timelock
 */

const TIMELOCK = "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be";
const GOVERNOR = "0x1Dc51EccAeA0c9fb41Bc42d6e452D2c27225f0a9";
const SAFE     = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const AU       = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG       = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

// OpenZeppelin AccessControl role hashes
const ROLES = {
  PROPOSER:  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
  EXECUTOR:  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63",
  CANCELLER:"0x71a93f4e4345348d82222d19e03b647b43ed591762bf19ae46c1f0e11c0c2ea0",
  ADMIN:     "0x0000000000000000000000000000000000000000000000000000000000000000",
};

// Minimal ABIs
const timelockABI = [
  "function grantRole(bytes32 role, address account)",
  "function renounceRole(bytes32 role, address account)",
];

const tokenABI = [
  "function grantRole(bytes32 role, address account)",
  "function renounceRole(bytes32 role, address account)",
];

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Post-Governance: Safe Transaction Calldata                 ║");
  console.log("║  Execute via https://app.safe.global                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const tl = new ethers.utils.Interface(timelockABI);
  const auIface = new ethers.utils.Interface(tokenABI);
  const agIface = new ethers.utils.Interface(tokenABI);

  const txs = [
    {
      label: "TX1: Grant PROPOSER_ROLE to Governor",
      to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.PROPOSER, GOVERNOR]),
    },
    {
      label: "TX2: Grant CANCELLER_ROLE to Governor",
      to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.CANCELLER, GOVERNOR]),
    },
    {
      label: "TX3: Grant EXECUTOR_ROLE to zero address (open execution)",
      to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.EXECUTOR, ethers.constants.AddressZero]),
    },
    {
      label: "TX4: Renounce Safe admin on Timelock (decentralize)",
      to: TIMELOCK,
      data: tl.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]),
    },
    {
      label: "TX5a: Grant Au DEFAULT_ADMIN_ROLE to Timelock",
      to: AU,
      data: auIface.encodeFunctionData("grantRole", [ROLES.ADMIN, TIMELOCK]),
    },
    {
      label: "TX5b: Renounce Safe admin on Au",
      to: AU,
      data: auIface.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]),
    },
    {
      label: "TX6a: Grant Ag DEFAULT_ADMIN_ROLE to Timelock",
      to: AG,
      data: agIface.encodeFunctionData("grantRole", [ROLES.ADMIN, TIMELOCK]),
    },
    {
      label: "TX6b: Renounce Safe admin on Ag",
      to: AG,
      data: agIface.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]),
    },
  ];

  for (const tx of txs) {
    console.log(`${tx.label}`);
    console.log(`  to:   ${tx.to}`);
    console.log(`  data: ${tx.data}`);
    console.log();
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("After these Safe transactions, governance is LIVE:");
  console.log("  Governor proposes → Timelock queues → 48h delay → execute");
  console.log("  Au/Ag admin rights under Timelock control");
  console.log("  Safe can cancel (emergency) but cannot unilaterally act");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
