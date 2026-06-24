#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Stress Test Scenarios — Full Dual-Token DAO Flywheel
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the COMPLETE system including:
 * - Au/Ag swaps on DEX
 * - One-sided liquidity
 * - Staking + yield
 * - TreasuryAMO buybacks
 * - PID emission adjustments
 * - Flywheel feedback loops
 *
 * Usage: node sandbox/scripts/stress-test.js <scenario>
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const MNEMONIC = 'test test test test test test test test test test test junk';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
];

const DEX_ABI = [
  'function swapAforB(uint256) returns (uint256)',
  'function swapBforA(uint256) returns (uint256)',
  'function addLiquidity(uint256, uint256) returns (uint256)',
  'function removeLiquidity(uint256) returns (uint256, uint256)',
  'function addOneSidedA(uint256) returns (uint256)',
  'function addOneSidedB(uint256) returns (uint256)',
  'function getReserveA() view returns (uint256)',
  'function getReserveB() view returns (uint256)',
  'function getLpBalance(address) view returns (uint256)',
];

const LP_ABI = [
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
  'function totalStaked() view returns (uint256)',
];

const PID_ABI = [
  'function tick() returns (uint256)',
  'function getCurrentError() view returns (int256)',
  'function canEmit() view returns (bool)',
  'function targetTvl() view returns (int256)',
];

const AMO_ABI = [
  'function executeBuyback(uint256, uint256)',
  'function canExecute() view returns (bool)',
  'function maxBuybackAmount() view returns (uint256)',
  'function totalBuybacksExecuted() view returns (uint256)',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getSigner(provider, index) {
  return ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    `m/44'/60'/0'/0/${index}`
  ).connect(provider);
}

async function getPrice(dex) {
  try {
    const [rA, rB] = await Promise.all([dex.getReserveA(), dex.getReserveB()]);
    if (rA === 0n) return 0n;
    return (rB * 10n ** 18n) / rA; // Au price in Ag terms
  } catch {
    return 0n;
  }
}

async function main() {
  const scenario = process.argv[2] || 'crash';

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const auAddr = config.contracts.AuToken;
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;
  const lpAddr = config.contracts.LpToken;
  const stakingAddr = config.contracts.Staking;
  const pidAddr = config.contracts.PIDController;
  const amoAddr = config.contracts.TreasuryAMO;

  const auToken = new ethers.Contract(auAddr, ERC20_ABI, provider);
  const agToken = new ethers.Contract(agAddr, ERC20_ABI, provider);
  const dex = new ethers.Contract(dexAddr, DEX_ABI, provider);
  const lpToken = new ethers.Contract(lpAddr, LP_ABI, provider);
  const staking = new ethers.Contract(stakingAddr, STAKING_ABI, provider);
  const pid = new ethers.Contract(pidAddr, PID_ABI, provider);
  const amo = new ethers.Contract(amoAddr, AMO_ABI, provider);

  const initialPrice = await getPrice(dex);
  const initialAuSupply = await auToken.totalSupply();
  const initialAgSupply = await agToken.totalSupply();
  const initialTvl = await staking.totalStaked();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🔥 STRESS TEST: ${scenario.toUpperCase()} — Full DAO Flywheel`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Price: ${ethers.formatEther(initialPrice)} Au/Ag`);
  console.log(`  Au:    ${ethers.formatEther(initialAuSupply)}`);
  console.log(`  Ag:    ${ethers.formatEther(initialAgSupply)}`);
  console.log(`  TVL:   ${ethers.formatEther(initialTvl)}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  switch (scenario) {
    case 'crash':
      await runCrashScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken);
      break;
    case 'squeeze':
      await runSqueezeScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken);
      break;
    case 'drain':
      await runDrainScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken);
      break;
    case 'flywheel':
      await runFlywheelScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken);
      break;
    case 'deathspiral':
      await runDeathSpiralScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken);
      break;
    default:
      console.error(`Unknown scenario: ${scenario}`);
      console.error('Available: crash, squeeze, drain, flywheel, deathspiral');
      process.exit(1);
  }

  // Final state
  const finalPrice = await getPrice(dex);
  const finalAuSupply = await auToken.totalSupply();
  const finalAgSupply = await agToken.totalSupply();
  const finalTvl = await staking.totalStaked();

  const priceChange = initialPrice > 0n
    ? ((finalPrice - initialPrice) * 10000n) / initialPrice
    : 0n;

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('  📊 RESULTS');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Price:   ${ethers.formatEther(initialPrice)} → ${ethers.formatEther(finalPrice)} (${Number(priceChange) / 100}%)`);
  console.log(`  Au Sup:  ${ethers.formatEther(initialAuSupply)} → ${ethers.formatEther(finalAuSupply)}`);
  console.log(`  Ag Sup:  ${ethers.formatEther(initialAgSupply)} → ${ethers.formatEther(finalAgSupply)}`);
  console.log(`  TVL:     ${ethers.formatEther(initialTvl)} → ${ethers.formatEther(finalTvl)}`);
  console.log(`  Au Burn: ${ethers.formatEther(initialAuSupply - finalAuSupply)}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ── Scenario: Crash ─────────────────────────────────────────────
// Mass sell Ag for Au → triggers buyback → PID adjusts
async function runCrashScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken) {
  console.log('  📉 CRASH — Mass Ag selling + buyback trigger...');
  const auAddr = config.contracts.AuToken;
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;
  const lpAddr = config.contracts.LpToken;

  for (let round = 0; round < 5; round++) {
    // Bots sell Ag for Au
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const balB = await agToken.balanceOf(bot.address);
      if (balB > ethers.parseEther('100')) {
        const sell = balB / 2n;
        await agToken.connect(bot).approve(dexAddr, sell);
        try { await dex.connect(bot).swapAforB(sell, { gasLimit: 500000 }); } catch (_) {}
      }
    }

    // Trigger buyback if possible
    const canBuy = await amo.canExecute();
    if (canBuy) {
      const maxBuy = await amo.maxBuybackAmount();
      if (maxBuy > ethers.parseEther('1000')) {
        const keeper = await getSigner(provider, 50);
        const buyAmount = maxBuy / 2n;
        await agToken.connect(keeper).approve(config.contracts.TreasuryAMO, buyAmount);
        try { await amo.connect(keeper).executeBuyback(buyAmount, 0, { gasLimit: 300000 }); } catch (_) {}
        console.log(`    Buyback executed: ${ethers.formatEther(buyAmount)} Ag`);
      }
    }

    // Trigger PID
    const canEmit = await pid.canEmit();
    if (canEmit) {
      const keeper = await getSigner(provider, 51);
      try { await pid.connect(keeper).tick({ gasLimit: 200000 }); } catch (_) {}
    }

    const p = await getPrice(dex);
    const tvl = await staking.totalStaked();
    console.log(`    Round ${round + 1}: Price=${ethers.formatEther(p)} | TVL=${ethers.formatEther(tvl)}`);
    await sleep(1000);
  }
}

// ── Scenario: Squeeze ────────────────────────────────────────────
// Whale buys large Au → price spikes → PID mints more Ag
async function runSqueezeScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken) {
  console.log('  📈 SQUEEZE — Whale buys Au → PID mints Ag...');
  const whale = await getSigner(provider, 0);
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;

  // Mint whale 1M Ag
  await agToken.connect(whale).mint(whale.address, ethers.parseEther('1000000'));

  const amount = ethers.parseEther('200000');
  await agToken.connect(whale).approve(dexAddr, amount);

  const chunks = 5;
  const chunk = amount / BigInt(chunks);
  for (let i = 0; i < chunks; i++) {
    try { await dex.connect(whale).swapAforB(chunk, { gasLimit: 500000 }); } catch (_) {}

    // Trigger PID after each chunk
    const canEmit = await pid.canEmit();
    if (canEmit) {
      try { await pid.connect(whale).tick({ gasLimit: 200000 }); } catch (_) {}
    }

    const p = await getPrice(dex);
    const tvl = await staking.totalStaked();
    console.log(`    Chunk ${i + 1}/${chunks}: Price=${ethers.formatEther(p)} | TVL=${ethers.formatEther(tvl)}`);
    await sleep(500);
  }
}

// ── Scenario: Drain ──────────────────────────────────────────────
// Repeated LP removal + selling to drain reserves
async function runDrainScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken) {
  console.log('  🕳️  DRAIN — Repeated LP removal + selling...');
  const auAddr = config.contracts.AuToken;
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;
  const lpAddr = config.contracts.LpToken;

  for (let round = 0; round < 10; round++) {
    for (let i = 1; i <= 10; i++) {
      const bot = await getSigner(provider, i);

      // Sell Ag for Au
      const agBal = await agToken.balanceOf(bot.address);
      if (agBal > ethers.parseEther('100')) {
        const sell = bal / 3n;
        await agToken.connect(bot).approve(dexAddr, sell);
        try { await dex.connect(bot).swapAforB(sell, { gasLimit: 300000 }); } catch (_) {}
      }

      // Remove liquidity occasionally
      const lpBal = await lpToken.balanceOf(bot.address);
      if (lpBal > ethers.parseEther('10') && Math.random() < 0.3) {
        try { await lpToken.connect(bot).burn(lpBal / 2n, { gasLimit: 300000 }); } catch (_) {}
      }
    }

    // PID tick
    const canEmit = await pid.canEmit();
    if (canEmit) {
      const keeper = await getSigner(provider, 50);
      try { await pid.connect(keeper).tick({ gasLimit: 200000 }); } catch (_) {}
    }

    const p = await getPrice(dex);
    const tvl = await staking.totalStaked();
    console.log(`    Round ${round + 1}: Price=${ethers.formatEther(p)} | TVL=${ethers.formatEther(tvl)}`);
    await sleep(500);
  }
}

// ── Scenario: Flywheel ───────────────────────────────────────────
// Test the full upward spiral: LP → stake → yield → more LP → PID → buyback
async function runFlywheelScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken) {
  console.log('  🔄 FLYWHEEL — Testing the full upward spiral...');
  const auAddr = config.contracts.AuToken;
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;
  const lpAddr = config.contracts.LpToken;

  for (let round = 0; round < 8; round++) {
    console.log(`    --- Round ${round + 1} ---`);

    // Step 1: Bots add liquidity
    for (let i = 1; i <= 15; i++) {
      const bot = await getSigner(provider, i);
      const agBal = await agToken.balanceOf(bot.address);
      const auBal = await auToken.balanceOf(bot.address);

      if (agBal > ethers.parseEther('500') && auBal > ethers.parseEther('500')) {
        const agAmt = agBal / 10n;
        const auAmt = auBal / 10n;
        await agToken.connect(bot).approve(lpAddr, agAmt);
        await auToken.connect(bot).approve(lpAddr, auAmt);
        try { await lpToken.connect(bot).mint(agAmt, auAmt, { gasLimit: 400000 }); } catch (_) {}
      } else if (agBal > ethers.parseEther('1000')) {
        const amt = agBal / 10n;
        await agToken.connect(bot).approve(lpAddr, amt);
        try { await lpToken.connect(bot).mintOneSidedA(amt, { gasLimit: 300000 }); } catch (_) {}
      }
    }

    // Step 2: Bots stake LP
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const lpBal = await lpToken.balanceOf(bot.address);
      if (lpBal > ethers.parseEther('10')) {
        await lpToken.connect(bot).approve(config.contracts.Staking, lpBal);
        try { await staking.connect(bot).stake(lpBal, { gasLimit: 200000 }); } catch (_) {}
      }
    }

    // Step 3: PID mints Ag based on TVL
    const canEmit = await pid.canEmit();
    if (canEmit) {
      const keeper = await getSigner(provider, 50);
      try { await pid.connect(keeper).tick({ gasLimit: 200000 }); } catch (_) {}
    }

    // Step 4: Buyback if Au price dropped
    const canBuy = await amo.canExecute();
    if (canBuy) {
      const maxBuy = await amo.maxBuybackAmount();
      if (maxBuy > ethers.parseEther('1000')) {
        const keeper = await getSigner(provider, 51);
        await agToken.connect(keeper).approve(config.contracts.TreasuryAMO, maxBuy / 2n);
        try { await amo.connect(keeper).executeBuyback(maxBuy / 2n, 0, { gasLimit: 300000 }); } catch (_) {}
      }
    }

    // Step 5: Some bots claim rewards
    for (let i = 1; i <= 10; i++) {
      const bot = await getSigner(provider, i);
      try { await staking.connect(bot).claimRewards({ gasLimit: 200000 }); } catch (_) {}
    }

    const p = await getPrice(dex);
    const tvl = await staking.totalStaked();
    const totalBuybacks = await amo.totalBuybacksExecuted();
    console.log(`    Price=${ethers.formatEther(p)} | TVL=${ethers.formatEther(tvl)} | Buybacks=${totalBuybacks}`);
    await sleep(1000);
  }
}

// ── Scenario: Death Spiral ───────────────────────────────────────
// Extreme pressure: mass sell + LP removal + no buyback
async function runDeathSpiralScenario(provider, config, auToken, agToken, dex, staking, pid, amo, lpToken) {
  console.log('  💀 DEATH SPIRAL — Extreme pressure test...');
  const agAddr = config.contracts.AgToken;
  const dexAddr = config.contracts.DexSimulator;
  const lpAddr = config.contracts.LpToken;

  for (let round = 0; round < 10; round++) {
    // ALL bots sell Ag aggressively
    for (let i = 1; i <= 50; i++) {
      const bot = await getSigner(provider, i);
      const agBal = await agToken.balanceOf(bot.address);
      if (agBal > ethers.parseEther('10')) {
        await agToken.connect(bot).approve(dexAddr, agBal);
        try { await dex.connect(bot).swapAforB(agBal, { gasLimit: 300000 }); } catch (_) {}
      }
    }

    // Remove liquidity aggressively
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const lpBal = await lpToken.balanceOf(bot.address);
      if (lpBal > ethers.parseEther('1')) {
        try { await lpToken.connect(bot).burn(lpBal, { gasLimit: 300000 }); } catch (_) {}
      }
    }

    // Unstake everything
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const staked = await staking.stakedBalance(bot.address);
      if (staked > ethers.parseEther('1')) {
        try { await staking.connect(bot).unstake(staked, { gasLimit: 200000 }); } catch (_) {}
      }
    }

    // PID tries to adjust
    const canEmit = await pid.canEmit();
    if (canEmit) {
      const keeper = await getSigner(provider, 99);
      try { await pid.connect(keeper).tick({ gasLimit: 200000 }); } catch (_) {}
    }

    const p = await getPrice(dex);
    const tvl = await staking.totalStaked();
    const [rA, rB] = await Promise.all([dex.getReserveA(), dex.getReserveB()]);
    console.log(`    Round ${round + 1}: Price=${ethers.formatEther(p)} | TVL=${ethers.formatEther(tvl)} | Reserves: ${ethers.formatEther(rA)} Ag / ${ethers.formatEther(rB)} Au`);
    await sleep(500);
  }
}

main().catch((err) => {
  console.error('❌ Stress test failed:', err.message);
  process.exit(1);
});
