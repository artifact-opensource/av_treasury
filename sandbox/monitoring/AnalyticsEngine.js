#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * AnalyticsEngine — Core Data Collection & Metrics Computation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Central engine that collects data from the AV Treasury sandbox,
 * computes all metrics, maintains history, and emits events for
 * downstream consumers (Dashboard, AlertSystem, Reporter).
 *
 * Usage:
 *   const engine = new AnalyticsEngine({ intervalMs: 5000 });
 *   engine.on('data', (data) => { ... });
 *   engine.start();
 *
 * Dependencies: ethers v5, chalk
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { EventEmitter } = require('events');

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
  'function priceCumulativeA() view returns (uint256)',
  'function priceCumulativeB() view returns (uint256)',
];

const LP_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function getTvl() view returns (uint256)',
  'function rewardRateAu() view returns (uint256)',
  'function rewardRateAg() view returns (uint256)',
  'function stakedBalance(address) view returns (uint256)',
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
  'function kp() view returns (int256)',
  'function ki() view returns (int256)',
  'function kd() view returns (int256)',
];

const TREASURY_AMO_ABI = [
  'function agToken() view returns (address)',
  'function totalBuybacksExecuted() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
  'function totalAgSpent() view returns (uint256)',
  'function maxBuybackAmount() view returns (uint256)',
  'function canExecute() view returns (bool)',
  'function runway() view returns (uint256)',
];

// ── Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  rpcUrl: 'http://127.0.0.1:8545',
  configPath: path.join(__dirname, '..', 'config', 'deployed.json'),
  intervalMs: 5000,
  maxHistory: 1000,
  chainId: 1337,
};

// ── AnalyticsEngine Class ──────────────────────────────────────────

class AnalyticsEngine extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.rpcUrl - Anvil RPC endpoint
   * @param {string} options.configPath - Path to deployed.json
   * @param {number} options.intervalMs - Data collection interval
   * @param {number} options.maxHistory - Max data points to retain
   */
  constructor(options = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.provider = null;
    this.contracts = {};
    this.history = [];
    this.running = false;
    this.collectionTimer = null;
    this.round = 0;
    this.lastData = null;

    // Bot tracking (lightweight — reads from events)
    this.botStats = {
      activeCount: 0,
      tradeVolumeByType: {
        swapAforB: 0n,
        swapBforA: 0n,
        addLiquidity: 0n,
        removeLiquidity: 0n,
        stake: 0n,
        unstake: 0n,
        buyback: 0n,
      },
      personalityDistribution: {
        whale: 0, dayTrader: 0, dolphin: 0, lp: 0,
        dumper: 0, accumulator: 0, staker: 0,
      },
      recentTrades: [],
    };

    // DEX volume tracking
    this.dexStats = {
      totalVolumeA: 0n,
      totalVolumeB: 0n,
      totalFeesA: 0n,
      totalFeesB: 0n,
      lastReserveA: 0n,
      lastReserveB: 0n,
    };
  }

  /**
   * Initialize: connect to RPC, load config, create contract instances
   */
  async init() {
    // Connect to provider
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    // Verify connection
    try {
      await this.provider.getBlockNumber();
    } catch (err) {
      throw new Error(`Cannot connect to Anvil at ${this.config.rpcUrl}: ${err.message}`);
    }

    // Load deployment config
    if (!fs.existsSync(this.config.configPath)) {
      throw new Error(`deployed.json not found at ${this.config.configPath}. Run deploy-sandbox.js first.`);
    }
    this.deployConfig = JSON.parse(fs.readFileSync(this.config.configPath, 'utf8'));

    // Create contract instances
    const c = this.deployConfig.contracts;
    this.contracts.auToken = new ethers.Contract(c.AuToken, ERC20_ABI, this.provider);
    this.contracts.agToken = new ethers.Contract(c.AgToken, ERC20_ABI, this.provider);
    this.contracts.dex = new ethers.Contract(c.DexSimulator, DEX_ABI, this.provider);
    this.contracts.lpToken = new ethers.Contract(c.LpToken, LP_TOKEN_ABI, this.provider);
    this.contracts.staking = new ethers.Contract(c.Staking, STAKING_ABI, this.provider);
    this.contracts.pid = new ethers.Contract(c.PIDController, PID_ABI, this.provider);
    this.contracts.treasuryAMO = new ethers.Contract(c.TreasuryAMO, TREASURY_AMO_ABI, this.provider);

    // Initialize bot personality distribution from BotEngine logic
    this._initBotDistribution();

    this.emit('ready', { contracts: c, config: this.deployConfig });
    return this;
  }

  /**
   * Initialize bot personality distribution (mirrors BotEngine getPersonality)
   */
  _initBotDistribution() {
    // Same distribution as BotEngine: 5 whales, 15 dayTraders, 10 dolphins, 20 LPs, 15 dumpers, 15 accumulators, 20 stakers
    this.botStats.personalityDistribution = {
      whale: 5,
      dayTrader: 15,
      dolphin: 10,
      lp: 20,
      dumper: 15,
      accumulator: 15,
      staker: 20,
    };
    this.botStats.activeCount = 100;
  }

  /**
   * Start the data collection loop
   * @param {number} intervalMs - Override collection interval
   */
  async start(intervalMs = null) {
    if (intervalMs) this.config.intervalMs = intervalMs;
    if (!this.provider) await this.init();

    this.running = true;
    console.log(chalk.green(`[AnalyticsEngine] Starting collection every ${this.config.intervalMs}ms`));

    // Collect immediately, then on interval
    await this.collect();

    this.collectionTimer = setInterval(async () => {
      await this.collect();
    }, this.config.intervalMs);
  }

  /**
   * Stop the collection loop
   */
  stop() {
    this.running = false;
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    this.emit('stopped');
    console.log(chalk.yellow('[AnalyticsEngine] Stopped'));
  }

  /**
   * Collect a single data point from all contracts
   * @returns {Object} Complete metrics snapshot
   */
  async collect() {
    this.round++;
    const timestamp = Date.now();

    try {
      // ── Batch all read calls ──
      const [
        auSupply,
        agSupply,
        totalBurned,
        reserveA,
        reserveB,
        lpSupplyStaking,
        dexTvl,
        feesA,
        feesB,
        stakedTvl,
        stakingTvl,
        rewardRateAu,
        rewardRateAg,
        accRewardAu,
        accRewardAg,
        pidError,
        pidTarget,
        pidRemainingDaily,
        pidMaxDaily,
        pidDailyEmitted,
        treasuryBuybacks,
        treasuryAuBought,
        treasuryAgSpent,
        treasuryMaxBuyback,
        treasuryRunway,
        blockNumber,
        agPrice,
      ] = await Promise.all([
        // Token metrics
        this.contracts.auToken.totalSupply(),
        this.contracts.agToken.totalSupply(),
        this.contracts.auToken.totalBurned().catch(() => 0n),
        // DEX metrics
        this.contracts.dex.getReserveA(),
        this.contracts.dex.getReserveB(),
        this.contracts.lpToken.totalSupply(),
        this.contracts.dex.getTvl().catch(() => 0n),
        this.contracts.dex.accumulatedFeesA().catch(() => 0n),
        this.contracts.dex.accumulatedFeesB().catch(() => 0n),
        // Staking metrics
        this.contracts.staking.totalStaked(),
        this.contracts.staking.getTvl().catch(() => 0n),
        this.contracts.staking.rewardRateAu().catch(() => 0n),
        this.contracts.staking.rewardRateAg().catch(() => 0n),
        this.contracts.staking.accRewardPerTokenAu().catch(() => 0n),
        this.contracts.staking.accRewardPerTokenAg().catch(() => 0n),
        // PID metrics
        this.contracts.pid.getCurrentError().catch(() => 0n),
        this.contracts.pid.targetTvl().catch(() => 0n),
        this.contracts.pid.remainingDailyEmission().catch(() => 0n),
        this.contracts.pid.maxDailyEmission().catch(() => 0n),
        this.contracts.pid.dailyEmitted().catch(() => 0n),
        // Treasury metrics
        this.contracts.treasuryAMO.totalBuybacksExecuted().catch(() => 0n),
        this.contracts.treasuryAMO.totalAuBought().catch(() => 0n),
        this.contracts.treasuryAMO.totalAgSpent().catch(() => 0n),
        this.contracts.treasuryAMO.maxBuybackAmount().catch(() => 0n),
        this.contracts.treasuryAMO.runway().catch(() => 0n),
        // Block
        this.provider.getBlockNumber(),
        // Price (reserveB/reserveA = Au price in Ag terms)
        this.contracts.dex.getReserveA().catch(() => 0n),
      ]);

      // ── Compute derived metrics ──

      // Price: Au in Ag terms (reserveB / reserveA)
      const auPriceInAg = reserveA > 0n ? (reserveB * 10n ** 18n) / reserveA : 0n;

      // DEX K constant (product of reserves / 1e18)
      const dexK = (reserveA * reserveB) / 10n ** 18n;

      // DEX ratio (reserveA / reserveB)
      const dexRatio = reserveB > 0n ? Number(reserveA * 10000n / reserveB) / 10000 : 0;

      // Staking APY estimation (annualized)
      // Au APY = rewardRateAu * blocksPerYear * priceAu / (stakedTvl * 1e18)
      const BLOCKS_PER_YEAR = 2_628_000; // ~365 days * 7200 blocks/day
      const auApy = stakingTvl > 0n && auPriceInAg > 0n
        ? Number(rewardRateAu * BigInt(BLOCKS_PER_YEAR) * auPriceInAg) / (Number(stakingTvl) * 1e18)
        : 0;
      const agApy = stakingTvl > 0n
        ? Number(rewardRateAg * BigInt(BLOCKS_PER_YEAR)) / (Number(stakingTvl) * 1e18)
        : 0;

      // PID emission rate (percentage of daily cap used)
      const pidEmissionRate = pidMaxDaily > 0n
        ? Number(pidDailyEmitted) / Number(pidMaxDaily)
        : 0;

      // PID error as percentage of target
      const pidErrorPct = pidTarget !== 0n
        ? Number(pidError) / Number(pidTarget)
        : 0;

      // Treasury runway (months) — balance / (avg monthly spend)
      const treasuryBalance = await this.contracts.agToken.balanceOf(this.deployConfig.contracts.TreasuryAMO).catch(() => 0n);
      const treasuryRunwayMonths = treasuryAgSpent > 0n
        ? Number(treasuryBalance) / (Number(treasuryAgSpent) / 12)
        : 999; // No spend = infinite runway

      // DEX volume delta from last collection
      const volumeDeltaA = reserveA > this.dexStats.lastReserveA ? reserveA - this.dexStats.lastReserveA : 0n;
      const volumeDeltaB = reserveB > this.dexStats.lastReserveB ? reserveB - this.dexStats.lastReserveB : 0n;
      this.dexStats.totalVolumeA += volumeDeltaA;
      this.dexStats.totalVolumeB += volumeDeltaB;
      this.dexStats.totalFeesA = feesA;
      this.dexStats.totalFeesB = feesB;
      this.dexStats.lastReserveA = reserveA;
      this.dexStats.lastReserveB = reserveB;

      // Slippage estimation (based on reserve ratio deviation from 50/50)
      const totalReserve = reserveA + reserveB;
      const slippage = totalReserve > 0n
        ? Math.abs(Number(reserveA) - Number(reserveB)) / Number(totalReserve) * 100
        : 0;

      // ── System Health Score (0-100) ──
      const healthScore = this._computeHealthScore({
        auPriceInAg,
        stakingTvl,
        pidErrorPct,
        treasuryRunwayMonths,
        slippage,
        reserveA,
        reserveB,
      });

      // ── Anomaly flags ──
      const anomalies = this._detectAnomalies({
        auPriceInAg,
        pidErrorPct,
        slippage,
        treasuryRunwayMonths,
        stakingTvl,
      });

      // ── Build data point ──
      const dataPoint = {
        timestamp,
        round: this.round,
        blockNumber,
        token: {
          auSupply: auSupply.toString(),
          agSupply: agSupply.toString(),
          totalBurned: totalBurned.toString(),
          auPriceInAg: auPriceInAg.toString(),
          auPriceInAgFormatted: ethers.formatEther(auPriceInAg),
        },
        dex: {
          reserveA: reserveA.toString(),
          reserveB: reserveB.toString(),
          lpSupply: lpSupplyStaking.toString(),
          tvl: dexTvl.toString(),
          k: dexK.toString(),
          ratio: dexRatio,
          feesA: feesA.toString(),
          feesB: feesB.toString(),
          volumeA: this.dexStats.totalVolumeA.toString(),
          volumeB: this.dexStats.totalVolumeB.toString(),
          slippagePercent: slippage,
        },
        staking: {
          tvl: stakingTvl.toString(),
          totalStaked: stakedTvl.toString(),
          rewardRateAu: rewardRateAu.toString(),
          rewardRateAg: rewardRateAg.toString(),
          accRewardPerTokenAu: accRewardAu.toString(),
          accRewardPerTokenAg: accRewardAg.toString(),
          apyAu: auApy,
          apyAg: agApy,
          combinedApy: auApy + agApy,
        },
        pid: {
          currentError: pidError.toString(),
          targetTvl: pidTarget.toString(),
          remainingDaily: pidRemainingDaily.toString(),
          maxDaily: pidMaxDaily.toString(),
          dailyEmitted: pidDailyEmitted.toString(),
          emissionRate: pidEmissionRate,
          errorPercent: pidErrorPct,
        },
        treasury: {
          balance: treasuryBalance.toString(),
          runwayMonths: treasuryRunwayMonths,
          buybackCapacity: treasuryMaxBuyback.toString(),
          totalExecuted: treasuryBuybacks.toString(),
          totalAuBought: treasuryAuBought.toString(),
          totalAgSpent: treasuryAgSpent.toString(),
        },
        bot: {
          activeCount: this.botStats.activeCount,
          personalityDistribution: { ...this.botStats.personalityDistribution },
          tradeVolumeByType: Object.fromEntries(
            Object.entries(this.botStats.tradeVolumeByType).map(([k, v]) => [k, v.toString()])
          ),
          recentTrades: this.botStats.recentTrades.slice(-10),
        },
        system: {
          healthScore,
          anomalies,
          uptime: timestamp - (this.history[0]?.timestamp || timestamp),
        },
      };

      // Store in history
      this.history.push(dataPoint);
      if (this.history.length > this.config.maxHistory) {
        this.history.shift();
      }

      this.lastData = dataPoint;

      // Emit events
      this.emit('data', dataPoint);
      this.emit('collect', { round: this.round, timestamp });

      // Emit specific metric events for AlertSystem
      if (anomalies.length > 0) {
        this.emit('anomaly', { anomalies, data: dataPoint });
      }

      return dataPoint;
    } catch (err) {
      this.emit('error', { message: err.message, round: this.round });
      return null;
    }
  }

  /**
   * Compute composite health score (0-100)
   */
  _computeHealthScore(metrics) {
    let score = 100;

    // Price stability (25 points)
    if (metrics.auPriceInAg > 0n) {
      const priceChange = this.lastData
        ? Math.abs(Number(metrics.auPriceInAg) - Number(this.lastData.token.auPriceInAg)) / Number(metrics.auPriceInAg)
        : 0;
      score -= Math.min(25, priceChange * 250); // >10% change = -25
    } else {
      score -= 25;
    }

    // TVL health (25 points)
    if (metrics.stakingTvl > 0n) {
      // Check if TVL is growing or shrinking
      if (this.lastData) {
        const tvlChange = (Number(metrics.stakingTvl) - Number(this.lastData.staking.tvl)) / Number(metrics.stakingTvl);
        score -= Math.min(25, Math.abs(tvlChange) * 100);
      }
    } else {
      score -= 25;
    }

    // PID stability (20 points)
    const pidErrorAbs = Math.abs(metrics.pidErrorPct);
    score -= Math.min(20, pidErrorAbs * 200); // >10% error = -20

    // Treasury runway (15 points)
    if (metrics.treasuryRunwayMonths < 6) {
      score -= Math.max(0, (6 - metrics.treasuryRunwayMonths) * 2.5);
    }

    // DEX liquidity depth (15 points)
    if (metrics.reserveA === 0n || metrics.reserveB === 0n) {
      score -= 15;
    } else {
      // Penalize high slippage
      score -= Math.min(15, metrics.slippage * 0.3);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Detect anomalies based on current metrics
   */
  _detectAnomalies(metrics) {
    const anomalies = [];

    // Price drop
    if (this.lastData && metrics.auPriceInAg > 0n) {
      const prevPrice = Number(this.lastData.token.auPriceInAg);
      const currPrice = Number(metrics.auPriceInAg);
      if (prevPrice > 0) {
        const dropPct = (prevPrice - currPrice) / prevPrice;
        if (dropPct > 0.05) {
          anomalies.push({ type: 'PRICE_DROP', severity: 'warning', value: dropPct, message: `Au price dropped ${(dropPct * 100).toFixed(2)}%` });
        }
      }
    }

    // High slippage
    if (metrics.slippage > 10) {
      anomalies.push({ type: 'HIGH_SLIPPAGE', severity: 'critical', value: metrics.slippage, message: `DEX slippage at ${metrics.slippage.toFixed(2)}%` });
    }

    // Low treasury runway
    if (metrics.treasuryRunwayMonths < 3) {
      anomalies.push({ type: 'LOW_RUNWAY', severity: 'critical', value: metrics.treasuryRunwayMonths, message: `Treasury runway below 3 months` });
    }

    // PID error
    if (Math.abs(metrics.pidErrorPct) > 0.1) {
      anomalies.push({ type: 'PID_ERROR', severity: 'warning', value: metrics.pidErrorPct, message: `PID error at ${(metrics.pidErrorPct * 100).toFixed(2)}%` });
    }

    // Empty DEX
    if (metrics.reserveA === 0n || metrics.reserveB === 0n) {
      anomalies.push({ type: 'EMPTY_DEX', severity: 'critical', message: 'DEX reserves are empty' });
    }

    return anomalies;
  }

  /**
   * Get latest data point
   */
  getLatest() {
    return this.lastData;
  }

  /**
   * Get history (optionally filtered by time range)
   */
  getHistory(options = {}) {
    let result = this.history;
    if (options.since) {
      result = result.filter(d => d.timestamp >= options.since);
    }
    if (options.limit) {
      result = result.slice(-options.limit);
    }
    return result;
  }

  /**
   * Export data as JSON
   */
  exportJSON(options = {}) {
    const data = options.latestOnly ? this.lastData : this.history;
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get summary statistics for a given period
   */
  getStats(since = null) {
    const data = since ? this.history.filter(d => d.timestamp >= since) : this.history;
    if (data.length === 0) return null;

    const prices = data.map(d => Number(d.token.auPriceInAg) / 1e18);
    const tvls = data.map(d => Number(d.staking.tvl) / 1e18);
    const healthScores = data.map(d => d.system.healthScore);

    return {
      period: {
        start: data[0].timestamp,
        end: data[data.length - 1].timestamp,
        dataPoints: data.length,
      },
      price: {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        current: prices[prices.length - 1],
        change: prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0,
      },
      tvl: {
        min: Math.min(...tvls),
        max: Math.max(...tvls),
        avg: tvls.reduce((a, b) => a + b, 0) / tvls.length,
        current: tvls[tvls.length - 1],
      },
      health: {
        min: Math.min(...healthScores),
        max: Math.max(...healthScores),
        avg: healthScores.reduce((a, b) => a + b, 0) / healthScores.length,
        current: healthScores[healthScores.length - 1],
      },
      alerts: {
        total: data.reduce((sum, d) => sum + d.system.anomalies.length, 0),
        byType: data.reduce((acc, d) => {
          d.system.anomalies.forEach(a => {
            acc[a.type] = (acc[a.type] || 0) + 1;
          });
          return acc;
        }, {}),
      },
    };
  }
}

// ── CLI ───────────────────────────────────────────────────────────

if (require.main === module) {
  const engine = new AnalyticsEngine({
    intervalMs: parseInt(process.env.INTERVAL_MS) || 5000,
    maxHistory: parseInt(process.env.MAX_HISTORY) || 1000,
  });

  engine.on('data', (data) => {
    console.log(chalk.cyan(`[Round ${data.round}] Health: ${data.system.healthScore}/100 | Au: ${data.token.auPriceInAgFormatted} Ag | TVL: ${ethers.formatEther(data.staking.tvl)}`));
  });

  engine.on('error', (err) => {
    console.error(chalk.red(`[Error] ${err.message}`));
  });

  engine.on('anomaly', ({ anomalies }) => {
    anomalies.forEach(a => {
      console.log(chalk.red(`⚠ ${a.message}`));
    });
  });

  engine.start().catch((err) => {
    console.error(chalk.red('Failed to start AnalyticsEngine:'), err.message);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = () => {
    engine.stop();
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = AnalyticsEngine;
