#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * BotEngine — Simulates 100 realistic traders on ganache testnet
 * 
 * Each bot has its own EOA, personality profile, and trading strategy.
 * Behaviors include: market making, momentum trading, whale manipulation,
 * arbitrage simulation, and one-sided LP provisioning.
 * ═══════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────
const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  totalBots: parseInt(process.env.BOT_COUNT) || 100,
  baseBalanceEth: 1000,
  
  // Contract addresses (populated after deployment)
  addresses: {
    agUSD: null,
    AVAX: null,
    USDC: null,
    dex: null,
    treasuryAMO: null,
  },

  // Trading parameters
  swapIntervalMs: { min: 2000, max: 8000 },
  tradeSizePercent: { min: 0.01, max: 0.15 },  // 1-15% of balance per trade
  oneSidedRatio: 0.35,   // 35% of trades are one-sided LP
  swapRatio: 0.50,       // 50% are swaps
  addLiquidityRatio: 0.15, // 15% are two-sided LP adds

  // Stress test parameters
  stressMode: process.env.STRESS_MODE || 'normal', // normal | high | extreme
  whaleDropAmount: ethers.utils.parseEther('500'),  // 500 ETH whale trades
  flashCrashThreshold: 0.30,  // 30% price drop triggers panic
};

// ─── Bot Personalities ───────────────────────────────────────
const PERSONALITIES = [
  { name: 'conservative', swapFreq: 0.3, sizeMult: 0.3, holdBias: 0.8 },
  { name: 'moderate',     swapFreq: 0.6, sizeMult: 0.6, holdBias: 0.5 },
  { name: 'aggressive',   swapFreq: 1.0, sizeMult: 1.0, holdBias: 0.2 },
  { name: 'whale',        swapFreq: 0.1, sizeMult: 3.0, holdBias: 0.9 },
  { name: 'momentum',     swapFreq: 0.9, sizeMult: 0.8, holdBias: 0.3 },
  { name: 'arbitrageur',  swapFreq: 0.4, sizeMult: 0.5, holdBias: 0.7 },
];

// ─── ABIs ────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function mint(address to, uint256 amount) external',
];

const DEX_ABI = [
  'function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256)',
  'function addOneSidedLiquidity(uint256 amountA, uint256 amountB) external returns (uint256)',
  'function removeLiquidity(uint256 liquidityOut) external',
  'function swapAforB(uint256 amountAIn) external returns (uint256)',
  'function swapBforA(uint256 amountBIn) external returns (uint256)',
  'function totalLiquidity() external view returns (uint256)',
  'event Swap(address indexed swapper, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
  'event PriceUpdate(uint256 priceA, uint256 priceB)',
];

const TREASURY_AMO_ABI = [
  'function executeBuyback(uint256 amount) external',
  'function getTreasuryBalance() external view returns (uint256)',
  'function getBuybackCap() external view returns (uint256)',
  'function getLastBuybackTime() external view returns (uint256)',
  'function COOLDOWN_PERIOD() external view returns (uint256)',
];

// ─── Bot Class ───────────────────────────────────────────────
class Bot {
  constructor(id, wallet, personality) {
    this.id = id;
    this.wallet = wallet;
    this.personality = personality;
    this.tradeCount = 0;
    this.volumeGenerated = ethers.BigNumber.from(0);
    this.lastTradeTime = 0;
    this.alive = true;
    this.holdings = { agUSD: 0, AVAX: 0 };
  }

  async executeTrade() {
    if (!this.alive) return null;

    const dex = new ethers.Contract(CONFIG.addresses.dex, DEX_ABI, this.wallet);
    const tokenA = new ethers.Contract(CONFIG.addresses.agUSD, ERC20_ABI, this.wallet);
    const tokenB = new ethers.Contract(CONFIG.addresses.AVAX, ERC20_ABI, this.wallet);

    const rand = Math.random();
    let tradeType;
    if (rand < CONFIG.oneSidedRatio) {
      tradeType = 'oneSidedLP';
    } else if (rand < CONFIG.oneSidedRatio + CONFIG.swapRatio) {
      tradeType = 'swap';
    } else {
      tradeType = 'twoSidedLP';
    }

    try {
      const balanceA = await tokenA.balanceOf(this.wallet.address);
      const balanceB = await tokenB.balanceOf(this.wallet.address);

      if (balanceA.lt(ethers.utils.parseEther('1')) && balanceB.lt(ethers.utils.parseEther('1'))) {
        this.alive = false;
        return null;
      }

      const sizePercent = CONFIG.tradeSizePercent.min + 
        Math.random() * (CONFIG.tradeSizePercent.max - CONFIG.tradeSizePercent.min);
      const sizeMult = this.personality.sizeMult;

      if (this.id === 0 && this.tradeCount < 3) {
        console.log(`  DEBUG Bot 0: balA=${ethers.utils.formatEther(balanceA).substring(0,10)}, pct=${sizePercent.toFixed(3)}, mult=${sizeMult}, type=${tradeType}`);
      }

      let tx;
      let tradeAmount;

      switch (tradeType) {
        case 'swap': {
          const direction = Math.random() > 0.5;
          if (direction) {
            tradeAmount = balanceA.mul(Math.ceil(sizePercent * sizeMult * 100)).div(100);
            if (tradeAmount.gt(0)) {
              try {
                const approveTx = await tokenA.approve(dex.address, tradeAmount);
                await approveTx.wait();
                tx = await dex.swapAforB(tradeAmount);
              } catch (e) {
                return { bot: this.id, type: tradeType, error: 'approve/swap A: ' + e.message };
              }
            }
          } else {
            tradeAmount = balanceB.mul(Math.ceil(sizePercent * sizeMult * 100)).div(100);
            if (tradeAmount.gt(0)) {
              try {
                const approveTx = await tokenB.approve(dex.address, tradeAmount);
                await approveTx.wait();
              } catch (e) {
                return { bot: this.id, type: tradeType, error: 'approve B: ' + e.message };
              }
              tx = await dex.swapBforA(tradeAmount);
            }
          }
          break;
        }

        case 'oneSidedLP': {
          const useTokenA = Math.random() > 0.5;
          if (useTokenA) {
            tradeAmount = balanceA.mul(Math.ceil(sizePercent * sizeMult * 100)).div(100);
            if (tradeAmount.gt(0)) {
              try {
                const approveTx = await tokenA.approve(dex.address, tradeAmount);
                await approveTx.wait();
              } catch (e) {
                return { bot: this.id, type: tradeType, error: 'approve A: ' + e.message };
              }
              tx = await dex.addOneSidedLiquidity(tradeAmount, 0);
            }
          } else {
            tradeAmount = balanceB.mul(Math.ceil(sizePercent * sizeMult * 100)).div(100);
            if (tradeAmount.gt(0)) {
              try {
                const approveTx = await tokenB.approve(dex.address, tradeAmount);
                await approveTx.wait();
              } catch (e) {
                return { bot: this.id, type: tradeType, error: 'approve B: ' + e.message };
              }
              tx = await dex.addOneSidedLiquidity(0, tradeAmount);
            }
          }
          break;
        }

        case 'twoSidedLP': {
          const amountA = balanceA.mul(Math.ceil(sizePercent * sizeMult * 50)).div(100);
          const amountB = balanceB.mul(Math.ceil(sizePercent * sizeMult * 50)).div(100);
          if (amountA.gt(0) && amountB.gt(0)) {
            try {
              await tokenA.approve(dex.address, amountA);
              await tokenB.approve(dex.address, amountB);
            } catch (e) {
              return { bot: this.id, type: tradeType, error: 'approve: ' + e.message };
            }
            tx = await dex.addLiquidity(amountA, amountB);
          }
          break;
        }
      }

      if (tx) {
        const receipt = await tx.wait();
        this.tradeCount++;
        this.volumeGenerated = this.volumeGenerated.add(tradeAmount || 0);
        this.lastTradeTime = Date.now();
        return { bot: this.id, type: tradeType, amount: tradeAmount, hash: receipt.transactionHash };
      }
    } catch (err) {
      // Bot failed trade — could be slippage, low balance, etc.
      return { bot: this.id, type: tradeType, error: err.message };
    }
    return null;
  }
}

// ─── Main Engine ─────────────────────────────────────────────
class BotEngine {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
    this.bots = [];
    this.metrics = {
      totalTrades: 0,
      totalVolume: ethers.BigNumber.from(0),
      uniqueTraders: new Set(),
      failedTrades: 0,
      avgTradeSize: 0,
      priceHistory: [],
      tradeTypeCounts: { swap: 0, oneSidedLP: 0, twoSidedLP: 0 },
    };
    this.running = false;
  }

  async initialize() {
    console.log('🔧 Initializing BotEngine...');
    console.log(`   RPC: ${CONFIG.rpcUrl}`);
    console.log(`   Bots: ${CONFIG.totalBots}`);
    console.log(`   Stress mode: ${CONFIG.stressMode}`);

    // Load contract addresses
    const addrFile = path.join(__dirname, '..', 'config', 'deployed.json');
    if (fs.existsSync(addrFile)) {
      CONFIG.addresses = JSON.parse(fs.readFileSync(addrFile, 'utf8'));
      console.log('   ✅ Loaded deployed contracts:', Object.keys(CONFIG.addresses).filter(k => CONFIG.addresses[k]));
    } else {
      console.log('   ⚠️  No deployed.json found — run deploy-sandbox.js first');
    }

    // Create 100 bot wallets from mnemonic
    const mnemonic = 'test test test test test test test test test test test junk';
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);

    for (let i = 0; i < CONFIG.totalBots; i++) {
      const path = `m/44'/60'/0'/0/${i}`;
      const wallet = ethers.Wallet.fromMnemonic(mnemonic, path).connect(this.provider);
      const personality = PERSONALITIES[i % PERSONALITIES.length];
      this.bots.push(new Bot(i, wallet, personality));
    }

    console.log(`   ✅ ${this.bots.length} bots initialized`);
    console.log(`   Personalities: ${PERSONALITIES.map(p => p.name).join(', ')}`);
  }

  async fundBots(tokenA, tokenB) {
    console.log('💰 Funding bots with test tokens...');
    const mnemonic = 'test test test test test test test test test test test junk';
    const ownerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0").connect(this.provider);

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      
      // Mint agUSD to each bot
      await tokenA.connect(ownerWallet).mint(bot.wallet.address, ethers.utils.parseEther('100000'));
      
      // Mint AVAX to each bot
      await tokenB.connect(ownerWallet).mint(bot.wallet.address, ethers.utils.parseEther('50000'));

      if (i % 20 === 0) {
        console.log(`   Funded bots ${i}-${Math.min(i + 19, this.bots.length - 1)}...`);
      }
    }
    console.log(`   ✅ All ${this.bots.length} bots funded with 100k agUSD + 50k AVAX`);
  }

  async startTrading() {
    this.running = true;
    console.log('🚀 Starting bot trading simulation...');

    // Set stress mode parameters
    let interval = CONFIG.swapIntervalMs;
    if (CONFIG.stressMode === 'high') {
      interval = { min: 500, max: 2000 };
    } else if (CONFIG.stressMode === 'extreme') {
      interval = { min: 100, max: 500 };
    }

    let round = 0;
    while (this.running) {
      round++;
      const activeBots = this.bots.filter(b => b.alive);
      
      if (activeBots.length === 0) {
        console.log('💀 All bots drained. Stopping.');
        break;
      }

      // Random subset of bots trade each round
      const tradingNow = activeBots.filter(() => Math.random() < 0.6);
      
      const promises = tradingNow.map(async (bot) => {
        const result = await bot.executeTrade();
        if (result) {
          this.metrics.totalTrades++;
          this.metrics.uniqueTraders.add(bot.id);
          if (result.type) this.metrics.tradeTypeCounts[result.type]++;
          if (result.amount) this.metrics.totalVolume = this.metrics.totalVolume.add(result.amount);
          if (result.error) {
            this.metrics.failedTrades++;
            if (this.metrics.failedTrades <= 5) {
              console.log(`  ⚠️ Bot ${result.bot} ${result.type}: ${result.error.substring(0, 80)}`);
            }
          }
        }
        return result;
      });

      await Promise.allSettled(promises);

      // Record price snapshot from storage (slot 2 has packed reserves)
      try {
        const slot2 = await this.provider.getStorageAt(CONFIG.addresses.dex, 2);
        const reserveA = ethers.BigNumber.from(slot2).and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
        const reserveB = ethers.BigNumber.from(slot2).shr(112).and(ethers.BigNumber.from('0x' + 'f'.repeat(28)));
        const priceA = reserveA.gt(0) ? reserveB.mul(1e18).div(reserveA) : 0;
        this.metrics.priceHistory.push({
          round,
          timestamp: Date.now(),
          priceA: ethers.utils.formatEther(priceA),
          reserveA: ethers.utils.formatEther(reserveA),
          reserveB: ethers.utils.formatEther(reserveB),
          activeBots: activeBots.length,
        });
      } catch (e) {
        // Ignore oracle errors
      }

      // Log every 10 rounds
      if (round % 10 === 0) {
        this.logMetrics(round);
      }

      // Random delay between rounds
      const delay = interval.min + Math.random() * (interval.max - interval.min);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logMetrics(round) {
    const avgSize = this.metrics.totalTrades > 0
      ? ethers.utils.formatEther(this.metrics.totalVolume.div(this.metrics.totalTrades))
      : '0';
    
    const latestPrice = this.metrics.priceHistory.length > 0
      ? this.metrics.priceHistory[this.metrics.priceHistory.length - 1]
      : null;

    console.log('');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log(`│ 📊 METRICS — Round ${String(round).padEnd(34)}│`);
    console.log('├─────────────────────────────────────────────────────┤');
    console.log(`│  Total Trades:      ${String(this.metrics.totalTrades).padEnd(29)}│`);
    console.log(`│  Unique Traders:    ${String(this.metrics.uniqueTraders.size).padEnd(29)}│`);
    console.log(`│  Total Volume:      ${ethers.utils.formatEther(this.metrics.totalVolume).padEnd(29)}│`);
    console.log(`│  Avg Trade Size:    ${avgSize.padEnd(29)}│`);
    console.log(`│  Failed Trades:     ${String(this.metrics.failedTrades).padEnd(29)}│`);
    console.log(`│  Trade Types:       S:${this.metrics.tradeTypeCounts.swap} LP1:${this.metrics.tradeTypeCounts.oneSidedLP} LP2:${this.metrics.tradeTypeCounts.twoSidedLP}${' '.repeat(12)}│`);
    if (latestPrice) {
      console.log(`│  Price (agUSD/AVAX): ${latestPrice.priceA.padEnd(28)}│`);
      console.log(`│  Active Bots:       ${String(latestPrice.activeBots).padEnd(29)}│`);
    }
    console.log('└─────────────────────────────────────────────────────┘');
  }

  async saveMetrics() {
    const outputPath = path.join(__dirname, '..', 'logs', 'bot-metrics.json');
    const data = {
      config: {
        totalBots: CONFIG.totalBots,
        stressMode: CONFIG.stressMode,
        timestamp: new Date().toISOString(),
      },
      metrics: {
        totalTrades: this.metrics.totalTrades,
        uniqueTraders: this.metrics.uniqueTraders.size,
        totalVolume: this.metrics.totalVolume.toString(),
        failedTrades: this.metrics.failedTrades,
        tradeTypeCounts: this.metrics.tradeTypeCounts,
      },
      priceHistory: this.metrics.priceHistory,
      botSummaries: this.bots.map(b => ({
        id: b.id,
        personality: b.personality.name,
        tradeCount: b.tradeCount,
        volume: b.volumeGenerated.toString(),
        alive: b.alive,
      })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`📁 Metrics saved to ${outputPath}`);
  }

  stop() {
    this.running = false;
  }
}

// ─── CLI ─────────────────────────────────────────────────────
async function main() {
  const engine = new BotEngine();
  await engine.initialize();

  // Check if contracts are deployed
  if (!CONFIG.addresses.dex || !CONFIG.addresses.agUSD || !CONFIG.addresses.AVAX) {
    console.log('❌ Contracts not deployed. Run: node sandbox/scripts/deploy-sandbox.js');
    process.exit(1);
  }

  // Get contracts
  const mnemonic = 'test test test test test test test test test test test junk';
  const ownerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0").connect(engine.provider);
  const tokenA = new ethers.Contract(CONFIG.addresses.agUSD, ERC20_ABI, ownerWallet);
  const tokenB = new ethers.Contract(CONFIG.addresses.AVAX, ERC20_ABI, ownerWallet);

  // Fund bots
  await engine.fundBots(tokenA, tokenB);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot engine...');
    engine.stop();
    await engine.saveMetrics();
    process.exit(0);
  });

  // Start trading
  await engine.startTrading();
}

main().catch(err => {
  console.error('💥 BotEngine error:', err);
  process.exit(1);
});

module.exports = { BotEngine, Bot, CONFIG };
