#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Deploy Sandbox — Full Dual-Token Architecture (Au + Ag)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deploys:
 * 1. MockTokens (deploys MockAuToken + MockAgToken internally)
 * 2. DexSimulator (AMM with one-sided LP support)
 * 3. Fund 100 bots with both Au + Ag
 * 4. Seed the DEX with liquidity
 *
 * Usage: node sandbox/scripts/deploy-sandbox.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const MNEMONIC = 'test test test test test test test test test test test junk';
const BOT_COUNT = 100;

// Load compiled artifacts from forge out/ directory
const OUT_DIR = path.join(__dirname, '..', '..', 'out');

function loadArtifact(name) {
  // Try direct: out/Name.sol/Name.json
  let p = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));

  // Try nested: out/MockTokens.sol/Name.json (multi-contract file)
  p = path.join(OUT_DIR, `MockTokens.sol`, `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));

  // Search all subdirs
  const dirs = fs.readdirSync(OUT_DIR);
  for (const d of dirs) {
    p = path.join(OUT_DIR, d, `${name}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error(`Artifact not found: ${name}`);
}

function getBotKey(index) {
  const wallet = ethers.Wallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    `m/44'/60'/0'/0/${index}`
  );
  return wallet.privateKey;
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(getBotKey(0), provider);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DUAL-TOKEN SANDBOX DEPLOY — Au + Ag');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  RPC:      ${RPC_URL}`);
  console.log(`  Bots:     ${BOT_COUNT}`);
  console.log('───────────────────────────────────────────────────────────────');

  // ── 1. Deploy MockTokens (deploys Au + Ag internally) ──────────
  console.log('\n📦 Deploying AuToken + AgToken...');

  const MockTokens = loadArtifact('MockTokens');
  const MockTokensFactory = new ethers.ContractFactory(
    MockTokens.abi, MockTokens.bytecode, deployer
  );
  const mockTokens = await MockTokensFactory.deploy(deployer.address);
  await mockTokens.waitForDeployment();

  const auAddr = await mockTokens.auToken();
  const agAddr = await mockTokens.agToken();
  console.log(`  AuToken:  ${auAddr}`);
  console.log(`  AgToken:  ${agAddr}`);

  const auToken = new ethers.Contract(auAddr, loadArtifact('MockAuToken').abi, provider);
  const agToken = new ethers.Contract(agAddr, loadArtifact('MockAgToken').abi, provider);

  // ── 2. Deploy DexSimulator ──────────────────────────────────────
  console.log('\n📦 Deploying DexSimulator...');

  const DexArtifact = loadArtifact('DexSimulator');
  const DexFactory = new ethers.ContractFactory(
    DexArtifact.abi, DexArtifact.bytecode, deployer
  );
  const dex = await DexFactory.deploy();
  await dex.waitForDeployment();
  const dexAddr = await dex.getAddress();
  console.log(`  DEX:      ${dexAddr}`);

  // ── 3. Mint initial Ag supply to deployer ───────────────────────
  console.log('\n🏦 Minting initial Ag supply...');
  const INITIAL_AG_SUPPLY = ethers.utils.parseEther('10000000'); // 10M Ag
  await agToken.mint(deployer.address, INITIAL_AG_SUPPLY);
  console.log(`  Minted ${ethers.utils.formatEther(INITIAL_AG_SUPPLY)} Ag to deployer`);

  // ── 4. Fund bots with Au + Ag ───────────────────────────────────
  console.log(`\n🤖 Funding ${BOT_COUNT} bots with Au + Ag...`);

  const AU_PER_BOT = ethers.utils.parseEther('10000');   // 10,000 Au
  const AG_PER_BOT = ethers.utils.parseEther('50000');   // 50,000 Ag

  for (let i = 1; i <= BOT_COUNT; i++) {
    const bot = new ethers.Wallet(getBotKey(i), provider);

    // Transfer Au from deployer to bot
    await auToken.transfer(bot.address, AU_PER_BOT);

    // Mint Ag to bot (simulating PID emission)
    await agToken.mint(bot.address, AG_PER_BOT);

    if (i % 20 === 0) {
      console.log(`  Funded bots 1-${i}`);
    }
  }
  console.log(`  ✅ All ${BOT_COUNT} bots funded`);

  // ── 5. Seed DEX with liquidity ─────────────────────────────────
  console.log('\n💧 Seeding DEX with liquidity...');

  const LIQUIDITY_AU = ethers.utils.parseEther('500000');   // 500K Au
  const LIQUIDITY_AG = ethers.utils.parseEther('2500000');  // 2.5M Ag (initial price: 5 Ag per Au)

  // Approve tokens for DEX
  await auToken.connect(deployer).approve(dexAddr, LIQUIDITY_AU);
  await agToken.connect(deployer).approve(dexAddr, LIQUIDITY_AG);

  // Add two-sided liquidity
  await dex.connect(deployer).addLiquidity(auAddr, agAddr, LIQUIDITY_AU, LIQUIDITY_AG);
  console.log(`  Added ${ethers.utils.formatEther(LIQUIDITY_AU)} Au + ${ethers.utils.formatEther(LIQUIDITY_AG)} liquidity`);

  // ── 6. Verify state ─────────────────────────────────────────────
  console.log('\n📊 Verifying deployment...');

  const auBal = await auToken.balanceOf(deployer.address);
  const agBal = await agToken.balanceOf(deployer.address);
  const auSupply = await auToken.totalSupply();
  const agSupply = await agToken.totalSupply();

  const price = await dex.getPrice(auAddr, agAddr);

  console.log(`  Deployer Au:  ${ethers.utils.formatEther(auBal)}`);
  console.log(`  Deployer Ag:  ${ethers.utils.formatEther(agBal)}`);
  console.log(`  Total Au:     ${ethers.utils.formatEther(auSupply)}`);
  console.log(`  Total Ag:     ${ethers.utils.formatEther(agSupply)}`);
  console.log(`  Price (Au/Ag): ${ethers.utils.formatEther(price)} Ag per Au`);

  // ── 7. Save config ──────────────────────────────────────────────
  const configDir = path.join(__dirname, '..', 'config');
  const deployed = {
    auToken: auAddr,
    agToken: agAddr,
    dex: dexAddr,
    deployer: deployer.address,
    network: 'anvil',
    chainId: 1337,
    initialPrice: ethers.utils.formatEther(price),
    botCount: BOT_COUNT,
    auPerBot: ethers.utils.formatEther(AU_PER_BOT),
    agPerBot: ethers.utils.formatEther(AG_PER_BOT),
    liquidityAu: ethers.utils.formatEther(LIQUIDITY_AU),
    liquidityAg: ethers.utils.formatEther(LIQUIDITY_AG),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(configDir, 'deployed.json'),
    JSON.stringify(deployed, null, 2)
  );

  // Save bot accounts
  const accounts = [];
  for (let i = 0; i <= BOT_COUNT; i++) {
    const wallet = ethers.Wallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(MNEMONIC),
      `m/44'/60'/0'/0/${i}`
    );
    accounts.push({
      index: i,
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
  }
  fs.writeFileSync(
    path.join(configDir, 'accounts.json'),
    JSON.stringify(accounts, null, 2)
  );

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ DUAL-TOKEN SANDBOX DEPLOYED');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Au:  ${auAddr}`);
  console.log(`  Ag:  ${agAddr}`);
  console.log(`  DEX: ${dexAddr}`);
  console.log(`  Config: sandbox/config/deployed.json`);
  console.log('───────────────────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err.message);
  process.exit(1);
});
