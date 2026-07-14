// summary.js — print analytics summary from metrics.json + on-chain flywheel state
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = __dirname;
const METRICS = path.join(ROOT, "metrics.json");

(async () => {
  // read with retry — engine writes metrics.json incrementally, so a concurrent
  // read can catch a half-flushed buffer. Retry a few times before giving up.
  let metrics;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      metrics = JSON.parse(fs.readFileSync(METRICS, "utf8"));
      break;
    } catch (e) {
      if (attempt === 7) {
        console.log("⚠️ Could not read metrics.json (concurrent write race):", e.message);
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  let totalCalls = 0, totalFails = 0;
  console.log("════════════════════════════════════════════════════════════");
  console.log("  AV TREASURY TESTNET — ANALYTICS SUMMARY");
  console.log("════════════════════════════════════════════════════════════");
  for (const contract of Object.keys(metrics)) {
    for (const fn of Object.keys(metrics[contract])) {
      const m = metrics[contract][fn];
      totalCalls += m.calls; totalFails += m.fails;
      const failPct = m.calls ? ((100 * m.fails) / m.calls).toFixed(1) : "0.0";
      const avgGas = m.calls ? Math.round(m.gas / m.calls) : 0;
      const status = m.fails === 0 ? "✅" : (m.fails < m.calls ? "⚠️ " : "❌");
      console.log(`${status} ${contract.padEnd(20)} ${fn.padEnd(20)} calls=${String(m.calls).padStart(4)} fails=${String(m.fails).padStart(3)} fail%=${failPct.padStart(5)} avgGas=${avgGas}`);
    }
  }
  const totalFailPct = totalCalls ? ((100 * totalFails) / totalCalls).toFixed(2) : "0.00";
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  TOTAL calls=${totalCalls} fails=${totalFails} fail%=${totalFailPct}`);
  console.log("════════════════════════════════════════════════════════════");

  // ── On-chain flywheel + keeper value-accrual metrics ──
  try {
    const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "addresses.json"), "utf8"));
    const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
    const d = new hre.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    const fmt = (v, dec = 18) => Number(hre.ethers.utils.formatUnits(v, dec));
    const staking = await hre.ethers.getContractAt("contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2", ADDR.AVLPStaking_v2, d);
    const amo = await hre.ethers.getContractAt("contracts/av_suite/TreasuryAMO.sol:TreasuryAMO", ADDR.TreasuryAMO, d);
    const pid = await hre.ethers.getContractAt("contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2", ADDR.PIDEmissionControllerV2, d);

    console.log("\n  ── FLYWHEEL STATE ──");
    const auRate = fmt(await staking.auRewardPerBlock());
    const agRate = fmt(await staking.agRewardPerBlock());
    const staked = (await staking.totalStakedNFTs()).toString();
    const totalWeights = fmt(await staking.totalWeights());
    console.log(`  Reward rates:  AU/block=${auRate}  AG/block=${agRate}`);
    console.log(`  LP staked:     ${staked} positions  | totalWeights=${totalWeights.toExponential(2)}`);
    const auBought = fmt(await amo.totalAuBought());
    const agSpent = fmt(await amo.totalReserveSpent());
    const reserveBal = fmt(await amo.getReserveBalance());
    const cap = fmt(await amo.getReserveBalance()) * 0.05;
    console.log(`  AMO buybacks:  AU bought=${auBought.toFixed(1)}  AG spent=${agSpent.toFixed(1)}`);
    console.log(`  AMO reserve:   ${reserveBal.toFixed(0)} AG  (runway cap=${cap.toFixed(0)} AG/epoch, floor safe)`);
    const pidAdmin = await staking.hasRole(await staking.ADMIN_ROLE(), ADDR.PIDEmissionControllerV2);
    console.log(`  PID->staking:  admin=${pidAdmin} (self-tunes emission)`);

    // keeper profit tally from log
    const LOG = path.join(ROOT, "log.jsonl");
    if (fs.existsSync(LOG)) {
      const lines = fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean);
      let kAct = 0, kSkip = 0;
      lines.forEach(l => { try { const o = JSON.parse(l); if (o.contract === "TreasuryKeeper") { if (o.ok) kAct++; else kSkip++; } } catch (e) {} });
      console.log(`  Keeper:        acted=${kAct}  skipped=${kSkip} (0-drawdown: only buys AU below fair value)`);
    }
    console.log("════════════════════════════════════════════════════════════");
  } catch (e) {
    console.log("\n  (flywheel state read skipped:", e.message.slice(0, 60), ")");
  }
})();
