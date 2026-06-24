#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * BotEngine — Autonomous DAO Simulation (Full Flywheel)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 100 autonomous agents interacting with the full dual-token system:
 *   • Swap Au↔Ag on DEX
 *   • Add/remove liquidity (one-sided and two-sided)
 *   • Stake LP tokens → earn Au + Ag yield
 *   • Trigger TreasuryAMO buybacks
 *   • Trigger PID emission adjustments
 *   • Participate in governance
 *
 * Behaviors are driven by each bot's "personality" and the current
 * system state (price, TVL, staking APY, buyback capacity).
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'http://127.0.0.1:8545';
const MNEMONIC = 'test test test test test test test test test test test junk';
const BOT_COUNT = 100;

// ── ABIs ─────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function transfer(address, uint256) returns (bool)',
  'function mint(address, uint256)',
];

const DEX_ABI = [
  'function swapAforB(uint256) returns (uint256)',
  'function swapBforA(uint256) returns (uint256)',
  'function addLiquidity(uint256, uint256) returns (uint256)',
  'function removeLiquidity(uint256) returns (uint256, uint256)',
  'function addOneSidedA(uint256) returns (uint256)',
  'function addOneSidedB(uint256) returns (uint256)',
  'function removeOneSidedA(uint256) returns (uint256)',
  'function removeOneSidedB(uint256) returns (uint256)',
  'function getReserveA() view returns (uint256)',
  'function getReserveB() view returns (uint256)',
  'function getLpBalance(address) view returns (uint256)',
];

const LP_TOKEN_ABI = [
  'function mint(uint256, uint256) returns (uint256)',
  'function mintOneSidedA(uint256) returns (uint256)',
  'function mintOneSidedB(uint256) returns (uint256)',
  'function burn(uint256) returns (uint256, uint256)',
  'function approve(address, uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const STAKING_ABI = [
  'function stake(uint256)',
  'function unstake(uint256)',
  'function claimRewards()',
  'function pendingRewards(address) view returns (uint256, uint256)',
  'function stakedBalance(address) view returns (uint256)',
  'function getTvl() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
];

const PID_ABI = [
  'function tick() returns (uint256)',
  'function getCurrentError() view returns (int256)',
  'function canEmit() view returns (bool)',
  'function targetTvl() view returns (int256)',
  'function remainingDailyEmission() view returns (uint256)',
];

const TREASURY_AMO_ABI = [
  'function executeBuyback(uint256, uint256)',
  'function canExecute() view returns (bool)',
  'function cooldownRemaining() view returns (uint256)',
  'function maxBuybackAmount() view returns (uint256)',
  'function totalBuybacksExecuted() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
];

const GOVERNOR_ABI = [
  'function propose(string, address, bytes) returns (uint256)',
  'function castVote(uint256, bool, uint256)',
  'function queue(uint256)',
  'function execute(uint256)',
  'function getProposal(uint256) view returns (tuple(uint256,address,string,address,bytes,uint256,uint256,uint256,uint256,uint256,bool,bool))',
  'function proposalCount() view returns (uint256)',
];

// ── Personality Definitions ──────────────────────────────────────

const PERSONALITIES = {
  whale: {
    tradeSizePercent: 0.3,
    intervalMs: 30000,
    swapDirection: 0.5,
    lpProbability: 0.2,
    stakeProbability: 0.3,
    buybackProbability: 0.1,
    gasLimit: 500000,
  },
  dayTrader: {
    tradeSizePercent: 0.15,
    intervalMs: 5000,
    swapDirection: 0.7,
    lpProbability: 0.1,
    stakeProbability: 0.2,
    buybackProbability: 0.05,
    gasLimit: 300000,
  },
  dolphin: {
    tradeSizePercent: 0.05,
    intervalMs: 15000,
    swapDirection: 0.5,
    lpProbability: 0.3,
    stakeProbability: 0.3,
    buybackProbability: 0.05,
    gasLimit: 200000,
  },
  lp: {
    tradeSizePercent: 0.1,
    intervalMs: 20000,
    swapDirection: 0.0,
    lpProbability: 0.8,
    stakeProbability: 0.6,
    buybackProbability: 0.02,
    gasLimit: 400000,
  },
  dumper: {
    tradeSizePercent: 0.2,
    intervalMs: 3000,
    swapDirection: 1.0,
    lpProbability: 0.05,
    stakeProbability: 0.05,
    buybackProbability: 0.01,
    gasLimit: 200000,
  },
  accumulator: {
    tradeSizePercent: 0.12,
    intervalMs: 10000,
    swapDirection: 0.0,
    lpProbability: 0.2,
    stakeProbability: 0.5,
    buybackProbability: 0.05,
    gasLimit: 200000,
  },
  staker: {
    tradeSizePercent: 0.03,
    intervalMs: 25000,
    swapDirection: 0.3,
    lpProbability: 0.4,
    stakeProbability: 0.9,
    buybackProbability: 0.02,
    gasLimit: 300000,
  },
};

function getPersonality(index) {
  const types = ['whale', 'dayTrader', 'dolphin', 'lp', 'dumper', 'accumulator', 'staker'];
  // Distribution: 5 whales, 15 dayTraders, 10 dolphins, 20 LPs, 15 dumpers, 15 accumulators, 20 stakers
  if (index <= 5) return types[0];
  if (index <= 20) return types[1];
  if (index <= 30) return types[2];
  if (index <= 50) return types[3];
  if (index <= 65) return types[4];
  if (index <= 80) return types[5];
  return types[6];
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
      tradesByType: {
        swapAforB: 0,
        swapBforA: 0,
        addLiquidity: 0,
        removeLiquidity: 0,
        stake: 0,
        unstake: 0,
        claimRewards: 0,
        buyback: 0,
        pidTick: 0,
        governance: 0,
      },
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

    // Initialize contract instances
    this.auToken = new ethers.Contract(config.contracts.AuToken, ERC20_ABI, this.provider);
    this.agToken = new ethers.Contract(config.contracts.AgToken, ERC20_ABI, this.provider);
    this.dex = new ethers.Contract(config.contracts.DexSimulator, DEX_ABI, this.provider);
    this.lpToken = new ethers.Contract(config.contracts.LpToken, LP_TOKEN_ABI, this.provider);
    this.staking = new ethers.Contract(config.contracts.Staking, STAKING_ABI, this.provider);
    this.pid = new ethers.Contract(config.contracts.PIDController, PID_ABI, this.provider);
    this.treasuryAMO = new ethers.Contract(config.contracts.TreasuryAMO, TREASURY_AMO_ABI, this.provider);
    this.governor = new ethers.Contract(config.contracts.Governor, GOVERNOR_ABI, this.provider);

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
        personality: PERSONALITIES[personality],
        personalityType: personality,
        lastAction: 0,
        actionCount: 0,
      });
    }

    console.log(`  ✅ ${BOT_COUNT} bots initialized with 7 personality types`);
  }

  async getSystemState() {
    try {
      const [reserveA, reserveB, lpSupply, stakedTvl, canEmit, canBuyback] = await Promise.all([
        this.dex.getReserveA(),
        this.dex.getReserveB(),
        this.lpToken.totalSupply(),
        this.staking.totalStaked(),
        this.pid.canEmit(),
        this.treasuryAMO.canExecute(),
      ]);

      const price = reserveA > 0n ? (reserveB * 10n ** 18n) / reserveA : 0n;

      return {
        reserveA,        // Ag reserve
        reserveB,        // Au reserve
        lpSupply,
        stakedTvl,
        price,           // Au price in terms of Ag (reserveB/reserveA)
        canEmit,
        canBuyback,
      };
    } catch {
      return null;
    }
  }

  async runRound() {
    this.round++;
    const state = await this.getSystemState();
    if (!state) return;

    const tasks = [];

    for (const bot of this.bots) {
      const now = Date.now();
      if (now - bot.lastAction < bot.personality.intervalMs) continue;

      // Random chance to act this round
      if (Math.random() > 0.7) continue;

      tasks.push(this._act(bot, state));
    }

    await Promise.allSettled(tasks);

    // Log progress
    if (this.round % 10 === 0) {
      this._logStatus(state);
    }
  }

  async _act(bot, state) {
    const { personality } = bot;
    bot.lastAction = Date.now();
    bot.actionCount++;

    // Decide action based on personality probabilities and system state
    const roll = Math.random();

    try {
      if (roll < personality.lpProbability * 0.3) {
        await this._addLiquidity(bot, state);
      } else if (roll < personality.lpProbability * 0.3 + personality.stakeProbability * 0.3) {
        await this._stakeOrClaim(bot);
      } else if (roll < personality.lpProbability * 0.3 + personality.stakeProbability * 0.3 + personality.buybackProbability) {
        await this._triggerBuyback(bot, state);
      } else if (roll < personality.lpProbability * 0.3 + personality.stakeProbability * 0.3 + personality.buybackProbability + 0.05) {
        await this._triggerPID();
      } else {
        await this._swap(bot, state);
      }
    } catch {
      // Silently handle failures — bots are autonomous
    }
  }

  async _swap(bot, state) {
    const { wallet, personality } = bot;
    const agBal = await this.agToken.balanceOf(wallet.address);
    const auBal = await this.auToken.balanceOf(wallet.address);

    const swapAforB = Math.random() < personality.swapDirection;

    let amountIn;
    let swapFn;

    if (swapAforB && agBal > 10n ** 15n) {
      // Sell Ag (tokenA) → buy Au (tokenB)
      amountIn = (agBal * BigInt(Math.floor(personality.tradeSizePercent * 100))) / 100n;
      swapFn = () => this.dex.connect(wallet).swapAforB(amountIn, { gasLimit: personality.gasLimit });
      this.stats.tradesByType.swapAforB++;
    } else if (!swapAforB && auBal > 10n ** 15n) {
      // Sell Au (tokenB) → buy Ag (tokenA)
      amountIn = (auBal * BigInt(Math.floor(personality.tradeSizePercent * 100))) / 100n;
      swapFn = () => this.dex.connect(wallet).swapBforA(amountIn, { gasLimit: personality.gasLimit });
      this.stats.tradesByType.swapBforA++;
    } else {
      return; // Can't swap
    }

    // Approve if needed
    const token = swapAforB ? this.agToken : this.auToken;
    const approved = await token.connect(wallet).allowance(wallet.address, this.config.contracts.DexSimulator);
    if (approved < amountIn) {
      await token.connect(wallet).approve(this.config.contracts.DexSimulator, ethers.MaxUint256);
    }

    const tx = await swapFn();
    await tx.wait();

    this.stats.totalTrades++;
    this.stats.successfulTrades++;
    this.stats.totalVolume += amountIn;
    this.stats.uniqueTraders.add(wallet.address);
  }

  async _addLiquidity(bot, state) {
    const { wallet, personality } = bot;
    const agBal = await this.agToken.balanceOf(wallet.address);
    const auBal = await this.auToken.balanceOf(wallet.address);

    if (agBal < 10n ** 15n && auBal < 10n ** 15n) return;

    // Decide: two-sided or one-sided
    const oneSided = Math.random() < 0.4;
    let lpAmount;

    try {
      if (oneSided && agBal > auBal * 2n) {
        // One-sided Ag
        const amount = (agBal * 10n) / 100n; // 10%
        await this.agToken.connect(wallet).approve(this.config.contracts.LpToken, amount);
        const tx = await this.lpToken.connect(wallet).mintOneSidedA(amount, { gasLimit: personality.gasLimit });
        const receipt = await tx.wait();
        this.stats.tradesByType.addLiquidity++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
        return;
      } else if (oneSided && auBal > agBal * 2n) {
        // One-sided Au
        const amount = (auBal * 10n) / 100n;
        await this.auToken.connect(wallet).approve(this.config.contracts.LpToken, amount);
        const tx = await this.lpToken.connect(wallet).mintOneSidedB(amount, { gasLimit: personality.gasLimit });
        const receipt = await tx.wait();
        this.stats.tradesByType.addLiquidity++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
        return;
      } else {
        // Two-sided
        const agAmount = (agBal * 5n) / 100n;  // 5%
        const auAmount = (auBal * 5n) / 100n;
        if (agAmount < 10n ** 15n || auAmount < 10n ** 15n) return;

        await this.agToken.connect(wallet).approve(this.config.contracts.LpToken, agAmount);
        await this.auToken.connect(wallet).approve(this.config.contracts.LpToken, auAmount);
        const tx = await this.lpToken.connect(wallet).mint(agAmount, auAmount, { gasLimit: personality.gasLimit });
        const receipt = await tx.wait();
        this.stats.tradesByType.addLiquidity++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
      }
    } catch {
      // LP might fail if reserves are too imbalanced
    }
  }

  async _stakeOrClaim(bot) {
    const { wallet, personality } = bot;
    const lpBal = await this.lpToken.balanceOf(wallet.address);
    const [pendingAu, pendingAg] = await this.staking.pendingRewards(wallet.address);

    // Claim rewards if significant
    if (pendingAu > 10n ** 15n || pendingAg > 10n ** 15n) {
      try {
        const tx = await this.staking.connect(wallet).claimRewards({ gasLimit: 200000 });
        await tx.wait();
        this.stats.tradesByType.claimRewards++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
      } catch {}
    }

    // Stake if has LP and probability hits
    if (lpBal > 10n ** 15n && Math.random() < personality.stakeProbability) {
      try {
        await this.lpToken.connect(wallet).approve(this.config.contracts.Staking, lpBal);
        const tx = await this.staking.connect(wallet).stake(lpBal, { gasLimit: 200000 });
        await tx.wait();
        this.stats.tradesByType.stake++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
      } catch {}
    }
  }

  async _triggerBuyback(bot, state) {
    if (!state.canBuyback) return;

    const maxAmount = await this.treasuryAMO.maxBuybackAmount();
    if (maxAmount < 10n ** 15n) return;

    // Use a fraction of max
    const amount = (maxAmount * 10n) / 100n;
    if (amount < 10n ** 15n) return;

    try {
      // Fund from bot's Ag balance (bot acts as "keeper")
      const agBal = await this.agToken.balanceOf(bot.wallet.address);
      if (agBal < amount) return;

      await this.agToken.connect(bot.wallet).approve(this.config.contracts.TreasuryAMO, amount);
      const minAuOut = 0; // Let contract handle slippage
      const tx = await this.treasuryAMO.connect(bot.wallet).executeBuyback(amount, minAuOut, { gasLimit: 300000 });
      await tx.wait();
      this.stats.tradesByType.buyback++;
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.uniqueTraders.add(bot.wallet.address);
    } catch {}
  }

  async _triggerPID() {
    try {
      const canEmit = await this.pid.canEmit();
      if (!canEmit) return;

      // Any bot can call tick()
      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
      const tx = await this.pid.connect(bot.wallet).tick({ gasLimit: 200000 });
      const receipt = await tx.wait();
      this.stats.tradesByType.pidTick++;
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.uniqueTraders.add(bot.wallet.address);
    } catch {}
  }

  _logStatus(state) {
    const price = Number(state.price) / 1e18;
    const tvl = Number(state.stakedTvl) / 1e18;
    const agReserve = Number(state.reserveA) / 1e18;
    const auReserve = Number(state.reserveB) / 1e18;

    console.log(
      `  📊 Round ${this.round}: ` +
      `Price=${price.toFixed(6)} Au/Ag | ` +
      `Reserves: ${agReserve.toFixed(0)} Ag / ${auReserve.toFixed(0)} Au | ` +
      `TVL: ${tvl.toFixed(0)} | ` +
      `Trades: ${this.stats.totalTrades} | ` +
      `Volume: ${(Number(this.stats.totalVolume) / 1e18).toFixed(0)}`
    );
  }

  async start(rounds = 100) {
    this.running = true;
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🤖 BotEngine — Full DAO Simulation');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Bots: ${BOT_COUNT} | Rounds: ${rounds}`);
    console.log(`  Personalities: whale, dayTrader, dolphin, lp, dumper, accumulator, staker`);
    console.log(`  Actions: swap, LP, stake, claim, buyback, PID tick`);
    console.log();

    for (let r = 0; r < rounds && this.running; r++) {
      await this.runRound();
      // Small delay between rounds
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this._printFinalStats();
  }

  stop() {
    this.running = false;
  }

  _printFinalStats() {
    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📈 Final Statistics');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Trades:      ${this.stats.totalTrades}`);
    console.log(`  Successful:        ${this.stats.successfulTrades}`);
    console.log(`  Failed:            ${this.stats.failedTrades}`);
    console.log(`  Unique Traders:    ${this.stats.uniqueTraders.size}`);
    console.log(`  Total Volume:      ${(Number(this.stats.totalVolume) / 1e18).toFixed(2)}`);
    console.log();
    console.log('  Trades by Type:');
    for (const [type, count] of Object.entries(this.stats.tradesByType)) {
      if (count > 0) {
        console.log(`    ${type.padEnd(18)} ${count}`);
      }
    }
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// ── CLI ──────────────────────────────────────────────────────────

async function main() {
  const engine = new BotEngine();
  await engine.init();

  const rounds = parseInt(process.argv[2]) || 100;
  await engine.start(rounds);
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌ BotEngine error:', e.message);
    process.exit(1);
  });
}

module.exports = { BotEngine, getPersonality };
