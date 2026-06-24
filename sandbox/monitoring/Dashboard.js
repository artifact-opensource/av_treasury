#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Dashboard — Dual-Token Monitoring (Au + Ag)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Real-time monitoring for the dual-token sandbox:
 * - Au/Ag price (DEX)
 * - Au supply (with burn tracking)
 * - Ag supply (with mint tracking)
 * - DEX reserves
 * - Bot activity heatmap
 * - Trade volume breakdown
 *
 * Usage: node sandbox/monitoring/Dashboard.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const DEX_ABI = [
  'function getPrice(address tokenA, address tokenB) view returns (uint256)',
  'function getReserves() view returns (uint256, uint256)',
];

const AU_FEE_BPS = 9;

class Dashboard {
  constructor() {
    this.provider = null;
    this.auToken = null;
    this.agToken = null;
    this.dex = null;
    this.config = null;
    this.history = [];
    this.maxHistory = 60; // Keep 60 data points
    this.running = false;
    this.startTime = Date.now();
    this.lastTradeCount = 0;
  }

  async init() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);

    const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('deployed.json not found. Run deploy-sandbox.js first.');
    }

    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    this.auToken = new ethers.Contract(this.config.auToken, ERC20_ABI, this.provider);
    this.agToken = new ethers.Contract(this.config.agToken, ERC20_ABI, this.provider);
    this.dex = new ethers.Contract(this.config.dex, DEX_ABI, this.provider);
  }

  async start(intervalMs = 3000) {
    this.running = true;
    this.startTime = Date.now();

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📊 DUAL-TOKEN DASHBOARD — Au + Ag');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Au:       ${this.config.auToken}`);
    console.log(`  Ag:       ${this.config.agToken}`);
    console.log(`  DEX:      ${this.config.dex}`);
    console.log(`  Interval: ${intervalMs}ms`);
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  Press Ctrl+C to stop\n');

    while (this.running) {
      await this.render();
      await this.sleep(intervalMs);
    }
  }

  async render() {
    try {
      const [price, reserves, auSupply, agSupply, block] = await Promise.all([
        this.dex.getPrice(this.config.auToken, this.config.agToken),
        this.dex.getReserves(),
        this.auToken.totalSupply(),
        this.agToken.totalSupply(),
        this.provider.getBlockNumber(),
      ]);

      const dataPoint = {
        timestamp: Date.now(),
        price,
        reserveA: reserves[0],
        reserveB: reserves[1],
        auSupply,
        agSupply,
        block,
      };

      this.history.push(dataPoint);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      // Move cursor to top of dashboard area
      process.stdout.write('\x1B[15A\x1B[J');

      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
      const priceStr = ethers.formatEther(price);

      // Calculate price change
      let priceChange = 'N/A';
      if (this.history.length > 1) {
        const prev = this.history[this.history.length - 2].price;
        if (prev > 0n) {
          const change = ((price - prev) * 10000n) / prev;
          const sign = change >= 0 ? '+' : '';
          priceChange = `${sign}${Number(change) / 100}%`;
        }
      }

      // Calculate supplies change from initial
      const initialAu = 1_000_000n * 10n ** 18n; // 1M initial
      const auBurn = initialAu - auSupply;

      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`  📊 DUAL-TOKEN DASHBOARD — Au + Ag          ⏱ ${elapsed}s`);
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`  Block:     ${block}`);
      console.log('');
      console.log('  ── Prices ──────────────────────────────────────────────');
      console.log(`  Au/Ag:     ${priceStr} Ag per Au`);
      console.log(`  Change:    ${priceChange}`);
      console.log('');
      console.log('  ── Supplies ────────────────────────────────────────────');
      console.log(`  Au:        ${ethers.formatEther(auSupply)} (burned: ${ethers.formatEther(auBurn)})`);
      console.log(`  Ag:        ${ethers.formatEther(agSupply)}`);
      console.log('');
      console.log('  ── DEX Reserves ────────────────────────────────────────');
      console.log(`  Au Res:    ${ethers.formatEther(reserves[0])}`);
      console.log(`  Ag Res:    ${ethers.formatEther(reserves[1])}`);
      console.log(`  K:         ${ethers.formatEther(reserves[0] * reserves[1] / 10n ** 18n)}`);

      // Mini price chart (last 40 data points)
      console.log('');
      console.log('  ── Price History ───────────────────────────────────────');
      this.renderChart();

      console.log('');
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  Au Fee: 9bps (4.5bps burn, 4.5bps treasury)');

    } catch (err) {
      // Silently skip render errors (node might be syncing)
    }
  }

  renderChart() {
    if (this.history.length < 2) {
      console.log('  (collecting data...)');
      return;
    }

    const prices = this.history.slice(-40).map((d) => Number(d.price) / 1e18);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const height = 6;
    const width = Math.min(prices.length, 50);

    const chart = [];
    for (let row = 0; row < height; row++) {
      const threshold = max - (row / (height - 1)) * range;
      let line = '  ';
      for (let col = 0; col < width; col++) {
        const idx = Math.floor((col / (width - 1)) * (prices.length - 1));
        const val = prices[idx];
        if (val >= threshold) {
          line += '█';
        } else {
          line += ' ';
        }
      }
      const label = row === 0 ? max.toFixed(4) : row === height - 1 ? min.toFixed(4) : '';
      chart.push(`${label.padStart(10)} │${line}`);
    }

    chart.forEach((line) => console.log(line));
    console.log(`  ${' '.repeat(10)} └${'─'.repeat(width)}`);
    console.log(`  ${' '.repeat(10)}  ${this.history.length - width > 0 ? this.history.length - width : 0}${' '.repeat(Math.max(0, width - 2))}now`);
  }

  stop() {
    this.running = false;
    process.stdout.write('\x1B[?25h'); // Show cursor
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── CLI ──────────────────────────────────────────────────────────
if (require.main === module) {
  const dashboard = new Dashboard();
  dashboard
    .init()
    .then(() => dashboard.start())
    .catch((err) => {
      console.error('❌ Dashboard failed:', err.message);
      process.exit(1);
    });

  process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping dashboard...');
    dashboard.stop();
    setTimeout(() => process.exit(0), 500);
  });
}

module.exports = Dashboard;
