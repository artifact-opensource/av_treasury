#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Stress Test Scenarios — Dual-Token Architecture (Au + Ag)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the full dual-token system under adversarial conditions:
 * - Au: governance token with 9bps transfer fee
 * - Ag: algorithmic stablecoin with elastic supply
 *
 * Scenarios:
 * - crash:     Mass sell Ag for Au (panic selling)
 * - squeeze:    Whale buys large amount of Ag (price impact)
 * - drain:     Repeated small drains on one-sided LP
 * - onesided:  20 small LPs add one-sided liquidity
 * - whale:     Large asymmetric trades (manipulation attempt)
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
  'function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB)',
  'function addOneSidedLiquidity(address token, uint256 amount)',
  'function getPrice(address tokenA, address tokenB) view returns (uint256)',
  'function getReserves() view returns (uint256, uint256)',
];

const AU_FEE_BPS = 9;
const FEE_DENOM = 100_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getSigner(provider, index) {
  return ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    `m/44'/60'/0'/0/${index}`
  ).connect(provider);
}

async function getDexPrice(provider, dex, auAddr, agAddr) {
  try {
    return await dex.getPrice(auAddr, agAddr);
  } catch {
    return 0n;
  }
}

function applyFee(amount) {
  const fee = (amount * BigInt(AU_FEE_BPS)) / BigInt(FEE_DENOM);
  return amount - fee;
}

async function main() {
  const scenario = process.argv[2] || 'crash';

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;

  const auToken = new ethers.Contract(auAddr, ERC20_ABI, provider);
  const agToken = new ethers.Contract(agAddr, ERC20_ABI, provider);
  const dex = new ethers.Contract(dexAddr, DEX_ABI, provider);

  const initialPrice = await getDexPrice(provider, dex, auAddr, agAddr);
  const initialAuSupply = await auToken.totalSupply();
  const initialAgSupply = await agToken.totalSupply();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🔥 STRESS TEST: ${scenario.toUpperCase()} — Dual-Token (Au + Ag)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Initial Price: ${ethers.formatEther(initialPrice)} Ag per Au`);
  console.log(`  Au Supply:     ${ethers.formatEther(initialAuSupply)}`);
  console.log(`  Ag Supply:     ${ethers.formatEther(initialAgSupply)}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  switch (scenario) {
    case 'crash':
      await runCrashScenario(provider, config, auToken, agToken, dex);
      break;
    case 'squeeze':
      await runSqueezeScenario(provider, config, auToken, agToken, dex);
      break;
    case 'drain':
      await runDrainScenario(provider, config, auToken, agToken, dex);
      break;
    case 'onesided':
      await runOneSidedScenario(provider, config, auToken, agToken, dex);
      break;
    case 'whale':
      await runWhaleScenario(provider, config, auToken, agToken, dex);
      break;
    default:
      console.error(`Unknown scenario: ${scenario}`);
      console.error('Available: crash, squeeze, drain, onesided, whale');
      process.exit(1);
  }

  // Final state
  const finalPrice = await getDexPrice(provider, dex, auAddr, agAddr);
  const finalAuSupply = await auToken.totalSupply();
  const finalAgSupply = await agToken.totalSupply();

  const priceChange = initialPrice > 0n
    ? ((finalPrice - initialPrice) * 10000n) / initialPrice
    : 0n;

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('  📊 RESULTS');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Price:   ${ethers.formatEther(initialPrice)} → ${ethers.formatEther(finalPrice)}`);
  console.log(`  Change:  ${Number(priceChange) / 100}%`);
  console.log(`  Au Sup:  ${ethers.formatEther(initialAuSupply)} → ${ethers.formatEther(finalAuSupply)}`);
  console.log(`  Ag Sup:  ${ethers.formatEther(initialAgSupply)} → ${ethers.formatEther(finalAgSupply)}`);
  console.log(`  Au Burn: ${ethers.formatEther(initialAuSupply - finalAuSupply)}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ── Scenario: Crash ─────────────────────────────────────────────
// 20 bots with dumper personality mass-sell Ag for Au
async function runCrashScenario(provider, config, auToken, agToken, dex) {
  console.log('  📉 Simulating bank run — mass sell Ag for Au...');
  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;

  for (let round = 0; round < 5; round++) {
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const tokenB = new ethers.Contract(agAddr, ERC20_ABI, bot);
      const dexC = new ethers.Contract(dexAddr, DEX_ABI, bot);
      const balB = await tokenB.balanceOf(bot.address);
      if (balB > ethers.parseEther('100')) {
        const sell = balB / 2n;
        await tokenB.approve(dexAddr, sell);
        try { await dexC.swapBforA(sell, { gasLimit: 500000 }); } catch (_) {}
      }
    }
    const p = await getDexPrice(provider, dex, auAddr, agAddr);
    console.log(`    Round ${round + 1}: ${ethers.formatEther(p)} Ag per Au`);
    await sleep(1000);
  }
}

// ── Scenario: Squeeze ────────────────────────────────────────────
// Whale buys 500K Ag worth of Au (drives up Au price)
async function runSqueezeScenario(provider, config, auToken, agToken, dex) {
  console.log('  📈 Simulating whale squeeze — large Ag→Au buy...');
  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;
  const whale = await getSigner(provider, 0);

  const tokenA = new ethers.Contract(agAddr, ERC20_ABI, whale);
  const dexC = new ethers.Contract(dexAddr, DEX_ABI, whale);

  // Mint whale a large amount of Ag
  await agToken.mint(whale.address, ethers.parseEther('500000'));

  const amount = ethers.parseEther('100000');
  await tokenA.approve(dexAddr, amount);

  const chunks = 5;
  const chunk = amount / BigInt(chunks);
  for (let i = 0; i < chunks; i++) {
    try { await dexC.swapAforB(chunk, { gasLimit: 500000 }); } catch (_) {}
    const p = await getDexPrice(provider, dex, auAddr, agAddr);
    console.log(`    Chunk ${i + 1}/${chunks}: ${ethers.formatEther(p)} Ag per Au`);
    await sleep(500);
  }
}

// ── Scenario: Drain ──────────────────────────────────────────────
// Repeatedly drain one-sided LP positions
async function runDrainScenario(provider, config, auToken, agToken, dex) {
  console.log('  🕳️  Simulating LP drain — repeated small withdrawals...');
  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;

  for (let round = 0; round < 10; round++) {
    for (let i = 1; i <= 10; i++) {
      const bot = await getSigner(provider, i);
      const tokenB = new ethers.Contract(auAddr, ERC20_ABI, bot);
      const dexC = new ethers.Contract(dexAddr, DEX_ABI, bot);
      const bal = await tokenB.balanceOf(bot.address);
      if (bal > ethers.parseEther('1000')) {
        const sell = bal / 10n;
        await tokenB.approve(dexAddr, sell);
        try { await dexC.swapBforA(sell, { gasLimit: 300000 }); } catch (_) {}
      }
    }
    const p = await getDexPrice(provider, dex, auAddr, agAddr);
    console.log(`    Round ${round + 1}: ${ethers.formatEther(p)} Ag per Au`);
    await sleep(500);
  }
}

// ── Scenario: One-Sided LP ───────────────────────────────────────
// 20 small LPs add one-sided Au liquidity
async function runOneSidedScenario(provider, config, auToken, agToken, dex) {
  console.log('  💧 Simulating one-sided LP additions...');
  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;

  for (let round = 0; round < 3; round++) {
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const tokenA = new ethers.Contract(auAddr, ERC20_ABI, bot);
      const dexC = new ethers.Contract(dexAddr, DEX_ABI, bot);
      const bal = await tokenA.balanceOf(bot.address);
      if (bal > ethers.parseEther('500')) {
        const amount = bal / 4n;
        await tokenA.approve(dexAddr, amount);
        try { await dexC.addOneSidedLiquidity(auAddr, amount, { gasLimit: 400000 }); } catch (_) {}
      }
    }
    const p = await getDexPrice(provider, dex, auAddr, agAddr);
    console.log(`    Round ${round + 1}: ${ethers.formatEther(p)} Ag per Au`);
    await sleep(1000);
  }
}

// ── Scenario: Whale ──────────────────────────────────────────────
// Large asymmetric trades to manipulate price
async function runWhaleScenario(provider, config, auToken, agToken, dex) {
  console.log('  🐋 Simulating whale manipulation — large asymmetric trades...');
  const auAddr = config.auToken;
  const agAddr = config.agToken;
  const dexAddr = config.dex;
  const whale = await getSigner(provider, 0);

  const tokenA = new ethers.Contract(agAddr, ERC20_ABI, whale);
  const tokenB = new ethers.Contract(auAddr, ERC20_ABI, whale);
  const dexC = new ethers.Contract(dexAddr, DEX_ABI, whale);

  // Mint whale 1M Ag
  await agToken.mint(whale.address, ethers.parseEther('1000000'));

  // Phase 1: Buy Au with Ag (drive Au price up)
  console.log('    Phase 1: Buying Au with Ag...');
  const buyAmount = ethers.parseEther('200000');
  await tokenA.approve(dexAddr, buyAmount);
  try { await dexC.swapAforB(buyAmount, { gasLimit: 500000 }); } catch (_) {}
  let p = await getDexPrice(provider, dex, auAddr, agAddr);
  console.log(`    Price after buy: ${ethers.formatEther(p)}`);

  await sleep(500);

  // Phase 2: Sell Au for Ag (drive Au price down)
  console.log('    Phase 2: Selling Au for Ag...');
  const auBal = await tokenB.balanceOf(whale.address);
  if (auBal > 0n) {
    const sellAmount = auBal / 2n;
    await tokenB.approve(dexAddr, sellAmount);
    try { await dexC.swapBforA(sellAmount, { gasLimit: 500000 }); } catch (_) {}
  }
  p = await getDexPrice(provider, dex, auAddr, agAddr);
  console.log(`    Price after sell: ${ethers.formatEther(p)}`);

  console.log('    ✅ Whale scenario complete');
}

main().catch((err) => {
  console.error('❌ Stress test failed:', err.message);
  process.exit(1);
});
