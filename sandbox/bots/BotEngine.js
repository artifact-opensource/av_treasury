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
  'function allowance(address, address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const DEX_ABI = [
  'function swapAforB(uint256,uint256,address) returns (uint256)',
  'function swapBforA(uint256,uint256,address) returns (uint256)',
  'function addLiquidity(uint256, uint256) returns (uint256)',
  'function removeLiquidity(uint256) returns (uint256, uint256)',
  'function addOneSidedA(uint256) returns (uint256)',
  'function addOneSidedB(uint256) returns (uint256)',
  'function removeOneSidedA(uint256) returns (uint256)',
  'function removeOneSidedB(uint256) returns (uint256)',
  'function reserveA() view returns (uint112)',
  'function reserveB() view returns (uint112)',
  'function getReserves() view returns (uint256, uint256)',
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
  'function totalEmissions() view returns (uint256)',
];

const TREASURY_AMO_ABI = [
  'function executeBuyback(uint256, uint256)',
  'function canExecute() view returns (bool)',
  'function cooldownRemaining() view returns (uint256)',
  'function maxBuybackAmount() view returns (uint256)',
  'function totalBuybacksExecuted() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
];

const FLASH_BUY_ABI = [
  "function buybackAu(uint256 agAmount, uint256 minAuProfit) external",
];

const FLASH_LOAN_ABI = [
  "function flashBorrow(address token, uint256 amount, address recipient) external",
  "function fundedBalance() view returns (uint256)",
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
    swapDirection: 0.4,
    lpProbability: 0.8,
    stakeProbability: 0.6,
    buybackProbability: 0.02,
    gasLimit: 400000,
  },
  dumper: {
    tradeSizePercent: 0.2,
    intervalMs: 3000,
    swapDirection: 0.6,
    lpProbability: 0.05,
    stakeProbability: 0.05,
    buybackProbability: 0.01,
    gasLimit: 200000,
  },
  accumulator: {
    tradeSizePercent: 0.12,
    intervalMs: 10000,
    swapDirection: 0.3,
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
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    this.bots = [];
    this.round = 0;
    this.running = false;
    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      failedTransactions: 0,
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
        flashBuyback: 0,
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
    if (config.contracts.TreasuryFlashBuy) {
      this.flashBuy = new ethers.Contract(config.contracts.TreasuryFlashBuy, FLASH_BUY_ABI, this.provider);
    }
    if (config.contracts.FlashLoan) {
      this.flashLoan = new ethers.Contract(config.contracts.FlashLoan, FLASH_LOAN_ABI, this.provider);
    }
    this.treasuryAMO = new ethers.Contract(config.contracts.TreasuryAMO, TREASURY_AMO_ABI, this.provider);
    this.governor = new ethers.Contract(config.contracts.Governor, GOVERNOR_ABI, this.provider);

    // Initialize bots
    for (let i = 1; i <= BOT_COUNT; i++) {
      const wallet = ethers.Wallet.fromMnemonic(
        MNEMONIC,
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

    // Ensure all bots have ETH for gas (needed after Anvil restart)
    console.log('  ⛽ Funding bots with ETH for gas...');
    const deployer = new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      this.provider
    );
    // Get starting nonce
    let nonce = await deployer.getTransactionCount();
    const fundTasks = [];
    for (let i = 1; i <= BOT_COUNT; i++) {
      const bot = this.bots[i - 1];
      const bal = await this.provider.getBalance(bot.wallet.address);
      if (bal.lt(ethers.utils.parseEther('0.1'))) {
        fundTasks.push(
          deployer.sendTransaction({
            to: bot.wallet.address,
            value: ethers.utils.parseEther('1.0'),
            nonce: nonce++,
          })
        );
      }
    }
    const txs = await Promise.all(fundTasks);
    console.log(`  ⏳ Waiting for ${txs.length} funding txs to confirm...`);
    await Promise.all(txs.map(tx => tx.wait()));
    console.log(`  ✅ Funded ${txs.length} bots with ETH for gas`);
  }

  async getSystemState() {
    try {
      const reserves = await this.dex.getReserves();
      const reserveA = BigInt(reserves[0].toString());
      const reserveB = BigInt(reserves[1].toString());
      const lpSupply = BigInt((await this.lpToken.totalSupply()).toString());
      const stakedTvl = BigInt((await this.staking.totalStaked()).toString());
      const canEmit = await this.pid.canEmit();
      const canBuyback = await this.treasuryAMO.canExecute();

      const agSupply = BigInt((await this.agToken.totalSupply()).toString());
      const auSupply = BigInt((await this.auToken.totalSupply()).toString());
      const treasuryAg = BigInt((await this.agToken.balanceOf(this.treasuryAMO.address)).toString());
      const flashBuyAg = this.flashBuy ? BigInt((await this.agToken.balanceOf(this.flashBuy.address)).toString()) : 0n;
      const flashLoanAg = this.flashLoan ? BigInt((await this.agToken.balanceOf(this.flashLoan.address)).toString()) : 0n;
      let pidEmissions = 0n;
      try { pidEmissions = BigInt((await this.pid.totalEmissions()).toString()); } catch(e) { /* not implemented */ }

      const price = reserveA > 0n ? (reserveB * 10n ** 18n) / reserveA : 0n;
      const tvl = reserveA + reserveB; // simplified TVL

      return {
        reserveA,        // Ag reserve
        reserveB,        // Au reserve
        lpSupply,
        stakedTvl,
        price,           // Au price in terms of Ag (reserveB/reserveA)
        canEmit,
        canBuyback,
        agSupply,
        auSupply,
        treasuryAg,
        flashBuyAg,
        flashLoanAg,
        pidEmissions,
        tvl,
        trades: this.stats.successfulTrades,
        volume: this.stats.volume,
        pidActive: canEmit,
      };
    } catch (e) {
      console.log('getSystemState error:', e.message);
      return null;
    }
  }

  async runRound() {
    this.round++;
    const state = await this.getSystemState();
    if (!state) return;
    if (this.round <= 3) console.log('Round', this.round, 'bots:', this.bots.length, 'state:', !!state);

    const tasks = [];

    for (const bot of this.bots) {
      const now = Date.now();
      if (now - bot.lastAction < bot.personality.intervalMs) continue;

      // Random chance to act this round
      if (Math.random() > 0.7) continue;

      tasks.push(this._act(bot, state));
    }

    // Sequential execution with block mining to avoid DexSimulator anti-bot cooldown
    for (const task of tasks) {
      await task;
      try { await this.provider.send('evm_mine', []); } catch(e) {}
    }

    // Deterministic flash buyback every 10th round (after all bot actions)
    if (this.round % 10 === 0 && this.round > 0) {
      try {
        const flashBuyState = await this.getSystemState();
        if (flashBuyState) {
          const flashBuyAg = ethers.utils.formatEther(flashBuyState.flashBuyAg.toString());
          console.log(`  🔄 Flash Buyback triggered — FlashBuy has ${flashBuyAg} Ag`);
          await this._triggerFlashBuyback();
        }
      } catch (err) {
        console.log('  ⚠️ Flash buyback failed:', err.reason || err.message);
      }
    }

    // Emit live ATP snapshot for Reason pipeline
    this._emitATPState(state);

    // Log progress
    if (this.round % 10 === 0) {
      this._logStatus(state);
    }
  }

  // ── Live ATP State Emission ─────────────────────────────
  // Writes structured state snapshots to a file that the
  // Reason ATP watcher polls and analyzes in real-time.
  _emitATPState(state) {
    try {
      const fs = require('fs');
      const snapshot = {
        round: this.round,
        timestamp: Date.now(),
        block: this.provider ? null : null, // filled by watcher
        agSupply: state.agSupply ? ethers.utils.formatEther(state.agSupply.toString()) : '?',
        auSupply: state.auSupply ? ethers.utils.formatEther(state.auSupply.toString()) : '?',
        dexAgReserve: state.reserveA ? ethers.utils.formatEther(state.reserveA.toString()) : '?',
        dexAuReserve: state.reserveB ? ethers.utils.formatEther(state.reserveB.toString()) : '?',
        price: state.price ? ethers.utils.formatEther(state.price.toString()) : '?',
        tvl: state.tvl ? ethers.utils.formatEther(state.tvl.toString()) : '?',
        treasuryAg: state.treasuryAg ? ethers.utils.formatEther(state.treasuryAg.toString()) : '?',
        flashBuyAg: state.flashBuyAg ? ethers.utils.formatEther(state.flashBuyAg.toString()) : '?',
        pidEmissions: state.pidEmissions !== undefined ? ethers.utils.formatEther(state.pidEmissions.toString()) : '?',
        trades: state.trades || 0,
        volume: state.volume || 0,
        flashLoanBalance: state.flashLoanAg ? ethers.utils.formatEther(state.flashLoanAg.toString()) : '?',
        pidActive: state.pidActive || false,
      };
      const line = JSON.stringify(snapshot) + '\n';
      fs.appendFileSync('sandbox/logs/atp_snapshots.jsonl', line);
    } catch (err) {
      // ATP emission is non-critical, don't crash the simulation
    }
  }

  async _act(bot, state) {
    const { personality } = bot;
    bot.lastAction = Date.now();
    bot.actionCount++;

    // ── Balance guard rails ────────────────────────────────
    // Skip bots with no usable balance (saves gas + reduces noise)
    const dust = ethers.utils.parseEther('0.001');
    const agBal = await this.agToken.balanceOf(bot.wallet.address);
    const auBal = await this.auToken.balanceOf(bot.wallet.address);
    if (agBal.lt(dust) && auBal.lt(dust)) {
      return; // Bot is broke, skip
    }

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
    } catch (err) {
      this.stats.failedTransactions++;
    }
  }

  async _swap(bot, state) {
    const { wallet, personality } = bot;
    const agBal = BigInt((await this.agToken.balanceOf(wallet.address)).toString());
    const auBal = BigInt((await this.auToken.balanceOf(wallet.address)).toString());
    const lpBal = BigInt((await this.lpToken.balanceOf(wallet.address)).toString());
    const swapAforB = Math.random() < personality.swapDirection;

    let amountIn;
    let swapFn;

    if (swapAforB && agBal > 10n ** 15n) {
      // Sell Ag (tokenA) → buy Au (tokenB)
      amountIn = (agBal * BigInt(Math.floor(personality.tradeSizePercent * 100))) / 100n;
      swapFn = () => this.dex.connect(wallet).swapAforB(amountIn.toString(), 0, wallet.address, { gasLimit: personality.gasLimit });
      this.stats.tradesByType.swapAforB++;
    } else if (!swapAforB && auBal > 10n ** 15n) {
      // Sell Au (tokenB) → buy Ag (tokenA)
      amountIn = (auBal * BigInt(Math.floor(personality.tradeSizePercent * 100))) / 100n;
      swapFn = () => this.dex.connect(wallet).swapBforA(amountIn.toString(), 0, wallet.address, { gasLimit: personality.gasLimit });
      this.stats.tradesByType.swapBforA++;
    } else {
      return; // Can't swap
    }

    // Approve if needed
    const token = swapAforB ? this.agToken : this.auToken;
    const approved = BigInt((await token.connect(wallet).allowance(wallet.address, this.config.contracts.DexSimulator)).toString());
    if (approved < amountIn) {
      await token.connect(wallet).approve(this.config.contracts.DexSimulator, ethers.constants.MaxUint256, { gasLimit: 200000 });
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
    const agBal = BigInt((await this.agToken.balanceOf(wallet.address)).toString());
    const auBal = BigInt((await this.auToken.balanceOf(wallet.address)).toString());
    if (agBal < 10n ** 15n && auBal < 10n ** 15n) return;

    // Decide: two-sided or one-sided
    const oneSided = Math.random() < 0.4;

    try {
      if (oneSided && agBal > auBal * 2n) {
        // One-sided Ag
        const amount = (agBal * 10n) / 100n; // 10%
        await this.agToken.connect(wallet).approve(this.config.contracts.LpToken, amount.toString(), { gasLimit: 200000 });
        const tx = await this.lpToken.connect(wallet).mintOneSidedA(amount.toString(), { gasLimit: personality.gasLimit });
        await tx.wait();
        this.stats.tradesByType.addLiquidity++;
        this.stats.totalTrades++;
        this.stats.successfulTrades++;
        this.stats.uniqueTraders.add(wallet.address);
        return;
      } else if (oneSided && auBal > agBal * 2n) {
        // One-sided Au
        const amount = (auBal * 10n) / 100n;
        await this.auToken.connect(wallet).approve(this.config.contracts.LpToken, amount.toString(), { gasLimit: 200000 });
        const tx = await this.lpToken.connect(wallet).mintOneSidedB(amount.toString(), { gasLimit: personality.gasLimit });
        await tx.wait();
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

        await this.agToken.connect(wallet).approve(this.config.contracts.LpToken, agAmount.toString(), { gasLimit: 200000 });
        await this.auToken.connect(wallet).approve(this.config.contracts.LpToken, auAmount.toString(), { gasLimit: 200000 });
        const tx = await this.lpToken.connect(wallet).mint(agAmount.toString(), auAmount.toString(), { gasLimit: personality.gasLimit });
        await tx.wait();
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
    const lpBal = BigInt((await this.lpToken.balanceOf(wallet.address)).toString());
    const [pendingAuRaw, pendingAgRaw] = await this.staking.pendingRewards(wallet.address);
    const pendingAu = BigInt(pendingAuRaw.toString());
    const pendingAg = BigInt(pendingAgRaw.toString());

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
        await this.lpToken.connect(wallet).approve(this.config.contracts.Staking, lpBal.toString(), { gasLimit: 200000 });
        const tx = await this.staking.connect(wallet).stake(lpBal.toString(), { gasLimit: 200000 });
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

    const maxAmountRaw = await this.treasuryAMO.maxBuybackAmount();
    const maxAmount = BigInt(maxAmountRaw.toString());
    if (maxAmount < 10n ** 15n) return;

    // Use a fraction of max
    const amount = (maxAmount * 10n) / 100n;
    if (amount < 10n ** 15n) return;

    try {
      // Fund from bot's Ag balance (bot acts as "keeper")
      const agBalRaw = await this.agToken.balanceOf(bot.wallet.address);
      const agBal = BigInt(agBalRaw.toString());
      if (agBal < amount) return;

      await this.agToken.connect(bot.wallet).approve(this.config.contracts.TreasuryAMO, amount.toString(), { gasLimit: 300000 });
      const minAuOut = 0;
      const tx = await this.treasuryAMO.connect(bot.wallet).executeBuyback(amount.toString(), minAuOut, { gasLimit: 300000 });
      await tx.wait();
      this.stats.tradesByType.buyback++;
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.uniqueTraders.add(bot.wallet.address);
    } catch {}
  }

  async _triggerFlashBuyback() {
    try {
      // Every 10th round, attempt a buyback
      if (this.round % 10 !== 0) return;

      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];

      // Check if FlashBuy contract has Ag to sell
      const flashBuyBal = await this.agToken.balanceOf(this.flashBuy.address);
      const flashBuyAg = Number(flashBuyBal) / 1e18;
      if (flashBuyAg < 100) return; // Not enough Ag in FlashBuy contract

      // Swap up to 10% of FlashBuy Ag balance for Au (use integer math)
      const buyAmount = flashBuyBal / 10n; // 10% of balance (112 bits safe)
      if (buyAmount === 0n) return;
      const minAuProfit = ethers.utils.parseEther('0');

      const tx = await this.flashBuy.connect(bot.wallet).buybackAu(
        buyAmount,
        minAuProfit,
        { gasLimit: 300000 }
      );
      await tx.wait();
      this.stats.flashBuybacks = (this.stats.flashBuybacks || 0) + 1;
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.stats.uniqueTraders.add(bot.wallet.address);
    } catch (e) {
      // Buyback is optional — don't count as failure
    }
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
    } catch (e) {
      this.stats.failedTrades++;
      if (this.stats.failedTrades <= 5) console.log(`  ⚠️ tick failed: ${e.reason || e.message || 'unknown'}`);
    }
  }

  _logStatus(state) {
    const price = Number(state.price) / 1e18;
    const stakedTvl = Number(state.stakedTvl) / 1e18;
    const agReserve = Number(state.reserveA) / 1e18;
    const auReserve = Number(state.reserveB) / 1e18;
    const tvl = agReserve + auReserve;
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
    console.log(`  Actions: swap, LP, stake, claim, buyback, flashBuyback, PID tick`);
    console.log();

    for (let r = 0; r < rounds && this.running; r++) {
      console.log(`--- Round ${r+1} ---`);
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
