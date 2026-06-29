---
title: API Reference — AV Treasury Smart Contracts
date: 2026-06-29
status: complete
description: Complete smart contract API reference — all public functions, events, and constants for every deployed contract.
category: technical
related: [ADDRESS_BOOK.md, ARCHITECTURE.md, GETTING_STARTED.md, TOKENOMICS.md, SECURITY.md]
---

# API Reference

## 1. Au Token (Utility)

**Contract:** `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08`

### Constants
- `MAX_SUPPLY = 1_000_000_000 * 1e18`
- `MAX_TX_BPS = 10000` (100%)
- `MAX_WALLET_BPS = 1000` (10%)
- `MAX_FEE_BPS = 500` (5%)
- `UPGRADE_DELAY = 7 days`

### View Functions
- `totalSupply() → uint256`
- `balanceOf(address) → uint256`
- `transferFeeBps() → uint256`
- `maxTxAmountBps() → uint256`
- `maxWalletAmountBps() → uint256`
- `accumulatedFees() → uint256`
- `isBlocked(address) → bool`
- `isWhitelistedContract(address) → bool`
- `pendingImplementation() → address`
- `pendingImplementationTime() → uint256`

### State-Changing Functions
- `transfer(address to, uint256 amount) → bool`
- `transferFrom(address from, address to, uint256 amount) → bool`
- `approve(address spender, uint256 amount) → bool`
- `announceUpgrade(address newImplementation)`
- `executeUpgrade()`
- `cancelUpgrade()`

### Admin Functions (DEFAULT_ADMIN_ROLE)
- `setTransferFeeBps(uint256)`
- `setMaxTxAmountBps(uint256)`
- `setMaxWalletAmountBps(uint256)`
- `setBlocked(address, bool)`
- `setWhitelistedContract(address, bool)`
- `pause() / unpause()`

### Events
- `TransferFeeUpdated(uint256)`
- `MaxTxAmountUpdated(uint256)`
- `MaxWalletAmountUpdated(uint256)`
- `Blocked(address)`
- `Unblocked(address)`
- `UpgradeAnnounced(address, uint256)`
- `UpgradeExecuted(address)`
- `UpgradeCancelled()`

---

## 2. Ag Token (Governance)

**Contract:** `0x1D31719389Bd8b17277Ba367c26b830aE34D3674`

### Constants
- `MAX_SUPPLY = 100_000_000 * 1e18`
- `MAX_SINGLE_EMISSION = 10_000 * 1e18`
- `MAX_DAILY_CAP = 50_000 * 1e18`
- `UPGRADE_DELAY = 7 days`

### View Functions
- `totalSupply() → uint256`
- `balanceOf(address) → uint256`
- `pendingImplementation() → address`

### State-Changing Functions
- `transfer(address, uint256) → bool`
- `transferFrom(address, address, uint256) → bool`
- `approve(address, uint256) → bool`
- `announceUpgrade(address)`
- `executeUpgrade()`
- `cancelUpgrade()`

### Minter Functions (MINTER_ROLE — PID only)
- `mint(address to, uint256 amount)`

### Events
- `Transfer(address, address, uint256)`
- `Approval(address, address, uint256)`
- `UpgradeAnnounced(address, uint256)`
- `UpgradeExecuted(address)`

---

## 3. TreasuryAMO

**Contract:** `0x56653245f4718fe105b95C8424947B31b84b5188`

### Constants
- `MAX_RESERVE_RATIO = 10000` (100%)
- `MIN_RESERVE_RATIO = 5000` (50%)
- `REDEMPTION_FEE_BPS = 5` (0.05%)

### View Functions
- `getNAV() → uint256`
- `getReserveRatio() → uint256`
- `getTotalReserves() → uint256`
- `getSlipstreamPositions() → Position[]`
- `getAmountsOut(uint256 amountIn, address[] path) → uint256[]`

### State-Changing Functions
- `deposit(address token, uint256 amount) → uint256 auMinted`
- `redeem(uint256 auAmount) → uint256 collateralReturned`
- `executeBuyback(uint256 usdcAmount)`

### Admin Functions (PARAM_ROLE)
- `setReserveRatio(uint256)`
- `setSlipstreamPair(address)`
- `setAMOParams(uint256, uint256, uint256)`

### Events
- `Deposited(address indexed user, address token, uint256 amount, uint256 auMinted)`
- `Redeemed(address indexed user, uint256 auAmount, uint256 collateralReturned)`
- `ReserveRatioUpdated(uint256)`
- `BuybackExecuted(uint256 usdcSpent, uint256 auBought)`

---

## 4. PID Emission Controller v2

**Contract:** `0x99114F594Ff218028309d3E7F47C5873B9917f70`

### View Functions
- `getKp() → int256`
- `getKi() → int256`
- `getKd() → int256`
- `getTargetTVL() → uint256`
- `getCurrentTVL() → uint256`
- `getIntegral() → int256`
- `getError() → int256`
- `getEmissionRate() → uint256`
- `getLastEmission() → uint256`
- `getNextEpochTime() → uint256`

### State-Changing Functions
- `executeEmission() → uint256 amountMinted`
- `updateTVL()`

### Admin Functions (PARAM_ROLE)
- `setKp(int256)`
- `setKi(int256)`
- `setKd(int256)`
- `setTargetTVL(uint256)`
- `setEpochDuration(uint256)`
- `setMaxEmission(uint256)`

### Events
- `EmissionExecuted(uint256 amount, uint256 tvl, uint256 target)`
- `ParametersUpdated(string param, int256 value)`
- `TVLUpdated(uint256 newTVL)`

---

## 5. Governor Contract

**Contract:** `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385`

### Constants
- `INITIAL_VOTING_DELAY = 1` (1 block)
- `INITIAL_VOTING_PERIOD = 216000` (~3 days)
- `INITIAL_PROPOSAL_THRESHOLD = 100_000 * 1e18`
- `INITIAL_QUORUM_BPS = 400` (4%)

### View Functions
- `proposalCount() → uint256`
- `proposalThreshold() → uint256`
- `quorum(uint256 blockNumber) → uint256`
- `state(uint256 proposalId) → ProposalState`
- `getVotes(address account, uint256 blockNumber) → uint256`

### State-Changing Functions
- `propose(address[] targets, uint256[] values, bytes[] calldatas, string description) → uint256 proposalId`
- `queue(uint256 proposalId)`
- `execute(uint256 proposalId)`
- `cancel(uint256 proposalId)`
- `castVote(uint256 proposalId, uint8 support)`
- `castVoteWithReason(uint256 proposalId, uint8 support, string reason)`

### Events
- `ProposalCreated(uint256, address, address[], uint256[], string[], bytes[], uint256, uint256, string)`
- `VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)`
- `ProposalExecuted(uint256)`
- `ProposalCancelled(uint256)`

---

## 6. ArtifactTimelock

**Contract:** `0x662321CC63700865838aB08378061BE499344714`

### Constants
- `MIN_DELAY = 48 hours`
- `MAX_DELAY = 30 days`

### View Functions
- `pendingAdmin() → address`
- `pendingAdminTime() → uint256`

### State-Changing Functions
- `queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) → bytes32`
- `executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)`
- `cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)`
- `acceptAdmin()`

### Events
- `QueueTransaction(bytes32, address, uint256, string, bytes, uint256)`
- `ExecuteTransaction(bytes32, address, uint256, string, bytes, uint256)`
- `CancelTransaction(bytes32, address, uint256, string, bytes, uint256)`

---

## 7. QuasiCrystal LP NFT

**Contract:** `0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD`

### View Functions
- `balanceOf(address) → uint256`
- `tokenOfOwnerByIndex(address, uint256) → uint256`
- `tokenURI(uint256) → string`
- `stakingInfo(uint256 tokenId) → (uint256 amount, uint256 lockEnd, uint256 veAgWeight)`
- `getMultiplier(uint256 tokenId) → uint256`
- `pendingRewards(uint256 tokenId) → uint256`
- `totalStaked() → uint256`

### State-Changing Functions
- `mint(uint256 lpAmount, uint256 lockDuration) → uint256 tokenId`
- `unstake(uint256 tokenId)`
- `claimRewards(uint256 tokenId)`
- `compoundRewards(uint256 tokenId)`

### Admin Functions
- `updateTVL(uint256)` (METADATA_ROLE)
- `setRenderParams(uint256, uint256)` (METADATA_ROLE)
- `pause() / unpause()` (GOVERNOR)

### Events
- `Staked(address indexed user, uint256 tokenId, uint256 amount, uint256 lockEnd)`
- `Unstaked(address indexed user, uint256 tokenId, uint256 amount)`
- `RewardsClaimed(address indexed user, uint256 tokenId, uint256 amount)`
- `MultiplierUpdated(uint256 tokenId, uint256 multiplier)`

---

## 8. AvOracle v5

**Contract:** `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB`

### View Functions
- `getPrice(address token) → uint256`
- `getAuPrice() → uint256`
- `getNAV() → uint256`
- `getTVL() → uint256`
- `isStale() → bool`
- `lastUpdateTime() → uint256`

### State-Changing Functions
- `updatePrice()`

### Admin Functions
- `setTwapWindow(uint256)`
- `setSlipstreamPair(address)`

### Events
- `PriceUpdated(address indexed token, uint256 price, uint256 timestamp)`
- `StalenessDetected(uint256 lastUpdate)`

---

## 9. OracleWrapper

**Contract:** `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB`

### View Functions
- `getValidatedPrice(address token) → uint256`
- `isBelowPeg() → bool`
- `getDeviation() → uint256`
- `isDeviationValid() → bool`

### State-Changing Functions
- `validateAndUpdate()`

### Admin Functions
- `setDeviationThreshold(uint256)`
- `setStalenessThreshold(uint256)`
- `setBelowPegThreshold(uint256)`

### Events
- `DeviationDetected(uint256 deviation, uint256 threshold)`
- `BelowPegSignal(bool belowPeg, uint256 marketPrice, uint256 nav)`

---

## 10. TreasuryFlashBuy v2

**Contract:** `0xf6383860837E6cb983F9Af8Def92fc08F15Be65b`

### Constants
- `MAX_BUYBACK_BPS = 1000` (10% of stables)
- `COOLDOWN = 6 hours`
- `MAX_DAILY_BUYBACKS = 3`
- `NAV_DEVIATION_THRESHOLD = 200` (2%)

### View Functions
- `canExecute() → bool`
- `getLastBuybackTime() → uint256`
- `getDailyBuybackCount() → uint256`
- `getMaxBuybackAmount() → uint256`

### State-Changing Functions
- `executeBuyback()`

### Events
- `BuybackExecuted(uint256 usdcSpent, uint256 auBought, uint256 price, uint256 nav)`
- `BuybackSkipped(string reason)`
