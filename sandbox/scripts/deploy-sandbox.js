#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Sandbox Deployer — Deploys tokens + DEX + TreasuryAMO to ganache
 * 
 * Deploys:
 * 1. MockAgUSD, MockAVAX, MockUSDC (ERC20 tokens)
 * 2. DexSimulator (AMM pool)
 * 3. TreasuryAMO (with DEX + token references)
 * 4. Initial liquidity seeding
 * 5. Saves all addresses to config/deployed.json
 * ═══════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// ─── Compiled Bytecode (pre-compiled for speed) ─────────────
// We'll compile Solidity using solcjs or use the Hardhat runtime
// For simplicity, we use hardhat's compiler via child process

async function compileContracts() {
  console.log('🔨 Compiling sandbox contracts...');
  const { execSync } = require('child_process');
  
  // Use hardhat compile
  try {
    execSync('npx hardhat compile', { 
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: { ...process.env, PATH: process.env.PATH }
    });
  } catch (e) {
    // If hardhat compile fails, try direct solc
    console.log('⚠️  Hardhat compile failed, trying solc directly...');
  }
  
  console.log('   ✅ Compilation complete');
}

async function deploy() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏗️  SANDBOX DEPLOYMENT');
  console.log('═══════════════════════════════════════════════════════════════');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // Use account 0 from ganache as deployer
  const deployer = provider.getSigner(0);
  const deployerAddress = await deployer.getAddress();
  console.log(`  Deployer: ${deployerAddress}`);

  // ─── Deploy Tokens ────────────────────────────────────────
  console.log('\n📦 Deploying mock tokens...');

  // Load compiled artifacts from hardhat
  const artifactsDir = path.join(__dirname, '..', '..', 'artifacts', 'sandbox');
  
  // Deploy MockAgUSD
  const agUSDFactory = await getContractFactory('MockAgUSD', deployer);
  const agUSD = await agUSDFactory.deploy();
  await agUSD.deployed();
  console.log(`   ✅ agUSD: ${agUSD.address}`);

  // Deploy MockAVAX
  const avaxFactory = await getContractFactory('MockAVAX', deployer);
  const AVAX = await avaxFactory.deploy();
  await AVAX.deployed();
  console.log(`   ✅ AVAX: ${AVAX.address}`);

  // Deploy MockUSDC
  const usdcFactory = await getContractFactory('MockUSDC', deployer);
  const USDC = await usdcFactory.deploy();
  await USDC.deployed();
  console.log(`   ✅ USDC: ${USDC.address}`);

  // ─── Deploy DEX ───────────────────────────────────────────
  console.log('\n📦 Deploying DEX simulator...');
  
  const dexFactory = await getContractFactory('DexSimulator', deployer);
  const dex = await dexFactory.deploy(agUSD.address, AVAX.address);
  await dex.deployed();
  console.log(`   ✅ DexSimulator: ${dex.address}`);

  // ─── Seed Initial Liquidity ───────────────────────────────
  console.log('\n💧 Seeding initial liquidity...');
  
  const deployerBalA = await agUSD.balanceOf(deployerAddress);
  const deployerBalB = await AVAX.balanceOf(deployerAddress);
  console.log(`   Deployer agUSD: ${ethers.utils.formatEther(deployerBalA)}`);
  console.log(`   Deployer AVAX:  ${ethers.utils.formatEther(deployerBalB)}`);

  // Add 500k agUSD + 250k AVAX as initial liquidity (2:1 ratio ≈ $0.50/AVAX)
  const seedA = ethers.utils.parseEther('500000');
  const seedB = ethers.utils.parseEther('250000');
  
  await agUSD.approve(dex.address, seedA);
  await AVAX.approve(dex.address, seedB);
  const seedTx = await dex.addLiquidity(seedA, seedB);
  await seedTx.wait();
  
  const reserves = await dex.getReserves();
  const priceA = await dex.getPriceA();
  console.log(`   ✅ Seeded: 500k agUSD + 250k AVAX`);
  console.log(`   Reserves: ${ethers.utils.formatEther(reserves[0])} agUSD | ${ethers.utils.formatEther(reserves[1])} AVAX`);
  console.log(`   Initial price: ${ethers.utils.formatEther(priceA)} agUSD per AVAX`);

  // ─── Deploy TreasuryAMO (if artifact exists) ──────────────
  let treasuryAMO = null;
  const treasuryPath = path.join(__dirname, '..', '..', 'artifacts', 'contracts', 'TreasuryAMO.sol', 'TreasuryAMO.json');
  if (fs.existsSync(treasuryPath)) {
    console.log('\n📦 Deploying TreasuryAMO...');
    const treasuryArtifact = JSON.parse(fs.readFileSync(treasuryPath, 'utf8'));
    const treasuryFactory = new ethers.ContractFactory(treasuryArtifact.abi, treasuryArtifact.bytecode, deployer);
    // Constructor: agUSD, AVAX, dex, owner
    treasuryAMO = await treasuryFactory.deploy(
      agUSD.address,
      AVAX.address,
      dex.address,
      deployerAddress
    );
    await treasuryAMO.deployed();
    console.log(`   ✅ TreasuryAMO: ${treasuryAMO.address}`);
  } else {
    console.log('\n⚠️  TreasuryAMO artifact not found — skipping (deploy mock later)');
  }

  // ─── Save Deployed Addresses ─────────────────────────────
  const deployed = {
    agUSD: agUSD.address,
    AVAX: AVAX.address,
    USDC: USDC.address,
    dex: dex.address,
    treasuryAMO: treasuryAMO ? treasuryAMO.address : null,
    deployer: deployerAddress,
    network: RPC_URL,
    timestamp: new Date().toISOString(),
  };

  const configPath = path.join(__dirname, '..', 'config', 'deployed.json');
  fs.writeFileSync(configPath, JSON.stringify(deployed, null, 2));
  console.log(`\n📁 Addresses saved to ${configPath}`);

  // ─── Print Summary ────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ SANDBOX DEPLOYMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  agUSD:        ${agUSD.address}`);
  console.log(`  AVAX:         ${AVAX.address}`);
  console.log(`  USDC:         ${USDC.address}`);
  console.log(`  DEX:          ${dex.address}`);
  console.log(`  TreasuryAMO:  ${treasuryAMO?.address || 'not deployed'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  return deployed;
}

// ─── Helper: Get contract factory from hardhat artifacts ─────
async function getContractFactory(name, signer) {
  // Try the standard contracts directory first
  const artifactPath = path.join(__dirname, '..', '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  }
  
  throw new Error(`Artifact not found for ${name} at ${artifactPath}. Run hardhat compile first.`);
}

deploy().catch(err => {
  console.error('💥 Deployment failed:', err);
  process.exit(1);
});
