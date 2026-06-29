/**
 * Post-Governance Role Configuration v2 — Calldata Generator
 * For patched Governor 0x3DEDAf...a9eb + existing Timelock 0x0905...09Be
 * 
 * Execute via https://app.safe.global (Treasury Safe)
 */

const TIMELOCK = "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be";
const GOVERNOR = "0x3DEDAf8AF86838D3EB8342c2E0AE605B5F74a9eb";
const SAFE     = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const AU       = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG       = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

const ROLES = {
  PROPOSER:  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
  EXECUTOR:  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63",
  CANCELLER:"0x71a93f4e4345348d82222d19e03b647b43ed591762bf19ae46c1f0e11c0c2ea0",
  ADMIN:     "0x0000000000000000000000000000000000000000000000000000000000000000",
};

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
  console.log("║  Post-Governance v2: Safe Transaction Calldata              ║");
  console.log("║  Governor: 0x3DEDAf...a9eb (patched)                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const tl = new ethers.utils.Interface(timelockABI);
  const auIface = new ethers.utils.Interface(tokenABI);
  const agIface = new ethers.utils.Interface(tokenABI);

  const txs = [
    { label: "TX1: Grant PROPOSER_ROLE to Governor", to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.PROPOSER, GOVERNOR]) },
    { label: "TX2: Grant CANCELLER_ROLE to Governor", to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.CANCELLER, GOVERNOR]) },
    { label: "TX3: Grant EXECUTOR_ROLE to zero address", to: TIMELOCK,
      data: tl.encodeFunctionData("grantRole", [ROLES.EXECUTOR, ethers.constants.AddressZero]) },
    { label: "TX4: Renounce Safe admin on Timelock", to: TIMELOCK,
      data: tl.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]) },
    { label: "TX5a: Grant Au admin to Timelock", to: AU,
      data: auIface.encodeFunctionData("grantRole", [ROLES.ADMIN, TIMELOCK]) },
    { label: "TX5b: Renounce Safe admin on Au", to: AU,
      data: auIface.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]) },
    { label: "TX6a: Grant Ag admin to Timelock", to: AG,
      data: agIface.encodeFunctionData("grantRole", [ROLES.ADMIN, TIMELOCK]) },
    { label: "TX6b: Renounce Safe admin on Ag", to: AG,
      data: agIface.encodeFunctionData("renounceRole", [ROLES.ADMIN, SAFE]) },
  ];

  for (const tx of txs) {
    console.log(`${tx.label}`);
    console.log(`  to:   ${tx.to}`);
    console.log(`  data: ${tx.data}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("After these 8 Safe TXs, governance is LIVE:");
  console.log("  Governor proposes → Timelock queues → 48h delay → execute");
  console.log("  Au/Ag admin rights under Timelock control");
  console.log("  Safe can cancel (emergency) but cannot unilaterally act");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(err => { console.error(err); process.exit(1); });
