/**
 * ═══════════════════════════════════════════════════════════════════
 * Bot Engine — Dual-Trading Bots (Au + Ag)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 100 autonomous trading agents with 6 personality types trading
 * the Au/Ag pair on the DexSimulator AMM.
 *
 * Personality types:
 * - whale:    Large trades, low frequency (tests price impact)
 * - dayTrader: Medium trades, trend-following (tests momentum)
 * - dolphin:  Small arbitrage, DEX-to-DEX (tests efficiency)
 * - lp:       Provides one-sided liquidity (tests LP revenue)
 * - dumper:   Sells Ag aggressively (tests sell pressure)
 * - accumulator: Buys Ag consistently (tests buy pressure)
 *
 * Each bot signs its own transactions — no relayer needed.
 *
 * Usage: node sandbox/bots/BotEngine.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const MNEMONIC = 'test test test test test test test test test test test junk';
const BOT_COUNT = 100;
const ROUNDS = 20;
const ROUND_INTERVAL_MS = 2000;

// ── Contract ABIs ────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function transfer(address, uint256) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
];

const DEX_ABI = [
  'function swapAforB(uint256 amountAIn) returns (uint256 amountBOut)',
  'function swapBforA(uint256 amountBIn) returns (uint256 amountAOut)',
  'function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB)',
  'function removeLiquidity(address tokenA, address tokenB, uint256 amount)',
  'function getPrice(address tokenA, address tokenB) view returns (uint256)',
  'function getReserves() view returns (uint256, uint256)',
  'function addOneSidedLiquidity(address token, uint256 amount)',
];

// ── Personality Definitions ──────────────────────────────────────
const PERSONALITIES = {
  whale: {
    tradeSizePercent: 0.3,     // 30% of balance per trade
    intervalMs: 30000,          // Every 30s
    swapDirection: 0.5,         // 50/50 buy/sell
    oneSidedLP: false,
    gasLimit: 500000,
  },
  dayTrader: {
    tradeSizePercent: 0.15,
    intervalMs: 5000,
    swapDirection: 0.7,         // 70% buy Ag (momentum)
    oneSidedLP: false,
    gasLimit: 300000,
  },
  dolphin: {
    tradeSizePercent: 0.05,
    intervalMs: 15000,
    swapDirection: 0.5,
    oneSidedLP: false,
    gasLimit: 200000,
  },
  lp: {
    tradeSizePercent: 0.1,
    intervalMs: 20000,
    swapDirection: 0.0,         // No swaps, only LP
    oneSidedLP: true,
    gasLimit: 400000,
  },
  dumper: {
    tradeSizePercent: 0.2,
    intervalMs: 3000,
    swapDirection: 1.0,         // 100% sell Ag
    oneSidedLP: false,
    gasLimit: 200000,
  },
  accumulator: {
    tradeSizePercent: 0.12,
    intervalMs: 10000,
    swapDirection: 0.0,         // 100% buy Ag
    oneSidedLP: false,
    gasLimit: 200000,
  },
};

// Assign personality based on bot index
function getPersonality(index) {
  const types = ['whale', 'dayTrader', 'dolphin', 'lp', 'dumper', 'accumulator'];
  // Distribution: 5 whales, 20 dayTraders, 15 dolphins, 20 LPs, 20 dumpers, 20 accumulators
  if (index <= 5) return types[0];
  if (index <= 25) return types[1];
  if (index <= 40) return types[2];
  if (index <= 60) return types[3];
  if (index <= 80) return types[4];
  return types[5];
}

// ── Main Engine ──────────────────────────────────────────────────
class BotEngine {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.bots = [];
    this.round = 0;
    this.running = false;
    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalVolume: 0n,
      tradesByType: {},
      uniqueTraders: new Set(),
    };
  }

  async init() {
    const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('deployed.json not found. Run deploy-sandbox.js first.');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    this.config = config;

    this.auToken = new ethers.Contract(config.auToken, ERC20_ABI, this.provider);
    this.agToken = new ethers.Contract(config.agToken, ERC20_ABI, this.provider);
    this.dex = new ethers.Contract(config.dex, DEX_ABI, this.provider);

    // Initialize bots
    for (let i = 1; i <= BOT_COUNT; i++) {
      const wallet = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(MNEMONIC),
        `m/44'/60'/0'/0/${i}`
      ).connect(this.provider);

      const personality = getPersonality(i);
      this.bots.push({
        index: i,
        wallet,
        personality,
        config: PERSONALITIES[personality],
        lastTrade: 0,
        tradeCount: 0,
      });
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🤖 BOT ENGINE — Dual-Token Trading (Au + Ag)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Bots:     ${BOT_COUNT}`);
    console.log(`  Rounds:   ${ROUNDS}`);
    console.log(`  Au:       ${config.auToken}`);
    console.log(`  Ag:       ${config.agToken}`);
    console.log(`  DEX:      ${config.dex}`);
    console.log('───────────────────────────────────────────────────────────────');
  }

  async start() {
    this.running = true;
    const startTime = Date.now();

    console.log('\n🚀 Starting bot engine...\n');

    // Print header
    console.log('  Round │ Au Price  │ Volume       │ Trades │ Failed │ Unique');
    console.log('  ──────┼───────────┼──────────────┼────────┼────────┼───────');

    for (let round = 1; round <= ROUNDS && this.running; round++) {
      this.round = round;
      await this.runRound();

      // Print round summary
      const price = await this.getPrice();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const vol = ethers.formatEther(this.stats.totalVolume);

      console.log(
        `  ${String(round).padStart(5)} │ ` +
        `${ethers.formatEther(price).padStart(9)} │ ` +
        `${vol.padStart(12)} │ ` +
        `${String(this.stats.totalTrades).padStart(6)} │ ` +
        `${String(this.stats.failedTrades).padStart(6)} │ ` +
        `${String(this.stats.uniqueTraders.size).padStart(5)}`
      );

      // Wait between rounds
      if (round < ROUNDS) {
        await this.sleep(ROUND_INTERVAL_MS);
      }
    }

    this.printFinalStats();
  }

  async runRound() {
    const promises = this.bots.map((bot) => this.trade(bot));
    await Promise.allSettled(promises);
  }

  async trade(bot) {
    const now = Date.now();
    if (now - bot.lastTrade < bot.config.intervalMs) return;

    bot.lastTrade = now;

    try {
      const { auToken, agToken, dex } = this;

      // Get balances
      const auBal = await auToken.balanceOf(bot.wallet.address);
      const agBal = await agToken.balanceOf(bot.wallet.address);

      if (auBal === 0n && agBal === 0n) return;

      // Determine trade type
      if (bot.config.oneSidedLP && auBal > 0n) {
        // LP: provide one-sided liquidity with Au
        await this.provideOneSidedLiquidity(bot, auToken, agToken, auBal);
        return;
      }

      // Determine swap direction
      let sellAu; // true = sell Au for Ag, false = sell Ag for Au
      if (bot.config.swapDirection === 1.0) {
        sellAu = false; // Always sell Ag
      } else if (bot.config.swapDirection === 0.0) {
        sellAu = true; // Always sell Au
      } else {
        // Random based on personality probability
        sellAu = Math.random() > bot.config.swapDirection;
      }

      const tokenIn = sellAu ? auToken : agToken;
      const tokenOut = sellAu ? agToken : auToken;
      const balIn = sellAu ? auBal : agBal;

      if (balIn === 0n) return;

      const tradeAmount = (balIn * BigInt(Math.floor(bot.config.tradeSizePercent * 1000))) / 1000n;

      if (tradeAmount === 0n) return;

      // Check and set allowance
      const allowance = await tokenIn.allowance(bot.wallet.address, this.config.dex);
      if (allowance < tradeAmount) {
        const maxApproval = ethers.MaxUint256;
        const approveTx = await tokenIn.connect(bot.wallet).approve(this.config.dex, maxApproval);
        await approveTx.wait();
      }

      // Execute swap
      let tx;
      if (sellAu) {
        tx = await dex.connect(bot.wallet).swapBforA(tradeAmount, { gasLimit: bot.config.gasLimit });
      } else {
        tx = await dex.connect(bot.wallet).swapAforB(tradeAmount, { gasLimit: bot.config.gasLimit });
      }

      const receipt = await tx.wait();

      // Update stats
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.totalVolume += tradeAmount;
      this.stats.uniqueTraders.add(bot.wallet.address);
      bot.tradeCount++;

      const type = bot.personality;
      this.stats.tradesByType[type] = (this.stats.tradesByType[type] || 0) + 1;

    } catch (err) {
      this.stats.totalTrades++;
      this.stats.failedTrades++;
      // Fail silently — bots don't retry within the same round
    }
  }

  async provideOneSidedLiquidity(bot, auToken, agToken, auBal) {
    try {
      const amount = (auBal * 10n) / 100n; // 10% of Au balance
      if (amount === 0n) return;

      const allowance = await auToken.allowance(bot.wallet.address, this.config.dex);
      if (allowance < amount) {
        await auToken.connect(bot.wallet).approve(this.config.dex, ethers.MaxUint256);
      }

      const tx = await this.dex.connect(bot.wallet).addOneSidedLiquidity(
        this.config.auToken,
        amount,
        { gasLimit: bot.config.gasLimit }
      );
      await tx.wait();

      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.totalVolume += amount;
      this.stats.uniqueTraders.add(bot.wallet.address);
      bot.tradeCount++;

      const type = `${bot.personality}_lp`;
      this.stats.tradesByType[type] = (this.stats.tradesByType[type] || 0) + 1;
    } catch {
      this.stats.totalTrades++;
      this.stats.failedTrades++;
    }
  }

  async getPrice() {
    try {
      return await this.dex.getPrice(this.config.auToken, this.config.agToken);
    } catch {
      return 0n;
    }
  }

  printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊 FINAL STATISTICS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Trades:      ${this.stats.totalTrades}`);
    console.log(`  Successful:        ${this.stats.successfulTrades}`);
    console.log(`  Failed:            ${this.stats.failedTrades}`);
    console.log(`  Unique Traders:    ${this.stats.uniqueTraders.size}`);
    console.log(`  Total Volume:      ${ethers.formatEther(this.stats.totalVolume)}`);
    console.log(`  Avg Trades/Bot:    ${(this.stats.totalTrades / BOT_COUNT).toFixed(1)}`);
    console.log(`  Runtime:           ${elapsed.toFixed(1)}s`);

    console.log('\n  Trades by Type:');
    for (const [type, count] of Object.entries(this.stats.tradesByType)) {
      console.log(`    ${type.padEnd(20)} ${count}`);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  stop() {
    this.running = false;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── CLI ──────────────────────────────────────────────────────────
if (require.main === module) {
  const engine = new BotEngine();
  engine.init()
    .then(() => engine.start())
    .catch((err) => {
      console.error('❌ Bot engine failed:', err.message);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping bot engine...');
    engine.stop();
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = BotEngine;
