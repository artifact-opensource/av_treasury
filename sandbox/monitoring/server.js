#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Analytics HTTP Server — AV Treasury Sandbox Dashboard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Serves real-time analytics from the sandbox contracts on a web dashboard.
 *
 * Usage:
 *   node sandbox/monitoring/server.js [--port 7000] [--interval 5000]
 *
 * Endpoints:
 *   GET /api/status        — System status (contracts, block, round)
 *   GET /api/metrics       — Latest metrics snapshot (JSON)
 *   GET /api/history       — Full metrics history (JSON array)
 *   GET /api/contracts     — Contract addresses
 *   GET /                  — HTML dashboard (auto-refreshing)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// ── Parse args ────────────────────────────────────────────────────
const args = {
  port: 7000,
  interval: 5000,
  rpcUrl: 'http://127.0.0.1:8545',
  configPath: path.join(__dirname, '..', 'config', 'deployed.json'),
};

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) { args.port = parseInt(process.argv[i + 1]); i++; }
  if (process.argv[i] === '--interval' && process.argv[i + 1]) { args.interval = parseInt(process.argv[i + 1]); i++; }
  if (process.argv[i] === '--rpc' && process.argv[i + 1]) { args.rpcUrl = process.argv[i + 1]; i++; }
}

// ── Contract ABIs (minimal) ───────────────────────────────────────
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

const LP_TOKEN_ABI=[  'function totalSupply() view returns (uint256)',
];

const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function getTvl() view returns (uint256)',
  'function rewardRateAu() view returns (uint256)',
  'function rewardRateAg() view returns (uint256)',
];

const PID_ABI = [
  'function getCurrentError() view returns (int256)',
  'function targetTvl() view returns (int256)',
  'function remainingDailyEmission() view returns (uint256)',
  'function canEmit() view returns (bool)',
];

const TREASURY_AMO_ABI = [
  'function totalBuybacksExecuted() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
  'function totalAgSpent() view returns (uint256)',
  'function maxBuybackAmount() view returns (uint256)',
  'function canExecute() view returns (bool)',
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
let running = false;
let collectionTimer = null;
let round = 0;
let serverStartTime = Date.now();

// ── Initialize ────────────────────────────────────────────────────

async function init() {
  try {
    config = JSON.parse(fs.readFileSync(args.configPath, 'utf8'));
  } catch (e) {
    console.error('⚠️  deployed.json not found. Run deploy-sandbox.js first.');
    console.error(`   Expected at: ${args.configPath}`);
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
  console.log(`   AuToken:  ${c.AuToken}`);
  console.log(`   AgToken:  ${c.AgToken}`);
  console.log(`   DEX:      ${c.DexSimulator}`);
  console.log(`   Staking:  ${c.Staking}`);
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
      stakedTvl, stakingTvl, rewardRateAu, rewardRateAg,
      pidError, pidTarget, pidRemainingDaily, canEmit,
      treasuryBuybacks, treasuryAuBought, treasuryAgSpent, treasuryMaxBuyback, canExecute,
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
      contracts.pid.getCurrentError().catch(() => 0),
      contracts.pid.targetTvl().catch(() => 0),
      contracts.pid.remainingDailyEmission().catch(() => 0),
      contracts.pid.canEmit().catch(() => false),
      contracts.treasuryAMO.totalBuybacksExecuted().catch(() => 0),
      contracts.treasuryAMO.totalAuBought().catch(() => 0),
      contracts.treasuryAMO.totalAgSpent().catch(() => 0),
      contracts.treasuryAMO.maxBuybackAmount().catch(() => 0),
      contracts.treasuryAMO.canExecute().catch(() => false),
      contracts.governor.proposalCount().catch(() => 0),
    ]);

    // Compute derived metrics
    const price = reserveA.gt(0) ? reserveB.mul(ethers.constants.WeiPerEther).div(reserveA) : ethers.constants.Zero;
    const lpPrice = lpSupply.gt(0) ? dexTvl.mul(ethers.constants.WeiPerEther).div(lpSupply) : ethers.constants.Zero;
    const stakingApy = stakedTvl.gt(0)
      ? rewardRateAu.mul(365 * 24 * 3600).mul(ethers.constants.WeiPerEther).div(stakedTvl)
      : ethers.constants.Zero;

    const dataPoint = {
      timestamp,
      round,
      blockNumber,
      tokens: {
        auSupply: auSupply.toString(),
        agSupply: agSupply.toString(),
        totalBurned: totalBurned.toString(),
      },
      dex: {
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
        lpSupply: lpSupply.toString(),
        tvl: dexTvl.toString(),
        feesA: feesA.toString(),
        feesB: feesB.toString(),
        price: price.toString(),
        lpPrice: lpPrice.toString(),
      },
      staking: {
        totalStaked: stakedTvl.toString(),
        tvl: stakingTvl.toString(),
        rewardRateAu: rewardRateAu.toString(),
        rewardRateAg: rewardRateAg.toString(),
        apy: stakingApy.toString(),
      },
      pid: {
        error: pidError.toString(),
        targetTvl: pidTarget.toString(),
        remainingDaily: pidRemainingDaily.toString(),
        canEmit,
      },
      treasury: {
        buybacks: treasuryBuybacks.toString(),
        auBought: treasuryAuBought.toString(),
        agSpent: treasuryAgSpent.toString(),
        maxBuyback: treasuryMaxBuyback.toString(),
        canExecute,
      },
      governance: {
        proposals: proposalCount.toString(),
      },
    };

    latestData = dataPoint;
    history.push(dataPoint);

    // Keep last 500 data points
    if (history.length > 500) history = history.slice(-500);

  } catch (e) {
    console.error(`[Collect] Error: ${e.message}`);
  }
}

// ── HTML Dashboard ────────────────────────────────────────────────

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AV Treasury — Sandbox Analytics</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0a0e17; color: #e1e8ed; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #1a1f35 0%, #0d1117 100%); border-bottom: 1px solid #21262d; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; color: #58a6ff; }
  .header .status { font-size: 12px; color: #8b949e; }
  .header .status .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3fb950; margin-right: 6px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 20px 24px; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; }
  .card h3 { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .metric { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .metric .label { font-size: 12px; color: #8b949e; }
  .metric .value { font-size: 16px; color: #58a6ff; font-weight: 600; }
  .metric .value.green { color: #3fb950; }
  .metric .value.yellow { color: #d29922; }
  .metric .value.red { color: #f85149; }
  .metric .value.white { color: #e1e8ed; }
  .wide { grid-column: 1 / -1; }
  .chart-container { position: relative; height: 200px; margin-top: 8px }
  canvas { width: 100% !important; height: 100% !important; }
  .footer { text-align: center; padding: 16px; color: #484f58; font-size: 11px; }
</style>
</head>
<body>
<div class="header">
  <h1>🏛️ AV Treasury — Sandbox Analytics</h1>
  <div class="status"><span class="dot"></span><span id="status-text">Connecting...</span></div>
</div>

<div class="grid">
  <div class="card">
    <h3>💎 Token Overview</h3>
    <div class="metric"><span class="label">Au Supply</span><span class="value" id="au-supply">—</span></div>
    <div class="metric"><span class="label">Ag Supply</span><span class="value" id="ag-supply">—</span></div>
    <div class="metric"><span class="label">Total Burned</span><span class="value yellow" id="burned">—</span></div>
  </div>

  <div class="card">
    <h3>📊 DEX</h3>
    <div class="metric"><span class="label">Price (Au/Ag)</span><span class="value" id="price">—</span></div>
    <div class="metric"><span class="label">Reserve A (Ag)</span><span class="value" id="reserve-a">—</span></div>
    <div class="metric"><span class="label">Reserve B (Au)</span><span class="value" id="reserve-b">—</span></div>
    <div class="metric"><span class="label">TVL</span><span class="value green" id="tvl">—</span></div>
    <div class="metric"><span class="label">LP Supply</span><span class="value" id="lp-supply">—</span></div>
    <div class="metric"><span class="label">Fees Collected</span><span class="value yellow" id="fees">—</span></div>
  </div>

  <div class="card">
    <h3>🔒 Staking</h3>
    <div class="metric"><span class="label">Total Staked</span><span class="value" id="staked">—</span></div>
    <div class="metric"><span class="label">TVL</span><span class="value" id="staking-tvl">—</span></div>
    <div class="metric"><span class="label">Reward Rate (Au/blk)</span><span class="value" id="reward-au">—</span></div>
    <div class="metric"><span class="label">Reward Rate (Ag/blk)</span><span class="value" id="reward-ag">—</span></div>
    <div class="metric"><span class="label">Est. APY</span><span class="value green" id="apy">—</span></div>
  </div>

  <div class="card">
    <h3>🎛️ PID Controller</h3>
    <div class="metric"><span class="label">Current Error</span><span class="value" id="pid-error">—</span></div>
    <div class="metric"><span class="label">Target TVL</span><span class="value" id="pid-target">—</span></div>
    <div class="metric"><span class="label">Remaining Daily</span><span class="value" id="pid-remaining">—</span></div>
    <div class="metric"><span class="label">Can Emit</span><span class="value" id="pid-canemit">—</span></div>
  </div>

  <div class="card">
    <h3>🏦 Treasury AMO</h3>
    <div class="metric"><span class="label">Buybacks Executed</span><span class="value" id="buybacks">—</span></div>
    <div class="metric"><span class="label">Au Bought</span><span class="value" id="au-bought">—</span></div>
    <div class="metric"><span class="label">Ag Spent</span><span class="value" id="ag-spent">—</span></div>
    <div class="metric"><span class="label">Max Buyback</span><span class="value" id="max-buyback">—</span></div>
    <div class="metric"><span class="label">Can Execute</span><span class="value" id="amo-canexecute">—</span></div>
  </div>

  <div class="card">
    <h3>🏛️ Governance</h3>
    <div class="metric"><span class="label">Proposals</span><span class="value" id="proposals">—</span></div>
  </div>

  <div class="card wide">
    <h3>📈 Price History</h3>
    <div class="chart-container"><canvas id="price-chart"></canvas></div>
  </div>

  <div class="card wide">
    <h3>📊 TVL History</h3>
    <div class="chart-container"><canvas id="tvl-chart"></canvas></div>
  </div>
</div>

<div class="footer">
  AV Treasury Sandbox Monitor &bull; Block <span id="block">—</span> &bull; Round <span id="round">—</span> &bull; Uptime <span id="uptime">—</span>
</div>

<script>
function formatEth(val) {
  if (!val || val === '0') return '0';
  const n = Number(val) / 1e18;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(4);
}

function formatPrice(val) {
  if (!val || val === '0') return '0';
  const n = Number(val) / 1e18;
  return n.toFixed(6);
}

let priceData = [];
let tvlData = [];

async function fetchMetrics() {
  try {
    const res = await fetch('/api/metrics');
    const d = await res.json();
    if (!d) return;

    document.getElementById('status-text').textContent = 'Live — Block ' + d.blockNumber;
    document.getElementById('block').textContent = d.blockNumber;
    document.getElementById('round').textContent = d.round;

    document.getElementById('au-supply').textContent = formatEth(d.tokens.auSupply);
    document.getElementById('ag-supply').textContent = formatEth(d.tokens.agSupply);
    document.getElementById('burned').textContent = formatEth(d.tokens.totalBurned);

    document.getElementById('price').textContent = formatPrice(d.dex.price);
    document.getElementById('reserve-a').textContent = formatEth(d.dex.reserveA);
    document.getElementById('reserve-b').textContent = formatEth(d.dex.reserveB);
    document.getElementById('tvl').textContent = formatEth(d.dex.tvl);
    document.getElementById('lp-supply').textContent = formatEth(d.dex.lpSupply);
    document.getElementById('fees').textContent = formatEth(d.dex.feesA);

    document.getElementById('staked').textContent = formatEth(d.staking.totalStaked);
    document.getElementById('staking-tvl').textContent = formatEth(d.staking.tvl);
    document.getElementById('reward-au').textContent = formatEth(d.staking.rewardRateAu);
    document.getElementById('reward-ag').textContent = formatEth(d.staking.rewardRateAg);
    const apy = Number(d.staking.apy) / 1e18;
    document.getElementById('apy').textContent = apy.toFixed(2) + '%';

    document.getElementById('pid-error').textContent = d.pid.error;
    document.getElementById('pid-target').textContent = formatEth(d.pid.targetTvl);
    document.getElementById('pid-remaining').textContent = formatEth(d.pid.remainingDaily);
    document.getElementById('pid-canemit').textContent = d.pid.canEmit ? '✅ Yes' : '❌ No';
    document.getElementById('pid-canemit').className = 'value ' + (d.pid.canEmit ? 'green' : 'red');

    document.getElementById('buybacks').textContent = d.treasury.buybacks;
    document.getElementById('au-bought').textContent = formatEth(d.treasury.auBought);
    document.getElementById('ag-spent').textContent = formatEth(d.treasury.agSpent);
    document.getElementById('max-buyback').textContent = formatEth(d.treasury.maxBuyback);
    document.getElementById('amo-canexecute').textContent = d.treasury.canExecute ? '✅ Yes' : '❌ No';
    document.getElementById('amo-canexecute').className = 'value ' + (d.treasury.canExecute ? 'green' : 'red');

    document.getElementById('proposals').textContent = d.governance.proposals;

    // Update charts
    priceData.push({ x: d.round, y: Number(d.dex.price) / 1e18 });
    tvlData.push({ x: d.round, y: Number(d.dex.tvl) / 1e18 });
    if (priceData.length > 100) priceData.shift();
    if (tvlData.length > 100) tvlData.shift();

    drawChart('price-chart', priceData, '#58a6ff', 'Price (Au/Ag)');
    drawChart('tvl-chart', tvlData, '#3fb950', 'TVL');

  } catch(e) {
    document.getElementById('status-text').textContent = 'Error: ' + e.message;
  }
}

function drawChart(canvasId, data, color, label) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  if (data.length < 2) return;

  const minY = Math.min(...data.map(d => d.y)) * 0.95;
  const maxY = Math.max(...data.map(d => d.y)) * 1.05;
  const rangeY = maxY - minY || 1;

  // Grid
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = h * 0.1 + (h * 0.8 / 3) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h * 0.9 - ((d.y - minY) / rangeY) * h * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  const lastX = w;
  const lastY = h * 0.9 - ((data[data.length-1].y - minY) / rangeY) * h * 0.8;
  ctx.lineTo(lastX, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Label
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px monospace';
  ctx.fillText(label, 8, 14);
  ctx.fillText(maxY.toFixed(4), 8, h * 0.1 + 4);
  ctx.fillText(minY.toFixed(4), 8, h * 0.95);
}

// Update uptime
function updateUptime() {
  const elapsed = Math.floor((Date.now() - ${serverStartTime}) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  document.getElementById('uptime').textContent = \`\${h}h \${m}m \${s}s\`;
}

fetchMetrics();
setInterval(fetchMetrics, ${args.interval});
setInterval(updateUptime, 1000);
</script>
</body>
</html>`;
}

// ── HTTP Server ───────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${args.port}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    switch (url.pathname) {
      case '/api/status': {
        const block = await provider.getBlockNumber().catch(() => 0);
        res.end(JSON.stringify({
          status: 'ok',
          blockNumber: block,
          round,
          uptime: Date.now() - serverStartTime,
          interval: args.interval,
          historyLength: history.length,
          rpcUrl: args.rpcUrl,
        }));
        break;
      }

      case '/api/metrics': {
        if (!latestData) {
          res.writeHead(503);
          res.end(JSON.stringify({ error: 'No data collected yet' }));
          break;
        }
        res.end(JSON.stringify(latestData));
        break;
      }

      case '/api/history': {
        res.end(JSON.stringify(history));
        break;
      }

      case '/api/contracts': {
        res.end(JSON.stringify(config.contracts, null, 2));
        break;
      }

      case '/': {
        res.setHeader('Content-Type', 'text/html');
        res.end(getDashboardHTML());
        break;
      }

      default: {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    }
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

// ── Start ─────────────────────────────────────────────────────────

async function start() {
  await init();

  // Start collection
  running = true;
  console.log(`📊 Starting collection every ${args.interval}ms`);
  collectionTimer = setInterval(async () => {
    await collect();
  }, args.interval);

  // Collect first data point immediately
  await collect();

  // Start server
  server.listen(args.port, '0.0.0.0', () => {
    console.log(`\n🚀 Analytics Dashboard running at:`);
    console.log(`   http://localhost:${args.port}`);
    console.log(`   http://127.0.0.1:${args.port}`);
    console.log(`\n   API endpoints:`);
    console.log(`   GET /api/status    — System status`);
    console.log(`   GET /api/metrics   — Latest metrics`);
    console.log(`   GET /api/history   — Full history`);
    console.log(`   GET /api/contracts  — Contract addresses`);
    console.log(`\n   Press Ctrl+C to stop\n`);
  });
}

start().catch(e => {
  console.error('Failed to start:', e);
  process.exit(1);
});
