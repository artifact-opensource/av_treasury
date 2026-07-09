// scripts/redeploy_pid_v2.js
// Redeploy PID_Emission_Controller_v2 with the CORRECT staking proxy (0x8F63)
// and keeper as admin (so EMIT_ROLE is auto-granted by the constructor).
// Live PID 0xB8F2 currently points at the mis-wired 0xd81C. PID.staking is
// immutable (constructor arg), so we deploy a fresh, behaviorally-identical PID.
//
// Constructor: (admin, staking_, agToken_, targetTVL_, kp_, ki_, kd_)
// Params replicated from live 0xB8F2 (read on-chain 2026-07-08), except staking_.

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Live, verified topology (address.book == keeper config.py)
  const KEEPER      = process.env.PID_ADMIN || "0xc63B7A10BB926B3b25EcB51887945CaeB6927555";
  const STAKING     = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9"; // CORRECT proxy
  const AG_TOKEN    = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674"; // AgToken
  const TARGET_TVL  = hre.ethers.utils.parseUnits("10000000", 18); // 1e25 (10M)
  const KP          = hre.ethers.utils.parseUnits("100000", 9);     // 1e14
  const KI          = hre.ethers.utils.parseUnits("10000", 9);      // 1e13
  const KD          = hre.ethers.utils.parseUnits("50000", 9);      // 5e13

  console.log("ctor args:");
  console.log("  admin     :", KEEPER);
  console.log("  staking   :", STAKING, "(was 0xd81C — broken)");
  console.log("  agToken   :", AG_TOKEN);
  console.log("  targetTVL :", TARGET_TVL.toString());
  console.log("  kp/ki/kd  :", KP.toString(), KI.toString(), KD.toString());

  const Factory = await hre.ethers.getContractFactory("PID_Emission_Controller_v2");
  const pid = await Factory.deploy(KEEPER, STAKING, AG_TOKEN, TARGET_TVL, KP, KI, KD);
  await pid.deployed();
  const addr = pid.address;
  console.log("\nDEPLOYED PID_Emission_Controller_v2 ->", addr);

  // On-chain assertions
  const staking = await pid.staking();
  const ag = await pid.agToken();
  const admin = await pid.currentAdmin();
  const emitRole = await pid.EMIT_ROLE();
  const keeperHasEmit = await pid.hasRole(emitRole, KEEPER);
  console.log("assert staking()  == 0x8F63 :", staking.toLowerCase() === STAKING.toLowerCase());
  console.log("assert agToken()  == Ag     :", ag.toLowerCase() === AG_TOKEN.toLowerCase());
  console.log("assert admin      == KEEPER :", admin.toLowerCase() === KEEPER.toLowerCase());
  console.log("assert KEEPER EMIT_ROLE     :", keeperHasEmit);

  console.log("\nNEW_PID_ADDRESS=" + addr);
}

main().catch((e) => { console.error(e); process.exit(1); });
