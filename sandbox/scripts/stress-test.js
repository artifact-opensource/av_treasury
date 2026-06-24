#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Stress Test Scenarios — Applies pressure variations to the sandbox
 * ═══════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

const DEX_ABI = [
  'function swapAforB(uint256 amountAIn) external returns (uint256)',
  'function swapBforA(uint256 amountBIn) external returns (uint256)',
  'function addOneSidedLiquidity(uint256 amountA, uint256 amountB) external returns (uint256)',
  'function removeLiquidity(uint256 liquidityOut) external',
];

async function loadAddresses() {
  const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function getSigner(provider, index = 0) {
  const mnemonic = 'test test test test test test test test test test test junk';
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
  return wallet.connect(provider);
}

async function getDexPrice(provider, dexAddress) {
  const slot2 = await provider.getStorageAt(dexAddress, 2);
  const bn = ethers.BigNumber.from(slot2);
  const mask = ethers.BigNumber.from('0x' + 'f'.repeat(28)); // 112 bits
  const reserveA = bn.and(mask);
  const reserveB = bn.shr(112).and(mask);
  if (reserveA.eq(0)) return ethers.BigNumber.from(0);
  return reserveB.mul(ethers.utils.parseEther('1')).div(reserveA);
}

async function getDexReserves(provider, dexAddress) {
  const slot2 = await provider.getStorageAt(dexAddress, 2);
  const bn = ethers.BigNumber.from(slot2);
  const mask = ethers.BigNumber.from('0x' + 'f'.repeat(28));
  const reserveA = bn.and(mask);
  const reserveB = bn.shr(112).and(mask);
  return [reserveA, reserveB];
}

async function runScenario(mode) {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const addresses = await loadAddresses();
  const signer = await getSigner(provider, 0);

  const dex = new ethers.Contract(addresses.dex, DEX_ABI, signer);
  const tokenA = new ethers.Contract(addresses.agUSD, ERC20_ABI, signer);
  const tokenB = new ethers.Contract(addresses.AVAX, ERC20_ABI, signer);

  console.log(`\n🔥 STRESS TEST: ${mode.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const initPrice = await getDexPrice(provider, addresses.dex);
  const [initRA, initRB] = await getDexReserves(provider, addresses.dex);
  console.log(`  Initial price: ${ethers.utils.formatEther(initPrice)}`);
  console.log(`  Initial reserves: ${ethers.utils.formatEther(initRA)} agUSD | ${ethers.utils.formatEther(initRB)} AVAX`);

  switch (mode) {
    case 'crash':
      await runCrashScenario(provider, addresses, dex, tokenA, tokenB);
      break;
    case 'squeeze':
      await runSqueezeScenario(provider, addresses, dex, tokenA, tokenB);
      break;
    case 'onesided':
      await runOneSidedScenario(provider, addresses, dex, tokenA, tokenB);
      break;
    case 'whale':
      await runWhaleScenario(provider, addresses, dex, tokenA, tokenB);
      break;
    default:
      console.log('  Unknown mode.');
  }

  const finalPrice = await getDexPrice(provider, addresses.dex);
  const [finalRA, finalRB] = await getDexReserves(provider, addresses.dex);
  const change = initPrice.gt(0) ? finalPrice.sub(initPrice).mul(10000).div(initPrice) : 0;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTS`);
  console.log(`  Price: ${ethers.utils.formatEther(initPrice)} → ${ethers.utils.formatEther(finalPrice)} (${change.toNumber() / 100}%)`);
  console.log(`  Reserves: ${ethers.utils.formatEther(finalRA)} agUSD | ${ethers.utils.formatEther(finalRB)} AVAX`);
  console.log('═══════════════════════════════════════════════════════════════');
}

async function runCrashScenario(provider, addresses, _dex, _tokenA, _tokenB) {
  console.log('  📉 Simulating flash crash — mass sell AVAX for agUSD...');
  const ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function swapBforA(uint256) returns (uint256)',
  ];
  for (let round = 0; round < 5; round++) {
    for (let i = 1; i <= 20; i++) {
      const bot = await getSigner(provider, i);
      const tokenB = new ethers.Contract(addresses.AVAX, ABI, bot);
      const dex = new ethers.Contract(addresses.dex, ABI, bot);
      const balB = await tokenB.balanceOf(bot.address);
      if (balB.gt(ethers.utils.parseEther('1'))) {
        const sell = balB.div(2);
        await tokenB.approve(addresses.dex, sell);
        try { await dex.swapBforA(sell, { gasLimit: 500000 }); } catch (_) {}
      }
    }
    const p = await getDexPrice(provider, addresses.dex);
    console.log(`    Round ${round + 1}: ${ethers.utils.formatEther(p)} agUSD/AVAX`);
  }
}

async function runSqueezeScenario(provider, addresses, _dex, _tokenA, _tokenB) {
  console.log('  📈 Simulating whale buyback — massive agUSD buys...');
  const whale = await getSigner(provider, 0);
  const whaleBal = await _tokenA.balanceOf(whale.address);
  const buyAmount = whaleBal.div(2);
  await _tokenA.connect(whale).approve(addresses.dex, buyAmount);
  const chunk = buyAmount.div(10);
  for (let i = 0; i < 10; i++) {
    try {
      await _dex.connect(whale).swapAforB(chunk);
    } catch (_) {}
    const p = await getDexPrice(provider, addresses.dex);
    console.log(`    Chunk ${i + 1}/10: ${ethers.utils.formatEther(p)}`);
  }
}

async function runOneSidedScenario(provider, addresses, _dex, _tokenA, _tokenB) {
  console.log('  📐 One-sided liquidity pressure — adding only AVAX...');
  for (let i = 1; i <= 30; i++) {
    const bot = await getSigner(provider, i);
    const balB = await _tokenB.balanceOf(bot.address);
    if (balB.gt(ethers.utils.parseEther('500'))) {
      const amount = balB.div(4);
      await _tokenB.connect(bot).approve(addresses.dex, amount);
      try { await _dex.connect(bot).addOneSidedLiquidity(0, amount); } catch (_) {}
    }
    if (i % 10 === 0) {
      const p = await getDexPrice(provider, addresses.dex);
      console.log(`    Bot ${i}: ${ethers.utils.formatEther(p)}`);
    }
  }
}

async function runWhaleScenario(provider, addresses, _dex, _tokenA, _tokenB) {
  console.log('  🐋 Whale manipulation — large asymmetric trades...');
  const whale = await getSigner(provider, 0);
  const tokenA = new ethers.Contract(addresses.agUSD, [
    'function mint(address to, uint256 amount) external',
    'function approve(address, uint256) returns (bool)',
  ], whale);
  const dex = new ethers.Contract(addresses.dex, [
    'function swapAforB(uint256) returns (uint256)',
  ], whale);
  const amount = ethers.utils.parseEther('100000');
  await tokenA.mint(whale.address, amount);
  await tokenA.approve(addresses.dex, amount);
  const chunks = 5;
  const chunk = amount.div(chunks);
  for (let i = 0; i < chunks; i++) {
    try { await dex.swapAforB(chunk, { gasLimit: 500000 }); } catch (_) {}
    const p = await getDexPrice(provider, addresses.dex);
    console.log(`    Chunk ${i + 1}/${chunks}: ${ethers.utils.formatEther(p)}`);
  }
}

const mode = process.argv[2] || 'crash';
runScenario(mode).catch(err => {
  console.error('💥 Stress test failed:', err.message);
  process.exit(1);
});
