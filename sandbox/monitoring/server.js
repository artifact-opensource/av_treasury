#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Analytics HTTP Server — AV Treasury Sandbox Dashboard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Serves real-time analytics from the AnalyticsEngine + live contract polling.
 * Runs the BotEngine simultaneously so data is always moving.
 *
 * Usage:
 *   node sandbox/monitoring/server.js [--port 7000] [--interval 3000] [--bots]
 *
 * Endpoints:
 *   GET /api/status        — System status
 *   GET /api/metrics       — Latest full metrics snapshot
 *   GET /api/history       — Full history (or ?limit=50)
 *   GET /api/stats         — Summary statistics
 *   GET /api/contracts     — Contract addresses
 *   GET /api/bot           — BotEngine stats (if running)
 *   GET /                  — HTML dashboard
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// ── Parse args ────────────────────────────────────────────────────
const args = {
  port: 7000,
  interval: 3000,
  rpcUrl: 'http://127.0.0.1:8545',
  configPath: path.join(__dirname, '..', 'config', 'deployed.json'),
  runBots: false,
  botRounds: 200,
};

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) { args.port = parseInt(process.argv[i + 1]); i++; }
  if (process.argv[i] === '--interval' && process.argv[i + 1]) { args.interval = parseInt(process.argv[i + 1]); i++; }
  if (process.argv[i] === '--rpc' && process.argv[i + 1]) { args.rpcUrl = process.argv[i + 1]; i++; }
  if (process.argv[i] === '--bots') { args.runBots = true; }
  if (process.argv[i] === '--bot-rounds' && process.argv[i + 1]) { args.botRounds = parseInt(process.argv[i + 1]); i++; }
}

// ── Contract ABIs ──────────────────────────────────────────────────
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalBurned() view returns (uint256)',
];

const DEX_ABI = [
  'function getReserveA() view returns (uint256)',
  'function getReserveB() view returns (uint256)',
  'function totalLPSupply() view returns (uint256)',
  'function getTvl() view returns (uint256)',
  'function accumulatedFeesA() view returns (uint256)',
  'function accumulatedFeesB() view returns (uint256)',
];

const LP_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
];

const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function getTvl() view returns (uint256)',
  'function rewardRateAu() view returns (uint256)',
  'function rewardRateAg() view returns (uint256)',
  'function accRewardPerTokenAu() view returns (uint256)',
  'function accRewardPerTokenAg() view returns (uint256)',
];

const PID_ABI = [
  'function getCurrentError() view returns (int256)',
  'function targetTvl() view returns (int256)',
  'function remainingDailyEmission() view returns (uint256)',
  'function maxDailyEmission() view returns (uint256)',
  'function dailyEmitted() view returns (uint256)',
  'function canEmit() view returns (bool)',
];

const TREASURY_AMO_ABI = [
  'function totalBuybacksExecuted() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
  'function totalAgSpent() view returns (uint256)',
  'function maxBuybackAmount() view returns (uint256)',
  'function canExecute() view returns (bool)',
  'function runway() view returns (uint256)',
];

const GOVERNOR_ABI = [
  'function proposalCount() view returns (uint256)',
];

// ── State ─────────────────────────────────────────────────────────
let provider;
let contracts = {};
let config = {};
let history = [];
let latestData = null;
let round = 0;
let anomalies = [];
let serverStartTime = Date.now();
let botEngine = null;
let botStats = {
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  totalVolume: 0n,
  tradesByType: {},
  uniqueTraders: new Set(),
  running: false,
};

// ── Initialize ────────────────────────────────────────────────────
async function init() {
  try {
    config = JSON.parse(fs.readFileSync(args.configPath, 'utf8'));
  } catch (e) {
    console.error('⚠️  deployed.json not found. Run deploy-sandbox.js first.');
    process.exit(1);
  }

  provider = new ethers.providers.JsonRpcProvider(args.rpcUrl);

  const c = config.contracts;
  contracts.auToken = new ethers.Contract(c.AuToken, ERC20_ABI, provider);
  contracts.agToken = new ethers.Contract(c.AgToken, ERC20_ABI, provider);
  contracts.dex = new ethers.Contract(c.DexSimulator, DEX_ABI, provider);
  contracts.lpToken = new ethers.Contract(c.LpToken, LP_TOKEN_ABI, provider);
  contracts.staking = new ethers.Contract(c.Staking, STAKING_ABI, provider);
  contracts.pid = new ethers.Contract(c.PIDController, PID_ABI, provider);
  contracts.treasuryAMO = new ethers.Contract(c.TreasuryAMO, TREASURY_AMO_ABI, provider);
  contracts.governor = new ethers.Contract(c.Governor, GOVERNOR_ABI, provider);

  console.log('✅ Contracts connected');
}

// ── Collect metrics ───────────────────────────────────────────────
async function collect() {
  round++;
  const timestamp = Date.now();

  try {
    const blockNumber = await provider.getBlockNumber();

    const [
      auSupply, agSupply, totalBurned,
      reserveA, reserveB, lpSupply, dexTvl, feesA, feesB,
      stakedTvl, stakingTvl, rewardRateAu, rewardRateAg, accRewardAu, accRewardAg,
      pidError, pidTarget, pidRemainingDaily, pidMaxDaily, pidDailyEmitted, canEmit,
      treasuryBuybacks, treasuryAuBought, treasuryAgSpent, treasuryMaxBuyback, treasuryRunway, canExecute,
      proposalCount,
    ] = await Promise.all([
      contracts.auToken.totalSupply(),
      contracts.agToken.totalSupply(),
      contracts.auToken.totalBurned().catch(() => 0),
      contracts.dex.getReserveA(),
      contracts.dex.getReserveB(),
      contracts.lpToken.totalSupply(),
      contracts.dex.getTvl().catch(() => 0),
      contracts.dex.accumulatedFeesA().catch(() => 0),
      contracts.dex.accumulatedFeesB().catch(() => 0),
      contracts.staking.totalStaked(),
      contracts.staking.getTvl().catch(() => 0),
      contracts.staking.rewardRateAu().catch(() => 0),
      contracts.staking.rewardRateAg().catch(() => 0),
      contracts.staking.accRewardPerTokenAu().catch(() => 0),
      contracts.staking.accRewardPerTokenAg().catch(() => 0),
      contracts.pid.getCurrentError().catch(() => 0),
      contracts.pid.targetTvl().catch(() => 0),
      contracts.pid.remainingDailyEmission().catch(() => 0),
      contracts.pid.maxDailyEmission().catch(() => 0),
      contracts.pid.dailyEmitted().catch(() => 0),
      contracts.pid.canEmit().catch(() => false),
      contracts.treasuryAMO.totalBuybacksExecuted().catch(() => 0),
      contracts.treasuryAMO.totalAuBought().catch(() => 0),
      contracts.treasuryAMO.totalAgSpent().catch(() => 0),
      contracts.treasuryAMO.maxBuybackAmount().catch(() => 0),
      contracts.treasuryAMO.runway().catch(() => 0),
      contracts.treasuryAMO.canExecute().catch(() => false),
      contracts.governor.proposalCount().catch(() => 0),
    ]);

    // Derived metrics
    const price = reserveA.gt(0) ? reserveB.mul(ethers.constants.WeiPerEther).div(reserveA) : ethers.constants.Zero;
    const dexK = reserveA.mul(reserveB).div(ethers.constants.WeiPerEther);
    const dexRatio = reserveB.gt(0) ? Number(reserveA.mul(10000).div(reserveB)) / 10000 : 0;
    const totalReserve = reserveA.add(reserveB);
    const slippagePct = totalReserve.gt(0)
      ? Math.abs(Number(reserveA) - Number(reserveB)) / Number(totalReserve) * 100
      : 0;

    // Staking APY (annualized) — use BigNumber math throughout
    const BLOCKS_PER_YEAR_BN = ethers.BigNumber.from(2628000);
    const auApy = stakingTvl.gt(0) && price.gt(0)
      ? Number(BLOCKS_PER_YEAR_BN.mul(rewardRateAu).mul(price).div(stakingTvl).div(ethers.constants.WeiPerEther)) / 1e18
      : 0;
    const agApy = stakingTvl.gt(0) && price.gt(0)
      ? Number(BLOCKS_PER_YEAR_BN.mul(rewardRateAg).mul(ethers.constants.WeiPerEther).div(stakingTvl)) / 1e18
      : 0;

    // PID derived
    const pidErrorPct = !pidTarget.isZero() ? Number(pidError) / Number(pidTarget) : 0;
    const pidEmissionRate = pidMaxDaily.gt(0) ? Number(pidDailyEmitted) / Number(pidMaxDaily) : 0;

    // Treasury balance
    const treasuryBalance = await contracts.agToken.balanceOf(config.contracts.TreasuryAMO).catch(() => ethers.constants.Zero);
    const treasuryRunwayMonths = treasuryAgSpent.gt(0)
      ? Number(treasuryBalance) / (Number(treasuryAgSpent) / 12)
      : 999;

    // Health score
    let health = 100;
    if (price.gt(0) && history.length > 0) {
      const prevPrice = Number(history[history.length - 1]?.computed?.price || 0);
      if (prevPrice > 0) {
        const change = Math.abs(Number(price) / 1e18 - prevPrice) / prevPrice;
        health -= Math.min(25, change * 250);
      }
    } else if (price.eq(0)) health -= 25;
    if (stakedTvl.eq(0)) health -= 25;
    health -= Math.min(20, Math.abs(pidErrorPct) * 200);
    if (treasuryRunwayMonths < 6) health -= Math.max(0, (6 - treasuryRunwayMonths) * 2.5);
    if (reserveA.eq(0) || reserveB.eq(0)) health -= 15;
    else health -= Math.min(15, slippagePct * 0.3);
    health = Math.max(0, Math.min(100, Math.round(health)));

    // Detect anomalies
    const newAnomalies = [];
    if (history.length > 0) {
      const prevPrice = Number(history[history.length - 1]?.computed?.price || 0);
      const currPrice = Number(price) / 1e18;
      if (prevPrice > 0 && currPrice > 0) {
        const drop = (prevPrice - currPrice) / prevPrice;
        if (drop > 0.05) newAnomalies.push({ type: 'PRICE_DROP', severity: 'warning', msg: `Au price dropped ${(drop*100).toFixed(2)}%` });
      }
    }
    if (slippagePct > 10) newAnomalies.push({ type: 'HIGH_SLIPPAGE', severity: 'critical', msg: `DEX slippage ${slippagePct.toFixed(2)}%` });
    if (treasuryRunwayMonths < 3) newAnomalies.push({ type: 'LOW_RUNWAY', severity: 'critical', msg: `Treasury runway < 3 months` });
    if (Math.abs(pidErrorPct) > 0.1) newAnomalies.push({ type: 'PID_ERROR', severity: 'warning', msg: `PID error ${(pidErrorPct*100).toFixed(2)}%` });
    if (reserveA.eq(0) || reserveB.eq(0)) newAnomalies.push({ type: 'EMPTY_DEX', severity: 'critical', msg: 'DEX reserves empty' });

    anomalies = newAnomalies;

    const dataPoint = {
      timestamp, round, blockNumber,
      // Raw contract data (strings)
      raw: {
        auSupply: auSupply.toString(),
        agSupply: agSupply.toString(),
        totalBurned: totalBurned.toString(),
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
        lpSupply: lpSupply.toString(),
        dexTvl: dexTvl.toString(),
        feesA: feesA.toString(),
        feesB: feesB.toString(),
        stakedTvl: stakedTvl.toString(),
        stakingTvl: stakingTvl.toString(),
        rewardRateAu: rewardRateAu.toString(),
        rewardRateAg: rewardRateAg.toString(),
        accRewardPerTokenAu: accRewardAu.toString(),
        accRewardPerTokenAg: accRewardAg.toString(),
        pidError: pidError.toString(),
        pidTarget: pidTarget.toString(),
        pidRemainingDaily: pidRemainingDaily.toString(),
        pidMaxDaily: pidMaxDaily.toString(),
        pidDailyEmitted: pidDailyEmitted.toString(),
        treasuryBuybacks: treasuryBuybacks.toString(),
        treasuryAuBought: treasuryAuBought.toString(),
        treasuryAgSpent: treasuryAgSpent.toString(),
        treasuryMaxBuyback: treasuryMaxBuyback.toString(),
        treasuryRunway: treasuryRunway.toString(),
        treasuryBalance: treasuryBalance.toString(),
        proposalCount: proposalCount.toString(),
      },
      // Computed/derived (numbers for charts)
      computed: {
        price: Number(price) / 1e18,
        dexK: Number(dexK) / 1e18,
        dexRatio,
        slippagePct,
        auApy,
        agApy,
        combinedApy: auApy + agApy,
        pidErrorPct,
        pidEmissionRate,
        treasuryRunwayMonths,
        health,
      },
      // Bot stats
      bot: {
        totalTrades: botStats.totalTrades,
        successfulTrades: botStats.successfulTrades,
        failedTrades: botStats.failedTrades,
        totalVolume: botStats.totalVolume.toString(),
        uniqueTraders: botStats.uniqueTraders.size,
        running: botStats.running,
        tradesByType: botStats.tradesByType,
      },
      // Anomalies
      anomalies: newAnomalies,
    };

    latestData = dataPoint;
    history.push(dataPoint);
    if (history.length > 1000) history = history.slice(-1000);

  } catch (e) {
    console.error(`[Collect] Error: ${e.message}`);
    if (!global.collectErrors) global.collectErrors = 0;
    global.collectErrors++;
  }
}

// ── BotEngine integration ─────────────────────────────────────────
async function startBots() {
  if (!args.runBots) return;
  console.log(`🤖 Starting BotEngine (${args.botRounds} rounds)...`);

  try {
    const { BotEngine } = require('../bots/BotEngine');
    botEngine = new BotEngine();
    await botEngine.init();

    // Track stats
    botStats.running = true;
    const origSwap = botEngine._swap.bind(botEngine);
    botEngine._swap = async function(bot, state) {
      const before = botEngine.stats.totalTrades;
      await origSwap(bot, state);
      if (botEngine.stats.totalTrades > before) {
        botStats.totalTrades = botEngine.stats.totalTrades;
        botStats.successfulTrades = botEngine.stats.successfulTrades;
        botStats.totalVolume = botEngine.stats.totalVolume;
        botStats.tradesByType = { ...botEngine.stats.tradesByType };
        botStats.uniqueTraders = botEngine.stats.uniqueTraders;
      }
    };

    // Run in background
    botEngine.start(args.botRounds).then(() => {
      botStats.running = false;
      console.log('✅ BotEngine completed');
    }).catch(e => {
      botStats.running = false;
      console.error('BotEngine error:', e.message);
    });

  } catch (e) {
    console.error('Failed to start BotEngine:', e.message);
  }
}

// ── HTTP Server ───────────────────────────────────────────────────

function fmt(val, decimals = 2) {
  if (val === undefined || val === null || val === '0') return '0';
  const n = Number(val);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${args.port}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    switch (url.pathname) {
      case '/api/status': {
        const block = await provider.getBlockNumber().catch(() => 0);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'ok', blockNumber: block, round,
          uptime: Date.now() - serverStartTime,
          interval: args.interval, historyLength: history.length,
          collectErrors: global.collectErrors || 0,
          botsRunning: botStats.running,
        }));
        break;
      }
      case '/api/metrics': {
        if (!latestData) { res.writeHead(503); res.end('{"error":"No data yet"}'); break; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(latestData));
        break;
      }
      case '/api/history': {
        const limit = parseInt(url.searchParams.get('limit')) || history.length;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(history.slice(-limit)));
        break;
      }
      case '/api/stats': {
        if (history.length === 0) { res.writeHead(503); res.end('{"error":"No data"}'); break; }
        const prices = history.map(d => d.computed.price);
        const tvls = history.map(d => Number(d.raw.dexTvl) / 1e18);
        const healths = history.map(d => d.computed.health);
        const fees = history.map(d => (Number(d.raw.feesA) + Number(d.raw.feesB)) / 1e18);
        const volumes = history.map(d => Number(d.raw.reserveA) / 1e18);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          dataPoints: history.length,
          price: { min: Math.min(...prices), max: Math.max(...prices), current: prices[prices.length-1], change: prices.length > 1 ? ((prices[prices.length-1] - prices[0]) / prices[0] * 100) : 0 },
          tvl: { min: Math.min(...tvls), max: Math.max(...tvls), current: tvls[tvls.length-1] },
          health: { min: Math.min(...healths), max: Math.max(...healths), current: healths[healths.length-1] },
          fees: { total: fees.reduce((a,b) => a+b, 0) },
          volume: { total: volumes.reduce((a,b) => a+b, 0) },
          alerts: { total: history.reduce((s, d) => s + d.anomalies.length, 0) },
          bot: { totalTrades: botStats.totalTrades, successful: botStats.successfulTrades, failed: botStats.failedTrades, uniqueTraders: botStats.uniqueTraders.size },
        }));
        break;
      }
      case '/api/contracts': {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(config.contracts, null, 2));
        break;
      }
      case '/api/bot': {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          running: botStats.running,
          totalTrades: botStats.totalTrades,
          successfulTrades: botStats.successfulTrades,
          failedTrades: botStats.failedTrades,
          totalVolume: botStats.totalVolume.toString(),
          uniqueTraders: botStats.uniqueTraders.size,
          tradesByType: botStats.tradesByType,
        }));
        break;
      }
      case '/': {
        res.setHeader('Content-Type', 'text/html');
        res.end(getDashboardHTML());
        break;
      }
      default: { res.writeHead(404); res.end('{"error":"Not found"}'); }
    }
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

// ── HTML Dashboard ────────────────────────────────────────────────
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AV Treasury — Sandbox Analytics</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'SF Mono','Fira Code',monospace;background:#0a0e17;color:#e1e8ed;min-height:100vh}
.header{background:linear-gradient(135deg,#1a1f35,#0d1117);border-bottom:1px solid #21262d;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:16px;color:#58a6ff}
.status{font-size:11px;color:#8b949e}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3fb950;margin-right:5px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;padding:16px 24px}
.card{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:14px}
.card h3{font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.metric{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.metric .label{font-size:11px;color:#8b949e}
.metric .value{font-size:14px;color:#58a6ff;font-weight:600}
.metric .value.green{color:#3fb950}
.metric .value.yellow{color:#d29922}
.metric .value.red{color:#f85149}
.metric .value.white{color:#e1e8ed}
.wide{grid-column:1/-1}
.chart-box{position:relative;height:180px;margin-top:6px}
canvas{width:100%!important;height:100%!important}
.alerts{max-height:120px;overflow-y:auto}
.alert{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:11px}
.alert.warning{background:#d2992220;border-left:3px solid #d29922;color:#d29922}
.alert.critical{background:#f8514920;border-left:3px solid #f85149;color:#f85149}
.footer{text-align:center;padding:12px;color:#484f58;font-size:10px}
</style>
</head>
<body>
<div class="header">
  <h1>🏛️ AV Treasury — Sandbox Analytics</h1>
  <div class="status"><span class="dot" id="dot"></span><span id="status">Connecting...</span></div>
</div>
<div class="grid">
  <div class="card"><h3>💎 Tokens</h3>
    <div class="metric"><span class="label">Au Supply</span><span class="value" id="au-supply">—</span></div>
    <div class="metric"><span class="label">Ag Supply</span><span class="value" id="ag-supply">—</span></div>
    <div class="metric"><span class="label">Au Burned</span><span class="value yellow" id="burned">—</span></div>
  </div>
  <div class="card"><h3>📊 DEX</h3>
    <div class="metric"><span class="label">Price (Au/Ag)</span><span class="value" id="price">—</span></div>
    <div class="metric"><span class="label">Reserve A (Ag)</span><span class="value" id="reserve-a">—</span></div>
    <div class="metric"><span class="label">Reserve B (Au)</span><span class="value" id="reserve-b">—</span></div>
    <div class="metric"><span class="label">TVL</span><span class="value green" id="tvl">—</span></div>
    <div class="metric"><span class="label">Slippage</span><span class="value" id="slippage">—</span></div>
    <div class="metric"><span class="label">Fees (Au)</span><span class="value yellow" id="fees">—</span></div>
  </div>
  <div class="card"><h3>🔒 Staking</h3>
    <div class="metric"><span class="label">Total Staked</span><span class="value" id="staked">—</span></div>
    <div class="metric"><span class="label">TVL</span><span class="value" id="staking-tvl">—</span></div>
    <div class="metric"><span class="label">APY (Au)</span><span class="value green" id="apy-au">—</span></div>
    <div class="metric"><span class="label">APY (Ag)</span><span class="value green" id="apy-ag">—</span></div>
    <div class="metric"><span class="label">Combined APY</span><span class="value green" id="apy-combined">—</span></div>
  </div>
  <div class="card"><h3>🎛️ PID Controller</h3>
    <div class="metric"><span class="label">Error</span><span class="value" id="pid-error">—</span></div>
    <div class="metric"><span class="label">Target TVL</span><span class="value" id="pid-target">—</span></div>
    <div class="metric"><span class="label">Daily Emitted</span><span class="value" id="pid-daily">—</span></div>
    <div class="metric"><span class="label">Emission Rate</span><span class="value" id="pid-rate">—</span></div>
    <div class="metric"><span class="label">Can Emit</span><span class="value" id="pid-canemit">—</span></div>
  </div>
  <div class="card"><h3>🏦 Treasury AMO</h3>
    <div class="metric"><span class="label">Balance</span><span class="value" id="treasury-balance">—</span></div>
    <div class="metric"><span class="label">Buybacks</span><span class="value" id="buybacks">—</span></div>
    <div class="metric"><span class="label">Au Bought</span><span class="value" id="au-bought">—</span></div>
    <div class="metric"><span class="label">Ag Spent</span><span class="value" id="ag-spent">—</span></div>
    <div class="metric"><span class="label">Runway (mo)</span><span class="value" id="runway">—</span></div>
    <div class="metric"><span class="label">Can Execute</span><span class="value" id="amo-canexecute">—</span></div>
  </div>
  <div class="card"><h3>🤖 Bot Engine</h3>
    <div class="metric"><span class="label">Status</span><span class="value" id="bot-status">—</span></div>
    <div class="metric"><span class="label">Total Trades</span><span class="value" id="bot-trades">—</span></div>
    <div class="metric"><span class="label">Successful</span><span class="value green" id="bot-success">—</span></div>
    <div class="metric"><span class="label">Failed</span><span class="value red" id="bot-failed">—</span></div>
    <div class="metric"><span class="label">Unique Traders</span><span class="value" id="bot-unique">—</span></div>
    <div class="metric"><span class="label">Volume</span><span class="value" id="bot-volume">—</span></div>
  </div>
  <div class="card"><h3>⚡ System</h3>
    <div class="metric"><span class="label">Health Score</span><span class="value" id="health">—</span></div>
    <div class="metric"><span class="label">DEX Ratio</span><span class="value" id="dex-ratio">—</span></div>
    <div class="metric"><span class="label">LP Supply</span><span class="value" id="lp-supply">—</span></div>
    <div class="metric"><span class="label">Proposals</span><span class="value" id="proposals">—</span></div>
  </div>
  <div class="card"><h3>⚠️ Alerts</h3>
    <div class="alerts" id="alerts"><div class="metric"><span class="label">No alerts</span></div></div>
  </div>
  <div class="card wide"><h3>📈 Price (Au/Ag)</h3><div class="chart-box"><canvas id="price-chart"></canvas></div></div>
  <div class="card wide"><h3>📊 TVL</h3><div class="chart-box"><canvas id="tvl-chart"></canvas></div></div>
  <div class="card wide"><h3💰 Reserve A (Ag) vs Reserve B (Au)</h3><div class="chart-box"><canvas id="reserves-chart"></canvas></div></div>
  <div class="card wide"><h3>🎛️ PID Error</h3><div class="chart-box"><canvas id="pid-chart"></canvas></div></div>
  <div class="card wide"><h3>💎 Au Supply vs Burned</h3><div class="chart-box"><canvas id="supply-chart"></canvas></div></div>
  <div class="card wide"><h3>🤖 Bot Trades Over Time</h3><div class="chart-box"><canvas id="bot-chart"></canvas></div></div>
  <div class="card wide"><h3>⚡ Health Score</h3><div class="chart-box"><canvas id="health-chart"></canvas></div></div>
  <div class="card wide"><h3>🏦 Treasury Balance</h3><div class="chart-box"><canvas id="treasury-chart"></canvas></div></div>
</div>
<div class="footer">AV Treasury Sandbox Monitor • Block <span id="block">—</span> • Round <span id="round">—</span> • Uptime <span id="uptime">—</span></div>
<script>
const fmt=(v,d=2)=>{if(!v||v==='0')return'0';const n=Number(v);if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return n.toFixed(d)};
const fmtPct=(v)=>{if(!v||v==='0')return'0%';return(Number(v)*100).toFixed(2)+'%'};

let priceData=[],tvlData=[],reserveAData=[],reserveBData=[],pidData=[],supplyData=[],burnData=[],botData=[],healthData=[],treasuryData=[],tradeCount=0;
let lastBotTrades=0;

function drawChart(id,data,color,label,fmtFn){
  const c=document.getElementById(id);const ctx=c.getContext('2d');
  const dpr=window.devicePixelRatio||1;const r=c.getBoundingClientRect();
  c.width=r.width*dpr;c.height=r.height*dpr;ctx.scale(dpr,dpr);
  const w=r.width,h=r.height;
  ctx.clearRect(0,0,w,h);
  if(data.length<2)return;
  const ys=data.map(d=>d.y);const minY=Math.min(...ys)*0.98;const maxY=Math.max(...ys)*1.02;const range=maxY-minY||1;
  ctx.strokeStyle='#21262d';ctx.lineWidth=1;
  for(let i=0;i<4;i++){const y=h*0.1+(h*0.8/3)*i;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
  data.forEach((d,i)=>{const x=(i/(data.length-1))*w;const y=h*0.9-((d.y-minY)/range)*h*0.8;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
  ctx.stroke();
  ctx.globalAlpha=0.08;ctx.fillStyle=color;
  const lastY=h*0.9-((data[data.length-1].y-minY)/range)*h*0.8;
  ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle='#8b949e';ctx.font='10px monospace';
  ctx.fillText(label,8,14);
  const fn=fmtFn||fmt;
  ctx.fillText(fn(maxY),8,h*0.1+4);
  ctx.fillText(fn(minY),8,h*0.95);
}

async function fetchMetrics(){
  try{
    const d=await(await fetch('/api/metrics')).json();
    if(!d)return;
    document.getElementById('status').textContent='Live — Block '+d.blockNumber;
    document.getElementById('block').textContent=d.blockNumber;
    document.getElementById('round').textContent=d.round;
    document.getElementById('au-supply').textContent=fmt(d.raw.auSupply);
    document.getElementById('ag-supply').textContent=fmt(d.raw.agSupply);
    document.getElementById('burned').textContent=fmt(d.raw.totalBurned,4);
    document.getElementById('price').textContent=(d.computed.price).toFixed(6);
    document.getElementById('reserve-a').textContent=fmt(d.raw.reserveA);
    document.getElementById('reserve-b').textContent=fmt(d.raw.reserveB);
    document.getElementById('tvl').textContent=fmt(d.raw.dexTvl);
    document.getElementById('slippage').textContent=d.computed.slippagePct.toFixed(2)+'%';
    document.getElementById('fees').textContent=fmt(d.raw.feesB,4);
    document.getElementById('staked').textContent=fmt(d.raw.stakedTvl);
    document.getElementById('staking-tvl').textContent=fmt(d.raw.stakingTvl);
    document.getElementById('apy-au').textContent=(d.computed.auApy*100).toFixed(2)+'%';
    document.getElementById('apy-ag').textContent=(d.computed.agApy*100).toFixed(2)+'%';
    document.getElementById('apy-combined').textContent=(d.computed.combinedApy*100).toFixed(2)+'%';
    document.getElementById('pid-error').textContent=d.raw.pidError;
    document.getElementById('pid-target').textContent=fmt(d.raw.pidTarget);
    document.getElementById('pid-daily').textContent=fmt(d.raw.pidDailyEmitted);
    document.getElementById('pid-rate').textContent=(d.computed.pidEmissionRate*100).toFixed(1)+'%';
    document.getElementById('pid-canemit').textContent=d.raw.canEmit?'✅':'❌';
    document.getElementById('pid-canemit').className='value '+(d.raw.canEmit?'green':'red');
    document.getElementById('treasury-balance').textContent=fmt(d.raw.treasuryBalance);
    document.getElementById('buybacks').textContent=d.raw.treasuryBuybacks;
    document.getElementById('au-bought').textContent=fmt(d.raw.treasuryAuBought,4);
    document.getElementById('ag-spent').textContent=fmt(d.raw.treasuryAgSpent,4);
    document.getElementById('runway').textContent=d.computed.treasuryRunwayMonths.toFixed(1);
    document.getElementById('amo-canexecute').textContent=d.raw.canExecute?'✅':'❌';
    document.getElementById('amo-canexecute').className='value '+(d.raw.canExecute?'green':'red');
    document.getElementById('bot-status').textContent=d.bot.running?'🟢 Running':(d.bot.totalTrades>0?'⏹️ Done':'⚪ Idle');
    document.getElementById('bot-status').className='value '+(d.bot.running?'green':(d.bot.totalTrades>0?'white':'yellow'));
    document.getElementById('bot-trades').textContent=d.bot.totalTrades;
    document.getElementById('bot-success').textContent=d.bot.successfulTrades;
    document.getElementById('bot-failed').textContent=d.bot.failedTrades;
    document.getElementById('bot-unique').textContent=d.bot.uniqueTraders;
    document.getElementById('bot-volume').textContent=fmt(d.bot.totalVolume);
    document.getElementById('health').textContent=d.computed.health+'/100';
    document.getElementById('health').className='value '+(d.computed.health>80?'green':d.computed.health>50?'yellow':'red');
    document.getElementById('dex-ratio').textContent=d.computed.dexRatio.toFixed(4);
    document.getElementById('lp-supply').textContent=fmt(d.raw.lpSupply);
    document.getElementById('proposals').textContent=d.raw.proposalCount;
    // Alerts
    const alDiv=document.getElementById('alerts');
    if(d.anomalies&&d.anomalies.length>0){
      alDiv.innerHTML=d.anomalies.map(a=>'<div class="alert '+a.severity+'">'+a.msg+'</div>').join('');
    }else{
      alDiv.innerHTML='<div class="metric"><span class="label">No alerts</span></div>';
    }
    // Chart data
    priceData.push({x:d.round,y:d.computed.price});
    tvlData.push({x:d.round,y:Number(d.raw.dexTvl)/1e18});
    reserveAData.push({x:d.round,y:Number(d.raw.reserveA)/1e18});
    reserveBData.push({x:d.round,y:Number(d.raw.reserveB)/1e18});
    pidData.push({x:d.round,y:Number(d.raw.pidError)/1e18});
    supplyData.push({x:d.round,y:Number(d.raw.auSupply)/1e18});
    burnData.push({x:d.round,y:Number(d.raw.totalBurned)/1e18});
    healthData.push({x:d.round,y:d.computed.health});
    treasuryData.push({x:d.round,y:Number(d.raw.treasuryBalance)/1e18});
    if(d.bot.totalTrades>lastBotTrades){botData.push({x:d.round,y:d.bot.totalTrades});lastBotTrades=d.bot.totalTrades}
    if(priceData.length>200)priceData.shift();if(tvlData.length>200)tvlData.shift();
    if(reserveAData.length>200)reserveAData.shift();if(reserveBData.length>200)reserveBData.shift();
    if(pidData.length>200)pidData.shift();if(supplyData.length>200)supplyData.shift();
    if(burnData.length>200)burnData.shift();if(healthData.length>200)healthData.shift();
    if(treasuryData.length>200)treasuryData.shift();if(botData.length>200)botData.shift();
    // Draw charts
    drawChart('price-chart',priceData,'#58a6ff','Price (Au/Ag)',v=>v.toFixed(4));
    drawChart('tvl-chart',tvlData,'#3fb950','TVL',v=>v.toFixed(0));
    drawChart('reserves-chart',reserveAData,'#58a6ff','Reserve A (Ag)');
    drawChart('pid-chart',pidData,'#d29922','PID Error',v=>v.toFixed(0));
    drawChart('supply-chart',supplyData,'#58a6ff','Au Supply');
    drawChart('health-chart',healthData,'#3fb950','Health Score',v=>v.toFixed(0));
    drawChart('treasury-chart',treasuryData,'#d29922','Treasury Balance');
    // Bot chart as bar-like
    const bc=document.getElementById('bot-chart');const bctx=bc.getContext('2d');
    const bdpr=window.devicePixelRatio||1;const br=bc.getBoundingClientRect();
    bc.width=br.width*bdpr;bc.height=br.height*bdpr;bctx.scale(bdpr,bdpr);
    const bw=br.width,bh=br.height;bctx.clearRect(0,0,bw,bh);
    if(botData.length>2){
      const bMax=Math.max(...botData.map(d=>d.y))*1.1||1;
      bctx.strokeStyle='#21262d';bctx.lineWidth=1;
      for(let i=0;i<4;i++){const y=bh*0.1+(bh*0.8/3)*i;bctx.beginPath();bctx.moveTo(0,y);bctx.lineTo(bw,y);bctx.stroke()}
      bctx.strokeStyle='#58a6ff';bctx.lineWidth=2;bctx.beginPath();
      botData.forEach((d,i)=>{const x=(i/(botData.length-1))*bw;const y=bh*0.9-(d.y/bMax)*bh*0.8;if(i===0)bctx.moveTo(x,y);else bctx.lineTo(x,y)});
      bctx.stroke();
      bctx.globalAlpha=0.08;bctx.fillStyle='#58a6ff';bctx.lineTo(bw,bh);bctx.lineTo(0,bh);bctx.closePath();bctx.fill();bctx.globalAlpha=1;
      bctx.fillStyle='#8b949e';bctx.font='10px monospace';bctx.fillText('Total Trades',8,14);
    }
    document.getElementById('dot').style.background='#3fb950';
  }catch(e){document.getElementById('status').textContent='Error: '+e.message;document.getElementById('dot').style.background='#f85149'}
}
function updateUptime(){const el=Math.floor((Date.now()-${serverStartTime})/1000);const h=Math.floor(el/3600),m=Math.floor((el%3600)/60),s=el%60;document.getElementById('uptime').textContent=h+'h '+m+'m '+s+'s'}
fetchMetrics();setInterval(fetchMetrics,${args.interval});setInterval(updateUptime,1000);
</script>
</body>
</html>`;
}

// ── Start ─────────────────────────────────────────────────────────
async function start() {
  await init();

  // Start BotEngine if requested
  if (args.runBots) await startBots();

  // Start collection
  console.log(`📊 Starting collection every ${args.interval}ms`);
  setInterval(async () => { await collect(); }, args.interval);
  await collect(); // immediate first collection

  // Start server
  server.listen(args.port, '0.0.0.0', () => {
    console.log(`\n🚀 Analytics Dashboard: http://localhost:${args.port}`);
    console.log(`   API: http://localhost:${args.port}/api/metrics`);
    if (args.runBots) console.log(`   BotEngine: running in background`);
    console.log(`\n   Press Ctrl+C to stop\n`);
  });
}

start().catch(e => { console.error('Failed:', e); process.exit(1); });
