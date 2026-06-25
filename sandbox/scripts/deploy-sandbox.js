#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Deploy Sandbox — Full Dual-Token DAO Deployment
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deploys the complete system:
 *   MockAuToken + MockAgToken → DexSimulator → SandboxLPToken
 *   → MockStaking → MockPIDController → MockTreasuryAMO → MockGovernor
 *
 * Then funds 100 bot accounts and starts the simulation.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const MNEMONIC = 'test test test test test test test test test test test junk';
const NUM_BOTS = 100;
const BOT_FUNDING = ethers.utils.parseEther('1000');
const DEPLOYER_FUNDING = ethers.utils.parseEther('10000');

// Contract artifacts (compiled with forge build)
const ARTIFACTS_DIR = path.join(__dirname, '..', '..', 'out');

async function getSigner(provider, index) {
  return ethers.Wallet.fromMnemonic(MNEMONIC, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function deployContract(name, deployer, ...args) {
  // Try multiple artifact path patterns since forge uses <filename>.sol/<contractName>.json
  const patterns = [
    path.join(ARTIFACTS_DIR, `${name}.sol`, `${name}.json`),
    path.join(ARTIFACTS_DIR, 'MockTokens.sol', `${name}.json`),
    path.join(ARTIFACTS_DIR, 'MockStaking.sol', `${name}.json`),
    path.join(ARTIFACTS_DIR, 'sandbox', 'contracts_temp', `${name}.sol`, `${name}.json`),
    path.join(ARTIFACTS_DIR, 'sandbox', 'contracts_temp', 'MockTokens.sol', `${name}.json`),
    path.join(ARTIFACTS_DIR, 'sandbox', 'contracts_temp', 'MockStaking.sol', `${name}.json`),
  ];
  let artifactPath = null;
  for (const p of patterns) {
    if (fs.existsSync(p)) { artifactPath = p; break; }
  }
  if (!artifactPath) {
    // Fallback: search all subdirectories
    const files = fs.readdirSync(ARTIFACTS_DIR).filter(d => fs.statSync(path.join(ARTIFACTS_DIR, d)).isDirectory());
    for (const dir of files) {
      const candidate = path.join(ARTIFACTS_DIR, dir, `${name}.json`);
      if (fs.existsSync(candidate)) { artifactPath = candidate; break; }
    }
  }
  if (!artifactPath) {
    throw new Error(`Artifact not found for ${name}. Searched: ${patterns.join(', ')}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  // Bytecode may be a string or an object with an 'object' key
  const bytecode = typeof artifact.bytecode === 'string' ? artifact.bytecode : artifact.bytecode.object;
  const factory = new ethers.ContractFactory(artifact.abi, bytecode, deployer);
  // Use legacy transaction type (anvil doesn't support EIP-1559)
  const overrides = { gasLimit: 8_000_000, type: 0 };
  const contract = await factory.deploy(...args, overrides);
  await contract.deployed();
  console.log(`  ✅ ${name} deployed at ${contract.address}`);
  return contract;
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
  const deployer = await getSigner(provider, 0);

  // Wait for network
  try {
    await provider.getBlockNumber();
  } catch (e) {
    console.error('❌ Cannot connect to Anvil at http://127.0.0.1:8545');
    console.error('   Run: bash sandbox/scripts/start-ganache.sh');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Deploying Full Dual-Token DAO System');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // ─── Step 1: Tokens ───
  console.log('📝 Step 1: Deploying Tokens...');
  // MockAuToken constructor requires _treasury address
  const auToken = await deployContract('MockAuToken', deployer, deployer.address);
  const agToken = await deployContract('MockAgToken', deployer);

  // ─── Step 2: DEX ───
  console.log('\n📝 Step 2: Deploying DEX...');
  const dex = await deployContract('DexSimulator', deployer, agToken.address, auToken.address);

  // ─── Step 3: LP Token Wrapper ───
  console.log('\n📝 Step 3: Deploying LP Token...');
  const lpToken = await deployContract('SandboxLPToken', deployer, dex.address, agToken.address, auToken.address);

  // ─── Step 4: Staking ───
  console.log('\n📝 Step 4: Deploying Staking...');
  const rewardRateAu = ethers.utils.parseEther('0.001');  // 0.1% per block
  const rewardRateAg = ethers.utils.parseEther('0.002');  // 0.2% per block
  const staking = await deployContract('MockStaking', deployer, lpToken.address, auToken.address, agToken.address, rewardRateAu, rewardRateAg);

  // ─── Step 5: PID Controller ───
  console.log('\n📝 Step 5: Deploying PID Controller...');
  const kp = ethers.utils.parseEther('0.001');   // 0.1% proportional gain
  const ki = ethers.utils.parseEther('0.0001');  // 0.01% integral gain
  const kd = ethers.utils.parseEther('0.01');    // 1% derivative gain
  const targetTvl = ethers.utils.parseEther('1500'); // 1500 TVL target (actual LP TVL ~1.3e21, target slightly above to allow modest emissions)
  const maxDailyEmission = ethers.utils.parseEther('1000');   // 1000 Ag/day max
  const maxSingleEmission = ethers.utils.parseEther('100');    // 100 Ag/tick max
  const pid = await deployContract(
    'MockPIDController',
    deployer,
    agToken.address,
    staking.address,      // TVL source = staking
    kp, ki, kd,
    targetTvl,
    maxDailyEmission,
    maxSingleEmission,
    10,                   // 10 block cooldown
    500                   // 5% deadband
  );

  // Grant PID minter role on AgToken
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
  await agToken.connect(deployer).grantRole(MINTER_ROLE, pid.address);
  console.log('  🔑 Granted MINTER_ROLE to PID Controller');

  // ─── Step 6: TreasuryAMO ───
  console.log('\n📝 Step 6: Deploying TreasuryAMO...');
  const cooldown = 50;           // 50 block cooldown
  const maxSlippageBps = 50;     // 0.5%
  const maxBuybackPerEpochBps = 500; // 5%
  const runway = ethers.utils.parseEther('10000');
  const treasuryAMO = await deployContract(
    'MockTreasuryAMO',
    deployer,
    agToken.address,
    auToken.address,
    dex.address,
    cooldown,
    maxSlippageBps,
    maxBuybackPerEpochBps,
    runway
  );

  // ─── Step 7: Governor ───
  console.log('\n📝 Step 7: Deploying Governor...');
  const governor = await deployContract(
    'MockGovernor',
    deployer,
    100,    // 100 block voting period
    50,     // 50 block timelock
    ethers.utils.parseEther('1000'), // proposal threshold
    400     // 4% quorum
  );

  // ─── Step 8: Fund system ───
  console.log('\n📝 Step 8: Funding System...');

  // Fund TreasuryAMO with Ag for buybacks
  const buybackFunding = ethers.utils.parseEther('500000');
  await agToken.connect(deployer).mint(treasuryAMO.address, buybackFunding);
  console.log(`  💰 TreasuryAMO funded with ${ethers.utils.formatEther(buybackFunding)} Ag`);

  // Fund staking with Au for rewards
  const stakingFunding = ethers.utils.parseEther('100000');
  await auToken.connect(deployer).mint(staking.address, stakingFunding);
  console.log(`  💰 Staking funded with ${ethers.utils.formatEther(stakingFunding)} Au`);

  // ─── Step 9: Seed DEX with initial liquidity ───
  // Direct mint to DEX bypasses the AuToken transfer fee
  console.log('\n📝 Step 9: Seeding DEX with Initial Liquidity...');
  const initAg = ethers.utils.parseEther('500000');  // 500K Ag
  const initAu = ethers.utils.parseEther('100000');  // 100K Au (5:1 ratio)
  // Add proper liquidity via DEX.addLiquidity (mints LP tokens + initializes reserves)
  const liqAg = ethers.utils.parseEther('500000');  // 500K Ag
  const liqAu = ethers.utils.parseEther('100000');  // 100K Au (5:1 ratio ≈ 0.2 Au/Ag)
  // Grant deployer MINTER_ROLE so it can mint Ag for liquidity
  await agToken.connect(deployer).grantRole(MINTER_ROLE, deployer.address);
  // Mint deployer the tokens needed for liquidity provision
  await agToken.connect(deployer).mint(deployer.address, liqAg);
  await auToken.connect(deployer).mint(deployer.address, liqAu);
  await agToken.connect(deployer).approve(dex.address, liqAg);
  await auToken.connect(deployer).approve(dex.address, liqAu);
  const lpMinted = await dex.connect(deployer).addLiquidity(liqAg, liqAu);
  console.log(`  ✅ DEX seeded: ${ethers.utils.formatEther(liqAg)} Ag + ${ethers.utils.formatEther(liqAu)} Au (proper liquidity added)`);

  // ─── Step 10: Fund bots ───
  console.log('\n📝 Step 10: Funding 100 Bot Accounts...');
  const accounts = [];
  for (let i = 1; i <= NUM_BOTS; i++) {
    const bot = await getSigner(provider, i);

    // Fund with Ag for trading
    await agToken.connect(deployer).mint(bot.address, BOT_FUNDING);

    // Give some Au to some bots (every 3rd bot)
    if (i % 3 === 0) {
      await auToken.connect(deployer).mint(bot.address, ethers.utils.parseEther('500'));
    }

    accounts.push({
      index: i,
      address: bot.address,
      privateKey: bot.privateKey,
    });

    if (i % 25 === 0) {
      console.log(`  👤 Funded bots ${i - 24}..${i}`);
    }
  }

  // ─── Step 10b: Fund bots with ETH for gas ───
  console.log('\n⛽ Step 10b: Funding bots with ETH for gas...');
  for (let i = 1; i <= NUM_BOTS; i++) {
    const bot = ethers.Wallet.fromMnemonic(MNEMONIC, `m/44'/60'/0'/0/${i}`).connect(provider);
    const tx = await deployer.sendTransaction({
      to: bot.address,
      value: ethers.utils.parseEther('10'),  // 10 ETH per bot
      gasLimit: 21000,
    });
    await tx.wait();
    if (i % 25 === 0) {
      console.log(`  ⛽ Funded bots ${i - 24}..${i} with ETH`);
    }
  }

  // ─── Step 11: Deploy Flash Loan + TreasuryFlashBuy ───
  console.log('\n📝 Step 11: Deploying Flash Loan Infrastructure...');

  const flashLoan = await deployContract(
    'FlashLoan',
    deployer,
    dex.address,
    treasuryAMO.address,  // TreasuryAMO acts as Treasury
    agToken.address,
    auToken.address
  );
  console.log(`  � FlashLoan deployed at ${flashLoan.address}`);

  const flashBuy = await deployContract(
    'TreasuryFlashBuy',
    deployer,
    dex.address,
    treasuryAMO.address,
    agToken.address,
    auToken.address
  );
  console.log(`  � TreasuryFlashBuy deployed at ${flashBuy.address}`);

  // Fund TreasuryFlashBuy with Ag for buybacks
  const flashBuyFunding = ethers.utils.parseEther('50000'); // 50,000 Ag
  await agToken.connect(deployer).mint(flashBuy.address, flashBuyFunding);
  console.log(`  💰 TreasuryFlashBuy funded with ${ethers.utils.formatEther(flashBuyFunding)} Ag`);

  // Fund FlashLoan with initial liquidity from deployer's Ag
  const flashLoanFunding = ethers.utils.parseEther('50000'); // 50,000 Ag
  await agToken.connect(deployer).mint(flashLoan.address, flashLoanFunding);
  console.log(`  💰 FlashLoan funded with ${ethers.utils.formatEther(flashLoanFunding)} Ag`);

  // Fund FlashLoan with some Au too (for双向 flash loans)
  const flashLoanAuFunding = ethers.utils.parseEther('10000'); // 10,000 Au
  await auToken.connect(deployer).mint(flashLoan.address, flashLoanAuFunding);
  console.log(`  💰 FlashLoan funded with ${ethers.utils.formatEther(flashLoanAuFunding)} Au`);

  // ─── Step 12: Save deployment ───
  console.log('\n📝 Step 11: Saving Deployment...');
  const deployed = {
    network: 'anvil',
    chainId: 1337,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AuToken: auToken.address,
      AgToken: agToken.address,
      DexSimulator: dex.address,
      LpToken: lpToken.address,
      Staking: staking.address,
      PIDController: pid.address,
      TreasuryAMO: treasuryAMO.address,
      Governor: governor.address,
      FlashLoan: flashLoan.address,
      TreasuryFlashBuy: flashBuy.address,
    },
    initialLiquidity: {
      ag: '0',
      au: '0',
    },
    botFunding: BOT_FUNDING.toString(),
    numBots: NUM_BOTS,
  };

  const configDir = path.join(__dirname, '..', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'deployed.json'),
    JSON.stringify(deployed, null, 2)
  );

  // Save bot accounts
  fs.writeFileSync(
    path.join(configDir, 'accounts.json'),
    JSON.stringify(accounts, null, 2)
  );

  // ─── Summary ───
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Full DAO Deployed Successfully');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log('  Contracts:');
  for (const [name, addr] of Object.entries(deployed.contracts)) {
    console.log(`    ${name.padEnd(16)} ${addr}`);
  }
  console.log();
  console.log('  Bots: 100 accounts × 1000 Ag each');
  console.log('  Initial LP: 50,000 Ag + 50,000 Au');
  console.log('  TreasuryAMO: 500,000 Ag for buybacks');
  console.log('  Staking: 100,000 Au for rewards');
  console.log();
  console.log('  Config saved to: sandbox/config/deployed.json');
  console.log('  Accounts saved:  sandbox/config/accounts.json');
  console.log();
  console.log('  Next: node sandbox/bots/BotEngine.js');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('❌ Deployment failed:', e.message);
  process.exit(1);
});
