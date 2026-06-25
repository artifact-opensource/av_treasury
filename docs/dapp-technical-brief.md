# AV Treasury DApp — Technical Brief

> **Generated:** 2026-06-25  
> **Purpose:** Comprehensive reference for building a best-in-class DApp for the AV Treasury ecosystem on Base (Aerodrome)  
> **Chain:** Base (Chain ID: 8453)  
> **DEX:** Aerodrome Finance (Primary)

---

## Table of Contents

1. [AV Treasury Contracts](#1-av-treasury-contracts)
2. [Aerodrome Integration](#2-aerodrome-integration)
3. [Coinbase SDK / OnchainKit](#3-coinbase-sdk--onchainkit)
4. [Swap Aggregation APIs](#4-swap-aggregation-apis)
5. [Base App Hosting](#5-base-app-hosting)
6. [ReasonATP](#6-reasonatp)
7. [Price Detection & Oracles](#7-price-detection--oracles)
8. [Integration Architecture](#8-integration-architecture)

---

## 1. AV Treasury Contracts

### Deployed Addresses (Base Mainnet)

| Contract | Address | Source |
|----------|---------|--------|
| AuToken (v2) | `0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f` | AuToken.sol (NatSpec) |
| AVLPStaking_v2 | `0x3e26b061eC20392b32dE712132c41bbE43f52566` | AVLPStaking_v2.sol (NatSpec) |
| ArtifactTimelock (v2) | `0xB51542d460DBb4336F011CFF3Cbf80faeB3453f7` | ArtifactTimelock.sol (NatSpec) |

### Sandbox/Local Deployment Addresses (Anvil chainId 1337)

```json
{
  "network": "anvil",
  "chainId": 1337,
  "AuToken": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "AgToken": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "DexSimulator": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "LpToken": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "Staking": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  "PIDController": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  "TreasuryAMO": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  "Governor": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
  "FlashLoan": "0x871ACbEabBaf8Bed65c22ba7132beCFaBf8c27B5",
  "TreasuryFlashBuy": "0x6A59CC73e334b018C9922793d96Df84B538E6fD5"
}
```

### 1.1 AuToken (Artifact Utility) — ERC20 + Fees + Flash Mint

**Key Function Signatures:**
```solidity
// ERC20 Standard
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
function transfer(address to, uint256 amount) external returns (bool);
function approve(address spender, uint256 amount) external returns (bool);
function allowance(address owner, address spender) external view returns (uint256);
function transferFrom(address from, address to, uint256 amount) external returns (bool);

// Permit (gasless approvals)
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
function nonces(address owner) external view returns (uint256);

// Flash Mint
function maxFlashLoan(address token) external view returns (uint256);
function flashLoan(address receiver, address token, uint256 amount, bytes calldata data) external returns (bool);
function flashFee(address token, uint256 amount) external view returns (uint256);

// Fee Management (ANTI_BOT_ROLE)
function setTransferFeeBps(uint256 _feeBps) external;
function setMaxTxAmount(uint256 _maxTxAmountBps) external;
function setMaxWalletAmount(uint256 _maxWalletAmountBps) external;
function setSellCooldown(uint256 _cooldown) external;
function setFeesEnabled(bool enabled) external;
function withdrawFees() external;

// Blocklist (ANTI_BOT_ROLE)
function setBlocked(address _account, bool _blocked) external;

// Minting (MINTER_ROLE)
function mint(address to, uint256 amount) external;

// Upgrade (UUPS, 7-day timelock)
function announceUpgrade(address newImplementation) external;
function cancelUpgrade() external;

// View
function getAgMultiplier(address staker) external view returns (uint256);
function accumulatedFees() external view returns (uint256);
function treasury() external view returns (address);
```

**Constants:**
- MAX_SUPPLY: 1,000,000,000 * 1e18 (fixed)
- INITIAL_FEE_BPS: 9 (0.09%)
- MAX_FEE_BPS: 500 (5%)
- FEE_BURN_PORTION: 5000 (50% of fee burned, 50% to treasury)
- MAX_FLASH_LOAN_CAP: 1,000,000 * 1e18
- UPGRADE_DELAY: 7 days

---

### 1.2 AgToken (Artifact Governance) — ERC20 + Votes + Permit

**Key Function Signatures:**
```solidity
// ERC20 + Votes (ERC20VotesUpgradeable)
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
function transfer(address to, uint256 amount) external returns (bool);
function approve(address spender, uint256 amount) external returns (bool);
function delegate(address delegatee) public;
function getVotes(address account) external view returns (uint256);
function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);

// Mint (MINTER_ROLE only)
function mint(address to, uint256 amount) external;

// Burn (BURNER_ROLE only)
function burn(address from, uint256 amount) external;

// Permit
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

// Pause
function pause() external;
function unpause() external;

// Upgrade (UUPS, 7-day timelock)
function announceUpgrade(address newImplementation) external;
```

**Constants:**
- MAX_SUPPLY: 100,000,000 * 1e18
- UPGRADE_DELAY: 7 days

---

### 1.3 TreasuryAMO (Automated Market Operations)

**Key Function Signatures:**
```solidity
// Core Buyback
function executeBuyback(
    uint256 reserveAmount,
    uint256 minAuOut,
    bool useAerodrome,
    uint256 deadline
) external onlyExecutor nonReentrant whenNotPaused;

// TWAP Management
function updateTWAPPrice(uint256 newPrice) external;
function getExpectedOutput(uint256 reserveAmount, bool useAerodrome) external view returns (uint256);

// Parameter Management (PARAM_ROLE)
function setCooldown(uint256 newCooldown) external;
function setMaxSlippage(uint256 newMaxSlippageBps) external;
function setMaxPriceDeviation(uint256 newMaxDeviationBps) external;
function setMinRunwayReserve(uint256 newMinRunwayReserve) external;
function setMaxBuybackPerEpoch(uint256 newMaxBuybackBps) external;
function setAerodromeRouter(address newRouter) external;
function setUniswapRouter(address newRouter) external;

// Emergency
function pause() external;
function unpause() external;
function emergencyWithdraw(address token, uint256 amount) external;

// View
function getReserveBalance() external view returns (uint256);
function getAuBalance() external view returns (uint256);
function timeUntilNextOperation() external view returns (uint256);

// State
function auToken() external view returns (IERC20);
function reserveToken() external view returns (IERC20);
function aerodromeRouter() external view returns (IAerodromeRouter);
function twapPrice() external view returns (uint256);
```

**Constants:**
- AMO_RESERVE_RUNWAY_MONTHS: 12
- AMO_BUYBACK_PCT: 12
- MIN_BUYBACK_USD: 500
- Default cooldown: 24 hours
- Default maxSlippageBps: 50 (0.5%)
- Default maxPriceDeviationBps: 500 (5%)
- Default maxBuybackPerEpochBps: 500 (5%)

---

### 1.4 PID_Emission_Controller_v2

**Key Function Signatures:**
```solidity
// Core Emission
function executeEmission() external onlyRole(EMIT_ROLE) returns (uint256 emissionAmount);

// Parameter Management (PARAM_ROLE, 2-step with 24h timelock)
function scheduleGainsChange(uint256 kp, uint256 ki, uint256 kd) external;
function executeGainsChange() external;
function setTargetTVL(uint256 newTargetTVL) external;

// Admin Transfer (2-step)
function requestAdminChange(address newAdmin) external;
function acceptAdmin() external;

// Emergency
function toggleEmergencyStop() external;

// View
function getDynamicDailyCap() external view returns (uint256);
function getEmissionInfo() external view returns (...);

// State
function staking() external view returns (IStaking);
function agToken() external view returns (IAgToken);
function kp() external view returns (uint256);
function ki() external view returns (uint256);
function kd() external view returns (uint256);
function targetTVL() external view returns (uint256);
function twatvl() external view returns (uint256);
function emergencyStop() external view returns (bool);
```

**Constants:**
- MAX_SINGLE_EMISSION: 10,000 * 1e18
- BASE_DAILY_EMISSION_CAP: 11,000 * 1e18
- MAX_DAILY_EMISSION_CAP: 50,000 * 1e18
- DEFAULT_TARGET_TVL: 10,000,000
- BOOTSTRAP_TARGET_TVL: 500,000
- GAINS_CHANGE_TIMELOCK: 24 hours
- TWATVL_SMOOTHING_NUM: 99 (99% weight on old value)

---

### 1.5 AVLPStaking_v2 — LP NFT Staking

**Key Function Signatures:**
```solidity
// Staking
function stake(uint256 tokenId, uint256 weight) external nonReentrant whenNotPaused;
function unstake(uint256 tokenId) external nonReentrant whenNotPaused;
function claimRewards(uint256 tokenId) external nonReentrant whenNotPaused;

// Reward Management (ADMIN_ROLE, 48h timelock)
function scheduleRateChange(uint256 _auRate, uint256 _agRate) external;
function executeRateChange() external;
function distributeDust() external;

// View
function pendingRewards(uint256 tokenId) external view returns (uint256 auAmount, uint256 agAmount);
function getStakes(address user) external view returns (uint256[] memory);
function getAgMultiplier(address staker) external view returns (uint256);

// Admin
function recoverNFT(uint256 tokenId, address to) external onlyRole(ADMIN_ROLE);
function pause() external;
function unpause() external;

// State
function auToken() external view returns (IERC20);
function agToken() external view returns (IERC20);
function lpNFT() external view returns (IERC721);
function auRewardPerBlock() external view returns (uint256);
function agRewardPerBlock() external view returns (uint256);
function totalWeights() external view returns (uint256);
function agThreshold() external view returns (uint256);
```

**Constants:**
- MAX_AU_RATE: 1,000 * 1e18
- MAX_AG_RATE: 100 * 1e18
- RATE_DELAY: 48 hours
- MAX_MULTIPLIER: 25,000 (2.5x)
- agThreshold: 5,000 * 1e18 (5000 Ag for max multiplier)
- minStakeDuration: 1 day

---

### 1.6 GovernorContract (OpenZeppelin Governor v5)

**Key Function Signatures:**
```solidity
// Proposal Lifecycle
function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) external returns (uint256);
function state(uint256 proposalId) external view returns (ProposalState);
function getProposalDescription(uint256 proposalId) external view returns (string memory);
function getProposalCount() external view returns (uint256);

// Voting
function votingDelay() external view returns (uint256);  // 1 block
function votingPeriod() external view returns (uint256);  // 216,000 blocks (~30 days)
function quorum(uint256) external view returns (uint256);  // 4% of total supply
function proposalThreshold() external view returns (uint256);  // 100,000 Ag

// Executor
function _executor() internal view returns (address);  // timelock address
```

---

### 1.7 ArtifactTimelock (48h Timelock)

**Constants:**
- MIN_DELAY: 48 hours
- MAX_DELAY: 30 days
- GRACE_PERIOD: 14 days

---

### 1.8 RSBT (Reissuable Soulbound Token)

**Key Function Signatures:**
```solidity
function stake(uint256 lpTokenId, uint256 lpValue) external returns (uint256 rsbtTokenId);
function initiateRedemption(uint256 rsbtTokenId) external;
function redeem(uint256 rsbtTokenId) external;
function getPosition(uint256 rsbtTokenId) external view returns (RSBTPosition memory);
function calculateMultiplier(uint256 agBalance) external view returns (uint256);
function isRedemptionReady(uint256 rsbtTokenId) external view returns (bool);
function getRemainingCooldown(uint256 rsbtTokenId) external view returns (uint256);
```

---

### 1.9 DexSimulator (Sandbox AMM)

**Key Function Signatures:**
```solidity
// Swaps
function swapAforB(uint256 amountAIn, uint256 minAmountBOut, address to) external returns (uint256 amountBOut);
function swapBforA(uint256 amountBIn, uint256 minAmountAOut, address to) external returns (uint256 amountAOut);

// Two-Sided Liquidity
function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 lpShares);
function removeLiquidity(uint256 lpShares) external returns (uint256 amountA, uint256 amountB);

// One-Sided Liquidity
function addOneSidedA(uint256 amountAIn) external returns (uint256 lpShares);
function addOneSidedB(uint256 amountBIn) external returns (uint256 lpShares);
function removeOneSidedA(uint256 lpShares) external returns (uint256 amountA);
function removeOneSidedB(uint256 lpShares) external returns (uint256 amountB);

// Oracle
function getPriceA() external view returns (uint256);  // Au per Ag
function getPriceB() external view returns (uint256);  // Ag per Au
function getReserves() external view returns (uint256, uint256);

// Flash Swaps
function flashSwapAforB(uint256 borrowAmount, uint256 minRepay, address receiver, bytes calldata data) external;
function flashSwapBforA(uint256 borrowAmount, uint256 minRepay, address receiver, bytes calldata data) external;
```

---

### 1.10 AvOracle (Dual-Source Price Oracle)

**Key Function Signatures:**
```solidity
// Configuration (ORACLE_ADMIN)
function configurePriceFeed(address token, address aggregator, address quoteToken, uint256 heartbeat, uint256 maxDeviationBps) external;
function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget) external;
function addTvlSource(address source) external;
function removeTvlSource(address source) external;

// Price Queries
function getPrice(address token) external view returns (uint256 price, PriceSource source);
function getChainlinkPrice(address token) external view returns (uint256 price);
function getTwapPrice(address token) external view returns (uint256 price);
function getAuAgPrices() external view returns (uint256 auPrice, uint256 agPrice, PriceSource auSource, PriceSource agSource);

// TVL
function getTVL() external view returns (uint256 tvl, uint256 twatvl_);
function updateTVL() external;

// Updates (permissionless)
function updatePrice(address token) external notPaused;

// Circuit Breaker
function pause() external onlyGovernor;
function unpause() external onlyGovernor;
function isPriceValid(address token) external view returns (bool);
```

---

## 2. Aerodrome Integration

### 2.1 Aerodrome Contract Addresses (Base Mainnet)

Aerodrome is a Velodrome fork on Base. Key contract addresses:

| Contract | Address | Notes |
|----------|---------|-------|
| Router | `0x6Cb442acF9931c5520d90808E17048F12E325a80` | Main swap router |
| Voter | `0x1603E8140448983e264ec0c150684d1F67008808` | Gauge voting |
| FactoryRegistry | `0x5C3F189364019e95104b27f6f4115794A53f1807` | Registry for factories |
| Protocol PoolFactory | `0x5C3F189364019e95104b27f6f4115794A53f1807` | Same as FactoryRegistry on Base |
| AERO Token | `0x940181a94A35A4569E4529A3CDfB74e38FD98A63` | Governance/ reward token |
| WETH | `0x4200000000000000000000000000000000000006` | Base WETH |
| USDC | `0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6` | Base USDC |

> **Note:** Aerodrome addresses should be verified on [Basescan](https://basescan.org) before production deployment. The above are well-known canonical addresses.

### 2.2 Router Interface (IRouter)

```solidity
struct Route {
    address from;
    address to;
    bool stable;        // true = stable pool, false = volatile
    address factory;
}

// Swaps
function getAmountsOut(uint256 amountIn, Route[] memory routes) external view returns (uint256[] memory amounts);
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] memory routes,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts);

// Add Liquidity
function addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

function addLiquidityETH(
    address token,
    bool stable,
    uint256 amountTokenDesired,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline
) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

// Remove Liquidity
function removeLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
) external returns (uint256 amountA, uint256 amountB);

function removeLiquidityETH(
    address token,
    bool stable,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline
) external returns (uint256 amountToken, uint256 amountETH);

// Quotes
function quoteAddLiquidity(
    address tokenA, address tokenB, bool stable, address _factory,
    uint256 amountADesired, uint256 amountBDesired
) external view returns (uint256 amountA, uint256 amountB, uint256 liquidity);

function quoteRemoveLiquidity(
    address tokenA, address tokenB, bool stable, address _factory,
    uint256 liquidity
) external view returns (uint256 amountA, uint256 amountB);

// View
function factoryRegistry() external view returns (address);
function defaultFactory() external view returns (address);
function voter() external view returns (address);
function poolFor(address tokenA, address tokenB, bool stable, address _factory) external view returns (address pool);
function getReserves(address tokenA, address tokenB, bool stable, address _factory) external view returns (uint256 reserveA, uint256 reserveB);
```

### 2.3 Voter Interface (IVoter) — Gauge Voting

```solidity
// Voting
function vote(uint256 _tokenId, address[] calldata _poolVote, uint256[] calldata _weights) external;
function reset(uint256 _tokenId) external;
function poke(uint256 _tokenId) external;
function claimRewards(address[] memory _gauges) external;

// Managed NFTs
function depositManaged(uint256 _tokenId, uint256 _mTokenId) external;
function withdrawManaged(uint256 _tokenId) external;

// View
function gauges(address pool) external view returns (address);
function poolForGauge(address gauge) external view returns (address);
function weights(address pool) external view returns (uint256);
function votes(uint256 tokenId, address pool) external view returns (uint256);
function usedWeights(uint256 tokenId) external view returns (uint256);
function lastVoted(uint256 tokenId) external view returns (uint256);
function isGauge(address) external view returns (bool);
function isAlive(address gauge) external view returns (bool);
function claimable(address gauge) external view returns (uint256);
function length() external view returns (uint256);
```

### 2.4 Pool Factory Interface

```solidity
function getPool(address tokenA, address tokenB, bool stable) external view returns (address pool);
function createPool(address tokenA, address tokenB, bool stable) external returns (address pool);
function isPool(address pool) external view returns (bool);
function allPools(uint256) external view returns (address);
function allPoolsLength() external view returns (uint256);
```

### 2.5 Pool Interface

```solidity
function token0() external view returns (address);
function token1() external view returns (address);
function reserve0() external view returns (uint112);
function reserve1() external view returns (uint112);
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
function stable() external view returns (bool);
function factory() external view returns (address);
```

### 2.6 Gauge Interface

```solidity
function deposit(uint256 amount) external;
function withdraw(uint256 amount) external;
function claimRewards() external;
function earned(address token) external view returns (uint256);
function rewardRate() external view returns (uint256);
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
function rewardTokens(uint256) external view returns (address);
function isAlive() external view returns (bool);
```

### 2.7 Aerodrome SDK / TypeScript Integration

Aerodrome provides a TypeScript SDK via `@aerodrome-finance/sdk` (fork of velodrome-sdk):

```bash
npm install @aerodrome-finance/sdk
```

**Basic Usage:**
```typescript
import { Router, Voter, Pool, Gauge } from '@aerodrome-finance/sdk';
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

// Get pool
const pool = new Pool(
  '0x...', // pool address
  provider
);

// Get quote
const route = {
  from: '0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6', // USDC
  to: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',   // Au
  stable: false,
  factory: '0x5C3F189364019e95104b27f6f4115794A53f1807'
};

const amountsOut = await router.getAmountsOut(
  ethers.utils.parseUnits('100', 6),
  [route]
);

// Execute swap
const tx = await router.swapExactTokensForTokens(
  ethers.utils.parseUnits('100', 6),
  minAmountOut,
  [route],
  recipientAddress,
  Math.floor(Date.now() / 1000) + 1200 // 20 min deadline
);
```

---

## 3. Coinbase SDK / OnchainKit

### 3.1 Installation

```bash
# Core OnchainKit
npm install @coinbase/onchainkit

# Sub-packages (pick what you need)
npm install @coinbase/onchainkit/wallet      # Wallet connection
npm install @coinbase/onchainkit/swap        # Token swap
npm install @coinbase/onchainkit/identity    # ENS/identity
npm install @coinbase/onchainkit/finance     # DeFi components
npm install @coinbase/onchainkit/xpay        # Paymaster/xPay

# Peer dependencies
npm install react react-dom next viem wagmi
```

### 3.2 Quick Setup

```typescript
// app/providers.tsx
'use client';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { base } from 'wagmi/chains';
import { WagmiProvider } from 'wagmi';

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} chain={base}>
          <RainbowKitProvider modalSize="compact">
            {props.children}
          </RainbowKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 3.3 Smart Wallet (Coinbase Wallet)

```typescript
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownFundLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  EthBalance,
  Identity,
  Name,
} from '@coinbase/onchainkit/identity';

// Basic connect button
<Wallet>
  <ConnectWallet>
    <Avatar className="h-6 w-6" />
    <Name />
  </ConnectWallet>
  <WalletDropdown>
    <WalletDropdownLink icon="wallet" href="https://wallet.coinbase.com">
      Wallet
    </WalletDropdownLink>
    <WalletDropdownFundLink />
    <WalletDropdownDisconnect />
  </WalletDropdown>
</Wallet>
```

### 3.4 Paymaster / Gas Sponsorship

```typescript
// OnchainKit provides built-in paymaster support via Smart Wallet
// Users can have gas sponsored when using Coinbase Wallet

// Configuration in OnchainKitProvider:
<OnchainKitProvider
  apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
  chain={base}
  config={{
    appearance: {
      name: 'AV Treasury',
      logo: '/logo.svg',
    },
    wallet: {
      supportedWallets: {
        coinbaseWallet: true,
        // other wallets...
      },
    },
  }}
>
```

### 3.5 Token Swap Component

```typescript
import { Swap } from '@coinbase/onchainkit/swap';

// Pre-built swap UI
<Swap
  from={[{ token: '0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6', amount: '100' }]}  // USDC
  to={[{ token: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f' }]}  // Au
/>
```

### 3.6 Transaction Flows (Low-Level)

```typescript
import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';

// Custom transaction flow
<Transaction
  calls={[
    {
      to: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',
      data: '0x...',
      value: 0n,
    }
  ]}
  chainId={base.id}
>
  <TransactionButton text="Execute Buyback" />
  <TransactionSponsor />  {/* Gas sponsorship */}
  <TransactionStatus>
    <TransactionStatusLabel />
    <TransactionStatusAction />
  </TransactionStatus>
</Transaction>
```

### 3.7 API Surface Summary

| Component | Package | Purpose |
|-----------|---------|---------|
| `OnchainKitProvider` | `@coinbase/onchainkit` | Root provider |
| `Wallet` / `ConnectWallet` | `@coinbase/onchainkit/wallet` | Wallet connection |
| `Swap` | `@coinbase/onchainkit/swap` | Token swap UI |
| `Transaction` | `@coinbase/onchainkit/transaction` | Transaction flow |
| `Identity` | `@coinbase/onchainkit/identity` | User identity display |
| `EthBalance` | `@coinbase/onchainkit/finance` | ETH balance display |
| `Avatar` | `@coinbase/onchainkit/identity` | User avatar |
| `Name` | `@coinbase/onchainkit/identity` | ENS name display |

---

## 4. Swap Aggregation APIs

### 4.1 0x API (Matcha)

**Supports Base:** ✅ Yes  
**API Version:** v2  
**Endpoint:** `https://api.0x.org/swap/v1/quote` (v1) or v2 (beta)

```typescript
// 0x Swap API - Get quote
const quote = await fetch(
  'https://api.0x.org/swap/v1/quote?' + new URLSearchParams({
    sellToken: '0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6', // USDC
    buyToken: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',   // Au
    sellAmount: '100000000', // 100 USDC (6 decimals)
    // Optional:
    // excludedSources: 'Aerodrome', // exclude specific DEXs
    // includedSources: 'Aerodrome', // only use specific DEXs
  })
).then(r => r.json());

// Response includes: buyAmount, sellAmount, price, estimatedGas, to (contract), data
```

**npm package:**
```bash
npm install @0x/swap-contract-aggregator
```

**Best for:** Aggregated liquidity from 150+ sources, best rates for large orders

### 4.2 1inch

**Supports Base:** ✅ Yes  
**API Version:** v5.2  
**Endpoint:** `https://api.1inch.io/v5.2/8453/quote`

```typescript
const quote = await fetch(
  'https://api.1inch.io/v5.2/8453/quote?' + new URLSearchParams({
    fromTokenAddress: '0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6',
    toTokenAddress: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',
    amount: '100000000',
  })
).then(r => r.json());
```

**npm package:**
```bash
npm install @1inch/limit-order-sdk
```

### 4.3 Paraswap

**Supports Base:** ✅ Yes  
**API Version:** 6.x  
**Endpoint:** `https://apiv6.paraswap.io/prices`

```typescript
const quote = await fetch(
  'https://apiv6.paraswap.io/prices?' + new URLSearchParams({
    srcToken: '0x833589fCD6eDb6E08f4c7C32D47d1B54D3589fCD6',
    destToken: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',
    amount: '100000000',
    network: '8453',
    side: 'SELL',
  })
).then(r => r.json());
```

### 4.4 Enso Finance

**Supports Base:** ✅ Yes  
**Endpoint:** `https://api.enso.finance/api/v1/shortcuts/route`

```typescript
const route = await fetch(
  'https://api.enso.finance/api/v1/shortcuts/route?' + new URLSearchParams({
    chainId: '8453',
    fromAddress: userAddress,
    toToken: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',
    amountIn: '100000000',
    slippage: '50', // 0.5%
    routingStrategy: 'delegate',
  }),
  { headers: { 'Authorization': `Bearer ${ENSO_API_KEY}` } }
).then(r => r.json());
```

### 4.5 Comparison for AV Treasury

| API | Base Support | Best Rate | Gas Optimization | Notes |
|-----|-------------|-----------|-----------------|-------|
| **0x** | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 150+ sources, sub-BPS slippage |
| **1inch** | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Good aggregation, limit orders |
| **Paraswap** | ✅ | ⭐⭐⭐ | ⭐⭐⭐ | Multi-hop routing |
| **Enso** | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Shortcut-based, gas-efficient |
| **Aerodrome Direct** | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Native, lowest gas, single DEX |

**Recommendation for AV Treasury DApp:**
- **Primary:** Aerodrome Router (native, lowest gas, direct pool access)
- **Fallback/Comparison:** 0x API for price comparison and multi-hop routes
- **Advanced:** Enso for complex multi-step operations (e.g., flash loan + swap + stake)

---

## 5. Base App Hosting

### 5.1 Base App Platform (base.org)

Base provides an ecosystem/app platform for deploying dapps:

- **URL:** https://base.org/ecosystem
- **Deployment:** Submit via Base ecosystem portal
- **Requirements:** 
  - Deployed smart contracts on Base
  - Functional UI (Next.js/React recommended)
  - Wallet connection support
  - Mobile-responsive

**Steps:**
1. Build and test your dapp
2. Deploy contracts on Base mainnet
3. Submit to Base ecosystem: https://base.org/ecosystem
4. Provide contract addresses, audit reports, and UI screenshots

### 5.2 Self-Hosting Options

#### Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Environment variables
vercel env add NEXT_PUBLIC_ONCHAINKIT_API_KEY production
vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
```

**vercel.json:**
```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_CHAIN_ID": "8453"
  }
}
```

#### Cloudflare Pages

```bash
# Build
npm run build

# Deploy via Wrangler
npx wrangler pages deploy .next

# Or connect GitHub repo for auto-deploy
```

**Build settings:**
- Build command: `npm run build`
- Output directory: `.next`
- Node version: 20

#### Own Server (Docker)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
```

### 5.3 Recommended Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 14+ (App Router) | SSR, API routes, React Server Components |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI, accessible components |
| Web3 | viem + wagmi | TypeScript-first, lightweight |
| Onchain | OnchainKit | Coinbase integration, gas sponsorship |
| Swap | Aerodrome SDK + 0x API | Native DEX + aggregation fallback |
| Hosting | Vercel | Edge deployment, analytics, preview URLs |
| RPC | Alchemy/Infura (Base) | Reliable, archive node support |

---

## 6. ReasonATP

### 6.1 Overview

**Repository:** https://github.com/artifact-opensource/reasonatp  
**Version:** 1.2.0  
**License:** MIT  
**Language:** Python 3.12+

Reason ATP is an **Autonomous Theorem Proving & Symbolic Regression** system. It discovers, validates, and formalizes mathematical theorems autonomously using multi-agent reasoning, symbolic regression, formal verification (Lean 4), and LLM-guided analysis.

### 6.2 What It Provides

| Capability | Description | Relevance to AV Treasury |
|-----------|-------------|------------------------|
| **Symbolic Regression** | Fits 15+ functional forms to data (R², AIC, BIC scoring) | Model Au/Ag price dynamics, emission rates |
| **Multi-Agent Reasoning** | Hypothesis generator, validator, meta-reasoner, hallucination detector | Cross-validate price signals |
| **Formal Verification** | Lean 4 proof checking | Verify PID controller math |
| **Autonomous Research Loop** | Generate conjecture → validate → refine → publish | Automated market analysis |
| **Paper Generation** | LaTeX/PDF output | Generate reports |

### 6.3 API Server

```bash
# Clone and install
git clone https://github.com/artifact-opensource/reasonatp.git
cd reasonatp
pip install -r requirements.txt

# Run API server
uvicorn main:app --reload --port 8000
```

**Endpoints:**
```python
import httpx

# Reasoning endpoint
r = httpx.post("http://localhost:8000/reason", json={
    "data": [1, 4, 9, 16, 25, 36],
    "context": "Perfect squares"
})

# Symbolic regression
r = httpx.post("http://localhost:8000/fit", json={
    "x": [100, 500, 1000, 2000, 5000, 10000],
    "y": [8.2, 6.1, 5.3, 4.8, 4.5, 4.3],
    "context": "Training loss curve"
})
```

### 6.4 Integration for Price Feeds

ReasonATP can be integrated as an **off-chain price analysis layer**:

```typescript
// Example: Use ReasonATP to detect price anomalies
async function analyzePriceData(priceHistory: number[]) {
  const response = await fetch('http://reasonatp-server:8000/fit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x: priceHistory.map((_, i) => i),
      y: priceHistory,
      context: 'Au token price history'
    })
  });
  
  const result = await response.json();
  // result contains: best fit equation, R², predicted values, anomaly flags
  return result;
}
```

**Use Cases for AV Treasury:**
1. **Price trajectory prediction** — Fit emission data to predict future Ag supply
2. **Anomaly detection** — Identify unusual price movements before they hit on-chain oracles
3. **PID parameter tuning** — Symbolic regression to find optimal kp/ki/kd values
4. **Market regime detection** — Phase transition detection in trading volume

### 6.5 Architecture for Integration

```
┌─────────────────────────────────────────────────────────┐
│                    AV Treasury DApp                      │
├─────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                     │
│  ├── Price Dashboard                                    │
│  ├── Swap Interface                                     │
│  ├── Staking UI                                         │
│  └── Governance                                          │
├─────────────────────────────────────────────────────────┤
│  Backend / API Routes                                   │
│  ├── /api/prices → AvOracle (on-chain)                  │
│  ├── /api/analyze → ReasonATP (off-chain analysis)      │
│  └── /api/swap → 0x/Aerodrome (best rate routing)       │
├─────────────────────────────────────────────────────────┤
│  On-Chain (Base)                                        │
│  ├── AvOracle (Chainlink + TWAP)                        │
│  ├── TreasuryAMO (buybacks)                             │
│  ├── PID Controller (emissions)                         │
│  └── Aerodrome Pools (liquidity)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Price Detection & Oracles

### 7.1 Available Oracle Options on Base

| Oracle | Au/Ag Support | Latency | Security | Cost |
|--------|--------------|---------|----------|------|
| **Chainlink Data Feeds** | ❌ No direct feed for Au/Ag | ~1 min | ⭐⭐⭐⭐⭐ | High |
| **Chainlink Any API** | ✅ Custom via external adapter | ~1 min | ⭐⭐⭐⭐ | High |
| **Aerodrome TWAP** | ✅ (if pool exists) | 1 block | ⭐⭐⭐ | Free |
| **Uniswap V3 TWAP** | ✅ (if pool exists) | 1 block | ⭐⭐⭐ | Free |
| **Pyth Network** | ✅ (if listed) | ~400ms | ⭐⭐⭐⭐ | Low |
| **RedStone** | ✅ Custom feeds | ~1 sec | ⭐⭐⭐⭐ | Medium |
| **AV Oracle (custom)** | ✅ Native | 1 block | ⭐⭐⭐⭐ | Free |

### 7.2 Chainlink on Base

**Available Feeds (for reference):**
- ETH/USD: `0x71041dddad3595F963635067a8A20cD8e10c09e2`
- BTC/USD: `0xc907E116054Ad103354f2D350FD2514433D57F6f`
- USDC/USD: `0x7e860098F58bBFC864840e890e7D3a50b33A9B28`
- AERO/USD: Available

**For custom Au/Ag tokens:** Use Chainlink Any API with an external adapter, or use Functions for custom computation.

### 7.3 Pyth Network on Base

Pyth provides push-based oracles on Base:
- **Contract:** `0x8250f42D8740349029493F34f48F5a8B1e8f8c4e` (Pyth on Base)
- **Update fee:** 0.01 ETH per price update
- **Supported feeds:** Check https://pyth.network/price-feeds for Au/Ag availability

```solidity
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

IPyth pyth = IPyth(0x8250f42D8740349029493F34f48F5a8B1e8f8c4e);

function getPrice(bytes32 priceId) external view returns (int64 price) {
    PythTypes.Price memory p = pyth.getPrice(priceId);
    return p.price;
}
```

### 7.4 Aerodrome Pool Reserves as TWAP

The most practical approach for custom tokens like Au/Ag:

```solidity
// Using pool reserves as a simple price
function getPriceFromPool(address pool) external view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pool).getReserves();
    // Price of token0 in terms of token1
    return (uint256(reserve1) * 1e18) / uint256(reserve0);
}
```

**For TWAP (more secure):**
- Aerodrome pools track cumulative prices
- Use `priceCumulativeLast` and compute TWAP over a window
- The AvOracle contract already implements this pattern

### 7.5 Recommended Price Detection Strategy

```
                    ┌──────────────────┐
                    │   AvOracle        │
                    │  (Primary Source) │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │ Chainlink     │ │ Aerodrome│ │ Pyth Network │
     │ (if available)│ │ TWAP     │ │ (if listed)  │
     └───────────────┘ └──────────┘ └─────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Circuit Breaker  │
                    │ (deviation >5%   │
                    │  → pause)        │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ PID Controller   │
                    │ TreasuryAMO      │
                    └──────────────────┘
```

**Implementation Priority:**
1. **Aerodrome TWAP** — Immediate, free, already integrated
2. **AvOracle custom** — Already built, needs Chainlink aggregator configured
3. **Pyth Network** — Apply for Au/Ag price feed listing
4. **Chainlink Any API** — Last resort, expensive but most secure

---

## 8. Integration Architecture

### 8.1 DApp Component Architecture

```
av-treasury-dapp/
├── app/
│   ├── layout.tsx                    # Providers (OnchainKit, wagmi)
│   ├── page.tsx                      # Dashboard home
│   ├── swap/
│   │   └── page.tsx                  # Token swap (Au ↔ Ag)
│   ├── liquidity/
│   │   └── page.tsx                  # Add/remove liquidity
│   ├── stake/
│   │   └── page.tsx                  # LP NFT staking
│   ├── governance/
│   │   └── page.tsx                  # Proposals & voting
│   ├── amo/
│   │   └── page.tsx                  # AMO operations (admin)
│   └── api/
│       ├── prices/route.ts           # Price feeds
│       ├── quote/route.ts            # Swap quotes
│       └── analyze/route.ts          # ReasonATP analysis
├── components/
│   ├── SwapCard.tsx                  # Swap interface
│   ├── LiquidityManager.tsx          # Add/remove LP
│   ├── StakingPanel.tsx              # Stake LP NFTs
│   ├── PriceChart.tsx                # Price history
│   ├── GovernanceProposals.tsx       # Vote on proposals
│   └── TreasuryStats.tsx             # TVL, reserves, emissions
├── lib/
│   ├── contracts.ts                  # ABIs & addresses
│   ├── aerodrome.ts                  # Aerodrome SDK helpers
│   ├── oracle.ts                     # Price oracle queries
│   └── constants.ts                  # Chain config, addresses
├── contracts/                        # (Symlink to av_treasury/contracts)
└── public/
```

### 8.2 Key Integration Patterns

#### Pattern 1: Token Swap (Au ↔ Ag)

```typescript
// Using Aerodrome Router directly
import { encodeFunctionData, parseUnits } from 'viem';
import { base } from 'wagmi/chains';

const ROUTER_ADDRESS = '0x6Cb442acF9931c5520d90808E17048F12E325a80';

const route = {
  from: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f', // Au
  to: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',   // Ag
  stable: false,
  factory: '0x5C3F189364019e95104b27f6f4115794A53f1807',
};

// Get quote
const amountsOut = await publicClient.readContract({
  address: ROUTER_ADDRESS,
  abi: routerAbi,
  functionName: 'getAmountsOut',
  args: [parseUnits('100', 18), [route]],
});

// Execute swap
const hash = await sendTransaction({
  to: ROUTER_ADDRESS,
  data: encodeFunctionData({
    abi: routerAbi,
    functionName: 'swapExactTokensForTokens',
    args: [
      parseUnits('100', 18),
      minAmountOut,
      [route],
      userAddress,
      Math.floor(Date.now() / 1000) + 1200,
    ],
  }),
});
```

#### Pattern 2: Add Liquidity on Aerodrome

```typescript
// Add liquidity to Au/Ag pool
const hash = await sendTransaction({
  to: ROUTER_ADDRESS,
  data: encodeFunctionData({
    abi: routerAbi,
    functionName: 'addLiquidity',
    args: [
      '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f', // Au
      '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Ag
      false, // volatile pool
      parseUnits('100', 18), // Au desired
      parseUnits('500', 18), // Ag desired
      parseUnits('90', 18),  // Au min
      parseUnits('450', 18), // Ag min
      userAddress,
      Math.floor(Date.now() / 1000) + 1200,
    ],
  }),
});
```

#### Pattern 3: Stake LP NFT

```typescript
const STAKING_ADDRESS = '0x3e26b061eC20392b32dE712132c41bbE43f52566';

// Stake LP NFT
const hash = await sendTransaction({
  to: STAKING_ADDRESS,
  data: encodeFunctionData({
    abi: stakingAbi,
    functionName: 'stake',
    args: [tokenId, weight], // weight = NFT value or multiplier
  }),
});

// Check pending rewards
const [auRewards, agRewards] = await publicClient.readContract({
  address: STAKING_ADDRESS,
  abi: stakingAbi,
  functionName: 'pendingRewards',
  args: [tokenId],
});
```

#### Pattern 4: Vote on Gauge (Aerodrome)

```typescript
const VOTER_ADDRESS = '0x1603E8140448983e264ec0c150684d1F67008808';

// Vote with veNFT
const hash = await sendTransaction({
  to: VOTER_ADDRESS,
  data: encodeFunctionData({
    abi: voterAbi,
    functionName: 'vote',
    args: [
      tokenId,           // veNFT token ID
      [poolAddress],     // pools to vote for
      [10000],           // weights (10000 = 100%)
    ],
  }),
});

// Claim rewards
await sendTransaction({
  to: VOTER_ADDRESS,
  data: encodeFunctionData({
    abi: voterAbi,
    functionName: 'claimRewards',
    args: [[gaugeAddress]],
  }),
});
```

#### Pattern 5: Read Prices from AvOracle

```typescript
const ORACLE_ADDRESS = '0x...'; // AvOracle deployed address

// Get Au price
const [auPrice, auSource] = await publicClient.readContract({
  address: ORACLE_ADDRESS,
  abi: oracleAbi,
  functionName: 'getPrice',
  args: ['0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f'],
});

// Get both prices
const [auPrice, agPrice, auSource, agSource] = await publicClient.readContract({
  address: ORACLE_ADDRESS,
  abi: oracleAbi,
  functionName: 'getAuAgPrices',
});

// Get TVL
const [tvl, twatvl] = await publicClient.readContract({
  address: ORACLE_ADDRESS,
  abi: oracleAbi,
  functionName: 'getTVL',
});
```

### 8.3 Environment Configuration

```typescript
// lib/constants.ts
export const ADDRESSES = {
  // Tokens
  AuToken: '0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f',
  AgToken: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // (verify)
  
  // Core
  TreasuryAMO: '0x...',
  PIDController: '0x...',
  Staking: '0x3e26b061eC20392b32dE712132c41bbE43f52566',
  Governor: '0x...',
  Timelock: '0xB51542d460DBb4336F011CFF3Cbf80faeB3453f7',
  Oracle: '0x...',
  
  // Aerodrome
  Router: '0x6Cb442acF9931c5520d90808E17048F12E325a80',
  Voter: '0x1603E8140448983e264ec0c150684d1F67008808',
  FactoryRegistry: '0x5C3F189364019e95104b27f6f4115794A53f1807',
  
  // LP
  AuAgPool: '0x...', // Aerodrome Au/Ag pool
  AuAgGauge: '0x...', // Gauge for Au/Ag pool
} as const;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org';
export const CHAIN_ID = 8453;
```

### 8.4 Security Considerations

1. **Oracle Manipulation:** Use TWAP (30-min) from Aerodrome pools, not spot prices
2. **Slippage Protection:** Always set `amountOutMin` based on TWAP ± maxDeviation
3. **Access Control:** AMO operations restricted to EXECUTOR_ROLE
4. **Timelock:** All governance changes go through 48h timelock
5. **Circuit Breaker:** AvOracle pauses if Chainlink/TWAP deviation > 5%
6. **Reentrancy:** All state-changing functions use `nonReentrant` modifier
7. **Max Tx Limits:** AuToken enforces 1% max tx, 1% max wallet
8. **Upgrade Safety:** 7-day timelock on all UUPS upgrades

---

## Appendix A: Quick Reference — npm Packages

```bash
# Core
npm install @coinbase/onchainkit          # Coinbase OnchainKit
npm install @coinbase/onchainkit/wallet    # Wallet components
npm install @coinbase/onchainkit/swap      # Swap components
npm install @coinbase/onchainkit/identity  # Identity components
npm install @coinbase/onchainkit/transaction # Transaction flow

# Web3
npm install viem                          # Ethereum library (TypeScript)
npm install wagmi                         # React hooks for Ethereum
npm install @rainbow-me/rainbowkit        # Wallet connection UI

# DEX
npm install @aerodrome-finance/sdk        # Aerodrome SDK

# Swap Aggregation
npm install @0x/swap-contract-aggregator  # 0x API utilities

# Utilities
npm install ethers                        # Ethers.js (if needed)
npm install @tanstack/react-query          # Data fetching
npm install zustand                        # State management
npm install recharts                      # Charts
npm install date-fns                      # Date utilities
```

## Appendix B: RPC Endpoints

| Provider | URL | Rate Limit |
|----------|-----|------------|
| Base (public) | `https://mainnet.base.org` | 10 req/s |
| Alchemy | `https://base-mainnet.g.alchemy.com/v2/{KEY}` | 330 CU/s |
| Infura | `https://base-mainnet.infura.io/v3/{KEY}` | 100 req/s |
| QuickNode | `https://{endpoint}.base-mainnet.quiknode.pro/{KEY}` | Varies |

## Appendix C: Block Explorer

- **Basescan:** https://basescan.org
- **BaseScan API:** `https://api.basescan.org/api`
- **Aerodrome Analytics:** https://aerodrome.finance

---

*This document is a living reference. Contract addresses marked with `0x...` need to be verified against actual Base mainnet deployments. Always check Basescan before production use.*
