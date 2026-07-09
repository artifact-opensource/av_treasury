// Deploy AvOracle (v6 source) with bootstrap-price support.
// Pattern mirrors redeploy_pid_v2.js + deploy_oracle_v5.js.
//
// Governance flow (avoids 48h Timelock for bring-up):
//   1. Deploy with temp governor = deployer (0x21E9...), admin = keeper (0xc63B...).
//   2. Deployer sets bootstrap mode + nominal Au/Ag prices instantly.
//   3. Keeper (DEFAULT_ADMIN_ROLE) grants GOVERNOR to the real Governor (0x5F06...),
//      then deployer renounces its temp GOVERNOR -> full self-custody restored.
//   4. Etherscan-verify. Repoint keeper config + ABI.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Hardhat loads .env; the funded/operational key is KEEPER_PRIVATE_KEY (also DEFAULT_ADMIN_ROLE).
// Deploy AS the keeper: it becomes temp governor (constructor _governor) + admin, sets prices,
// then grants GOVERNOR to the real Governor (0x5F06) and renounces its temp role.
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY;

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const KEEPER = "0xc63B7A10BB926B3b25EcB51887945CaeB6927555"; // DEFAULT_ADMIN_ROLE (derived from KEEPER_PRIVATE_KEY)
const REAL_GOVERNOR = "0x5F061c177b76753686122185989C2332C1d0e8b1"; // Governor contract
const NOMINAL = hre.ethers.utils.parseUnits("0.01", 18); // 1e16, Au=Ag=0.01 (18-dec price)
const VALIDITY = 30n * 24n * 60n * 60n; // 30 days

function log(...a) { console.log("[deploy_oracle_v6]", ...a); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log("deployer:", deployer.address);

  const Oracle = await hre.ethers.getContractFactory("AvOracle");
  const oracle = await Oracle.deploy(AU, AG, KEEPER, deployer.address);
  await oracle.deployed();
  const addr = oracle.address;
  log("DEPLOYED AvOracle:", addr);
  log("deploy tx:", oracle.deployTransaction.hash);

  // Save address for downstream steps
  fs.writeFileSync(path.join(__dirname, "..", ".oracle_addr"), addr + "\n");

  // ── Bootstrap prices (deployer is temp GOVERNOR) ──────────────────────
  log("setting bootstrap mode + nominal Au/Ag prices...");
  let r = await oracle.setBootstrapMode(true); await r.wait();
  r = await oracle.setBootstrapPrice(AU, NOMINAL, VALIDITY); await r.wait();
  r = await oracle.setBootstrapPrice(AG, NOMINAL, VALIDITY); await r.wait();
  log("bootstrap set. Au=Ag=0.01, mode=true");

  // ── Verify on Etherscan ───────────────────────────────────────────────
  log("waiting for block confirmations before verify...");
  try {
    await oracle.deployTransaction.wait(5);
  } catch (e) { log("wait warn:", e.message); }
  try {
    await hre.run("verify:verify", {
      address: addr,
      constructorArguments: [AU, AG, KEEPER, deployer.address],
    });
    log("VERIFY OK");
  } catch (e) {
    log("verify skipped/failed:", e.message);
  }

  // ── Transfer GOVERNOR to real Governor (keeper is both admin + temp governor) ─
  log("keeper/deployer:", deployer.address);
  r = await oracle.grantRole(await oracle.GOVERNOR(), REAL_GOVERNOR); await r.wait();
  log("granted GOVERNOR to real Governor", REAL_GOVERNOR);

  // Keeper renounces its temp GOVERNOR -> full self-custody via 0x5F06
  r = await oracle.renounceRole(await oracle.GOVERNOR(), deployer.address); await r.wait();
  log("keeper renounced temp GOVERNOR");

  const gov = await oracle.hasRole(await oracle.GOVERNOR(), REAL_GOVERNOR);
  const dep = await oracle.hasRole(await oracle.GOVERNOR(), deployer.address);
  log("final GOVERNOR(real)=", gov, " GOVERNOR(keeper)=", dep);

  // ── Sanity: read bootstrap price ──────────────────────────────────────
  const p = await oracle.getPrice(AU);
  log("getPrice(AU) =", hre.ethers.utils.formatUnits(p, 18), "(expect 0.01)");

  // ── Update keeper ABI file (real_oracle_abi.json) ─────────────────────
  const art = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "artifacts", "contracts", "av_suite", "AvOracle.sol", "AvOracle.json")));
  const abiPath = path.join(__dirname, "..", "keeper", "keeper", "abis", "real_oracle_abi.json");
  fs.writeFileSync(abiPath, JSON.stringify(art.abi, null, 2));
  log("updated keeper ABI:", abiPath);

  console.log("\n=== NEXT: update keeper/keeper/config.py CONTRACTS['quasicrystal'] ->", addr, "===");
}

main().catch((e) => { console.error(e); process.exit(1); });
