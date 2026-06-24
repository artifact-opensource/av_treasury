#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Monitoring Dashboard — Real-time sandbox metrics
 * 
 * Polls the ganache network and displays:
 * - Live price feeds
 * - Bot activity rates
 * - Trade volume
 * - Reserve levels
 * - System health
 * ═══════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const POLL_INTERVAL = 3000; // 3 seconds

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

class Dashboard {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    this.history = [];
    this.startHeight = 0;
  }

  async start() {
    console.clear();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📊 SANDBOX MONITORING DASHBOARD');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  RPC: ${RPC_URL}`);
    console.log(`  Polling: ${POLL_INTERVAL}ms`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Load deployed addresses
    const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
    if (!fs.existsSync(configPath)) {
      console.log('❌ No deployed.json found. Run deploy-sandbox.js first.');
      process.exit(1);
    }
    this.addresses = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    this.startHeight = await this.provider.getBlockNumber();

    // Start polling
    setInterval(() => this.tick(), POLL_INTERVAL);
    await this.tick();
  }

  async tick() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const [priceA, reserves, totalLiq, botMetrics] = await Promise.all([
        this.getPrice(),
        this.getReserves(),
        this.getLiquidity(),
        this.readBotMetrics(),
      ]);

      const data = {
        block: blockNumber,
        timestamp: new Date().toISOString(),
        priceA: priceA ? ethers.utils.formatEther(priceA) : 'N/A',
        reserveA: reserves ? ethers.utils.formatEther(reserves[0]) : 'N/A',
        reserveB: reserves ? ethers.utils.formatEther(reserves[1]) : 'N/A',
        totalLiquidity: totalLiq ? ethers.utils.formatEther(totalLiq) : 'N/A',
        ...botMetrics,
      };

      this.history.push(data);
      if (this.history.length > 100) this.history.shift();

      this.render(data);
    } catch (err) {
      // Silent on transient errors
    }
  }

  async getPrice() {
    if (!this.addresses.dex) return null;
    try {
      const slot2 = await this.provider.getStorageAt(this.addresses.dex, 2);
      const bn = ethers.BigNumber.from(slot2);
      const reserveA = bn.and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
      const reserveB = bn.shr(112).and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
      if (reserveA.eq(0)) return null;
      return reserveB.mul(1e18).div(reserveA);
    } catch (e) { return null; }
  }

  async getReserves() {
    if (!this.addresses.dex) return null;
    try {
      const slot2 = await this.provider.getStorageAt(this.addresses.dex, 2);
      const bn = ethers.BigNumber.from(slot2);
      const reserveA = bn.and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
      const reserveB = bn.shr(112).and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
      return [reserveA, reserveB];
    } catch (e) { return null; }
  }

  async getLiquidity() {
    if (!this.addresses.dex) return null;
    try {
      const slot5 = await this.provider.getStorageAt(this.addresses.dex, 5);
      return ethers.BigNumber.from(slot5);
    } catch (e) { return null; }
  }

  async readBotMetrics() {
    const metricsPath = path.join(__dirname, '..', 'logs', 'bot-metrics.json');
    if (!fs.existsSync(metricsPath)) {
      return { totalTrades: 0, activeBots: 0, volume: '0' };
    }
    try {
      const data = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      return {
        totalTrades: data.metrics?.totalTrades || 0,
        activeBots: data.botSummaries?.filter(b => b.alive).length || 0,
        volume: data.metrics?.totalVolume ? ethers.utils.formatEther(ethers.BigNumber.from(data.metrics.totalVolume)) : '0',
      };
    } catch (e) {
      return { totalTrades: 0, activeBots: 0, volume: '0' };
    }
  }

  render(data) {
    // Move cursor up to overwrite
    const lines = 20;
    process.stdout.write(`\x1B[${lines}A\x1B[0J`);

    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log(`│  📊 LIVE MONITOR — Block ${String(data.block).padEnd(8)} ${new Date().toLocaleTimeString().padEnd(25)}│`);
    console.log('├──────────────────────────────────────────────────────────────────┤');
    console.log(`│  💰 Price (agUSD/AVAX):  ${data.priceA.padEnd(12)}                    │`);
    console.log(`│  🏦 Reserve agUSD:       ${data.reserveA.padEnd(12)}                    │`);
    console.log(`│  🏦 Reserve AVAX:        ${data.reserveB.padEnd(12)}                    │`);
    console.log(`│  📈 Total Liquidity:     ${data.totalLiquidity.padEnd(12)}                    │`);
    console.log('├──────────────────────────────────────────────────────────────────┤');
    console.log(`│  🤖 Active Bots:         ${String(data.activeBots).padEnd(12)}                    │`);
    console.log(`│  📊 Total Trades:        ${String(data.totalTrades).padEnd(12)}                    │`);
    console.log(`│  💎 Total Volume:        ${data.volume.substring(0, 12).padEnd(12)}                    │`);
    console.log('└──────────────────────────────────────────────────────────────────┘');

    // Price sparkline (last 50 data points)
    if (this.history.length > 2) {
      const prices = this.history.slice(-50).map(h => parseFloat(h.priceA) || 0).filter(p => p > 0);
      if (prices.length > 1) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const sparkline = prices.map(p => {
          const level = Math.round(((p - min) / range) * 7);
          return '▁▂▃▄▅▆▇█'[level];
        }).join('');
        console.log(`  Price trend: ${sparkline}`);
      }
    }
  }
}

new Dashboard().start().catch(console.error);
