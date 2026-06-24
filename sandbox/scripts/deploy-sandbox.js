#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Deploy Sandbox — Full Dual-Token System
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deploys the complete AV Treasury sandbox:
 *   1. AuToken (Utility, 1B supply, 9bps fee)
 *   2. AgToken (Governance, 100M supply, no fees)
 *   3. DexSimulator (Ag/Au pool with one-sided LP)
 *   4. Initial liquidity + 100 bot accounts
 *
 * Token model:
 *   Au = Utility token (fuel of the ecosystem, deflationary)
 *   Ag = Governance token (voting, staking multiplier)
 *
 * Initial price: 0.1 Au per Ag
 * Initial liquidity: 10M Ag + 1M Au
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const DEPLOYER_MNEMONIC = 'test test test test test test test test test test test junk';
const NUM_BOTS = 100;
const BOT_ETH_AMOUNT = ethers.utils.parseEther('1000');

async function deploy() {
  const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
  const deployer = ethers.Wallet.fromMnemonic(DEPLOYER_MNEMONIC, "m/44'/60'/0'/0/0").connect(provider);

  try {
    await provider.getBlockNumber();
  } catch (e) {
    console.error('❌ Cannot connect to Anvil at http://127.0.0.1:8545');
    console.error('   Run: bash sandbox/scripts/start-ganache.sh');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Deploying AV Treasury Sandbox — Dual-Token System');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Deployer: ${deployer.address}`);
  console.log('');

  // ── Load compiled contracts ─────────────────────────────────────
  const artifactsDir = path.join(__dirname, '..', 'contracts');
  
  // Read contract artifacts (compiled with forge)
  function loadArtifact(name) {
    // Try multiple possible locations
    const paths = [
      path.join(artifactsDir, `${name}.sol`, `${name}.json`),
      path.join(process.cwd(), 'out', `${name}.sol`, `${name}.json`),
      path.join(process.cwd(), 'artifacts', `${name}.sol`, `${name}.json`),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    return null;
  }

  // ── Step 1: Deploy AuToken ──────────────────────────────────────
  console.log('  [1/4] Deploying AuToken (Utility, 1B supply, 9bps fee)...');
  
  // Inline contract creation using source-compiled ABI
  const auArtifact = loadArtifact('AuToken') || loadArtifact('MockTokens');
  
  // We'll deploy using forge-style compilation
  // For now, use inline bytecode approach with compiled ABI
  const AuTokenArtifact = requireContract('AuToken');
  const auToken = await deployContract(deployer, AuTokenArtifact, [deployer.address]);
  console.log(`         Au: ${auToken.address}`);

  // ── Step 2: Deploy AgToken ──────────────────────────────────────
  console.log('  [2/4] Deploying AgToken (Governance, 100M supply, no fees)...');
  const AgTokenArtifact = requireContract('AgToken');
  const agToken = await deployContract(deployer, AgTokenArtifact, [deployer.address]);
  console.log(`         Ag: ${agToken.address}`);

  // ── Step 3: Deploy DexSimulator ─────────────────────────────────
  console.log('  [3/4] Deploying DexSimulator (Ag/Au pool)...');
  const DexArtifact = loadArtifact('DexSimulator') || requireContract('DexSimulator');
  const dex = await deployContract(deployer, DexArtifact, [agToken.address, auToken.address]);
  console.log(`         DEX: ${dex.address}`);

  // ── Step 4: Add initial liquidity + fund bots ───────────────────
  console.log('  [4/4] Adding initial liquidity + funding bots...');

  const initialAgLiquidity = ethers.utils.parseEther('10000000'); // 10M Ag
  const initialAuLiquidity = ethers.utils.parseEther('1000000');  // 1M Au
  // Price: 0.1 Au per Ag

  await agToken.approve(dex.address, initialAgLiquidity);
  await auToken.approve(dex.address, initialAuLiquidity);
  await dex.addLiquidity(initialAgLiquidity, initialAuLiquidity);
  console.log(`         Added ${ethers.utils.formatEther(initialAgLiquidity)} Ag + ${ethers.utils.formatEther(initialAuLiquidity)} Au`);

  // Fund bots
  const botAccounts = [];
  for (let i = 1; i <= NUM_BOTS; i++) {
    const bot = ethers.Wallet.fromMnemonic(DEPLOYER_MNEMONIC, `m/44'/60'/0'/0/${i}`).connect(provider);

    await deployer.sendTransaction({ to: bot.address, value: BOT_ETH_AMOUNT });

    const agAmount = ethers.utils.parseEther((1000 + Math.random() * 9000).toFixed(0));
    await agToken.transfer(bot.address, agAmount);

    const auAmount = ethers.utils.parseEther((10000 + Math.random() * 90000).toFixed(0));
    await auToken.transfer(bot.address, auAmount);

    botAccounts.push({
      index: i,
      address: bot.address,
      privateKey: bot.privateKey,
      agBalance: agAmount.toString(),
      auBalance: auAmount.toString(),
    });
  }
  console.log(`         Funded ${NUM_BOTS} bots with ETH + Ag + Au`);

  // ── Save deployment state ───────────────────────────────────────
  const deployed = {
    network: 'anvil',
    chainId: 1337,
    deployer: deployer.address,
    contracts: {
      AuToken: auToken.address,
      AgToken: agToken.address,
      DexSimulator: dex.address,
    },
    liquidity: {
      initialAg: initialAgLiquidity.toString(),
      initialAu: initialAuLiquidity.toString(),
      initialPrice: '0.1 Au/Ag',
    },
    bots: botAccounts,
    timestamp: new Date().toISOString(),
  };

  const configDir = path.join(__dirname, '..', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'deployed.json'),
    JSON.stringify(deployed, null, 2)
  );

  // ── Print summary ───────────────────────────────────────────────
  const priceA = await dex.getPriceA();
  const [reserveA, reserveB] = await dex.getReserves();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Deployment Complete');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  AuToken:      ${auToken.address}`);
  console.log(`  AgToken:      ${agToken.address}`);
  console.log(`  DexSimulator: ${dex.address}`);
  console.log('');
  console.log(`  Reserves: ${ethers.utils.formatEther(reserveA)} Ag | ${ethers.utils.formatEther(reserveB)} Au`);
  console.log(`  Price: ${ethers.utils.formatEther(priceA)} Au per Ag`);
  console.log(`  Bots: ${NUM_BOTS} funded`);
  console.log('');
  console.log('  Config saved to: sandbox/config/deployed.json');
  console.log('═══════════════════════════════════════════════════════════════');

  return deployed;
}

function requireContract(name) {
  // Try foundry output (compiled from contracts/sandbox/)
  const foundryPath = path.join(process.cwd(), 'out', `${name}.sol`, `${name}.json`);
  if (fs.existsSync(foundryPath)) {
    return JSON.parse(fs.readFileSync(foundryPath, 'utf8'));
  }
  // Try sandbox contracts dir
  const sandboxPath = path.join(__dirname, '..', 'contracts', `${name}.sol`, `${name}.json`);
  if (fs.existsSync(sandboxPath)) {
    return JSON.parse(fs.readFileSync(sandboxPath, 'utf8'));
  }
  throw new Error(`Cannot find artifact for ${name}`);
}

async function deployContract(signer, artifact, constructorArgs = []) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...constructorArgs);
  await contract.deployed();
  return contract;
}

deploy().catch(e => {
  console.error('❌ Deployment failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
