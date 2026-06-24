# AV TREASURY — Complete Contract Inventory

**Date:** 2026-06-24  
**Scope:** All 14 contracts across Production + Sandbox layers  
**Total Lines of Solidity:** 4,632  
**Solidity Version:** 0.8.26  
**Frameworks:** Hardhat (primary), Foundry (sandbox)  

---

## Directory Structure

```
contracts/
├── AgToken.sol                    (107 lines) — Production
├── AuToken.sol                    (362 lines) — Production
├── AVLPStaking_v2.sol             (402 lines) — Production
├── PID_Emission_Controller_v2.sol (935 lines) — Production
├── TreasuryAMO.sol                (736 lines) — Production
├── GovernorContract.sol           (282 lines) — Production
├── ArtifactTimelock.sol           (83 lines)  — Production
├── AvOracle.sol                   (613 lines) — Production
├── ITvlSource.sol                 (15 lines)  — Production (interface)
├── MockLPNFT.sol                  (58 lines)  — Production (placeholder)
├── DexSimulator.sol                (315 lines) — Production (sandbox DEX)
├── MockTokens.sol                 (178 lines) — Production (sandbox tokens)
└── sandbox/
    ├── DexSimulator.sol           (315 lines) — Sandbox copy
    └── MockTokens.sol            (230 lines) — Sandbox expanded copy

sandbox/contracts/
├── DexSimulator.sol               (315 lines) — Sandbox AMM
├── MockTokens.sol                 (230 lines) — Sandbox Au + Ag tokens
├── SandboxLPToken.sol             (115 lines) — LP ERC20 wrapper
├── MockStaking.sol                (129 lines) — LP staking + yield
├── MockPIDController.sol          (116 lines) — PID emission
├── MockTreasuryAMO.sol            (124 lines) — Buyback engine
├── MockGovernor.sol               (143 lines) — DAO governance
└── DeploySandbox.s.sol            (Foundry deploy script)
```

---

## 1. Production Contracts

### 1.1 AgToken.sol — Governance Token

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | ERC20Upgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable |
| **Proxy Pattern** | UUPS (Transparent Upgradeable Proxy) |
| **Upgrade Delay** | 7 days |

**State Variables:**
| Variable | Type | Visibility | Purpose |
|----------|------|------------|---------|
| MAX_SUPPLY | uint256 constant | public | 100,000,000 * 1e18 (100M cap) |
| MINTER_ROLE | bytes32 constant | public | keccak256("MINTER_ROLE") |
| BURNER_ROLE | bytes32 constant | public | keccak256("BURNER_ROLE") |
| UPGRADER_ROLE | bytes32 constant | public | keccak256("UPGRADER_ROLE") |
| UPGRADE_DELAY | uint256 constant | public | 7 days |
| upgradeScheduledAt | uint256 | public | Timestamp of upgrade announcement |
| pendingImplementation | address | public | Pending implementation address |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| initialize(address admin) | public | — | Sets up roles, initializes ERC20 |
| announceUpgrade(address) | external | — | Step 1: Announce new implementation (7d timelock) |
| cancelUpgrade() | external | — | Cancel pending upgrade |
| _authorizeUpgrade(address) | internal | — | UUPS internal: validates timelock + announcement |
| mint(address to, uint256 amount) | external | — | MINTER_ROLE only, enforces MAX_SUPPLY |
| burn(address from, uint256 amount) | external | — | BURNER_ROLE only |
| pause() | external | — | DEFAULT_ADMIN_ROLE only |
| unpause() | external | — | DEFAULT_ADMIN_ROLE only |
| delegate(address delegatee) | public | — | Delegates voting power |
| _update(address, address, uint256) | internal | — | Override for ERC20Votes compatibility |
| nonces(address owner) | public | view | Returns nonce for permit |
| tokenURI(uint256) | public | pure | On-chain SVG metadata |

**Events:** Mint, Burn, UpgradeAnnounced, UpgradeExecuted, UpgradeCancelled

**Security Notes:**
- No `_transfer` override — uses standard ERC20 transfers
- Upgrade path is time-locked 7 days with mandatory announcement
- Cannot mint beyond MAX_SUPPLY (hard cap)

---

### 1.2 AuToken.sol — Utility Token

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | ERC20Upgradeable, ERC20PermitUpgradeable, ERC20FlashMintUpgradeable, AccessControlUpgradeable, ReentrancyGuard, PausableUpgradeable, UUPSUpgradeable |
| **Proxy Pattern** | UUPS |
| **Upgrade Delay** | 7 days |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_SUPPLY | 1,000,000,000 * 1e18 | 1B tokens fixed supply |
| FEE_DENOMINATOR | 100,000 | Basis points denominator |
| INITIAL_FEE_BPS | 9 | 0.09% transfer fee |
| MAX_FEE_BPS | 500 | 5% maximum fee cap |
| MAX_SELL_COOLDOWN | 7 days | Maximum anti-bot cooldown |
| MIN_TX_BPS | 100 | 1% of supply per transaction |
| MIN_WALLET_BPS | 100 | 1% of supply per wallet |
| MAX_FLASH_LOAN_CAP | 1,000,000 * 1e18 | Maximum flash mint |
| FEE_BURN_PORTION | 5000 | 50% of fee burned |
| FEE_PORTION_DENOMINATOR | 10,000 | Fee split denominator |

**State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| transferFeeBps | uint256 | Current transfer fee (default 9bps) |
| maxTxAmountBps | uint256 | Max transaction (default 10% of supply) |
| maxWalletAmountBps | uint256 | Max wallet (default 10% of supply) |
| sellCooldown | uint256 | Anti-bot sell cooldown |
| treasury | address | Fee recipient / accumulated fees holder |
| accumulatedFees | uint256 | Total fees awaiting withdrawal |
| feesEnabled | bool | Fee toggle (disabled during initial distribution) |
| isBlocked[address] => bool | mapping | Blocklist |
| lastSellTimestamp[address] => uint256 | mapping | Anti-bot tracking |
| isWhitelistedContract[address] => bool | mapping | Contract whitelist (skips cooldown) |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| initialize(address _treasury) | public | — | Sets treasury, roles, defaults |
| announceUpgrade(address) | external | — | 7-day timelock |
| cancelUpgrade() | external | — | Cancel pending |
| setTransferFeeBps(uint256) | external | — | ANTI_BOT_ROLE, max 500bps |
| setMaxTxAmount(uint256) | external | — | ANTI_BOT_ROLE, min 100bps |
| setMaxWalletAmount(uint256) | external | — | ANTI_BOT_ROLE, min 100bps |
| setSellCooldown(uint256) | external | — | ANTI_BOT_ROLE, max 7 days |
| setWhitelistedContract(address, bool) | external | — | ANTI_BOT_ROLE |
| setFeesEnabled(bool) | external | — | DEFAULT_ADMIN_ROLE |
| withdrawFees() | external | — | Treasury or admin, mints accumulated fees to treasury |
| setBlocked(address, bool) | external | — | ANTI_BOT_ROLE |
| pause() / unpause() | external | — | DEFAULT_ADMIN_ROLE |
| setTreasury(address) | external | — | DEFAULT_ADMIN_ROLE |
| mint(address, uint256) | external | — | MINTER_ROLE, whenNotPaused |
| maxFlashLoan(address) | public | view | Returns MAX_FLASH_LOAN_CAP |
| _flashFee(address, uint256) | internal | view | Returns 9bps of amount |
| _update(address, address, uint256) | internal | — | Fee logic + blocklist + cooldown + max-tx + max-wallet |
| tokenURI(uint256) | public | pure | On-chain SVG (base64 encoded) |

**Events:** TransferFeeUpdated, MaxTxAmountUpdated, MaxWalletAmountUpdated, SellCooldownUpdated, TreasuryUpdated, BlocklistUpdated, WhitelistUpdated, FeesWithdrawn, FeesEnabledChanged, UpgradeAnnounced/Executed/Cancelled

**Custom Errors:** Au_SenderBlocked, Au_RecipientBlocked, Au_FeeExceedsCap, Au_CooldownActive, Au_ExceedsMaxTx, Au_ExceedsMaxWallet, Au_ContractNotWhitelisted, Au_ExceedsMaxFlashLoan, Au_ZeroAddress, Au_AlreadyInitialized, Au_SellCooldownExceedsMax, Au_InvalidToken

**Security Notes:**
- ReentrancyGuard on `_update()` — prevents reentrancy during fee collection
- Fees disabled during initial distribution (prevents fee on initial allocations)
- Flash mint fee (9bps) — critical v3 fix where this was missing in v2
- Blocklist + cooldown + max-tx + max-wallet = comprehensive anti-bot
- `withdrawFees()` mints to treasury (fees are held as minted tokens, not stored balance)

---

### 1.3 AVLPStaking_v2.sol — LP NFT Staking

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | AccessControlUpgradeable, ReentrancyGuard, PausableUpgradeable, UUPSUpgradeable, IERC721Receiver |
| **Proxy Pattern** | UUPS |
| **Upgrade Delay** | 7 days |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_AU_RATE | 1,000 * 1e18 | Max Au reward per block |
| MAX_AG_RATE | 100 * 1e18 | Max Ag reward per block |
| RATE_DELAY | 48 hours | Timelock for rate changes |
| UPGRADE_DELAY | 7 days | Upgrade timelock |
| MAX_MULTIPLIER | 25,000 (2.5x) | Maximum Ag multiplier |
| MULTIPLIER_DENOMINATOR | 10,000 | Basis points |
| minStakeDuration | 1 days | Minimum stake duration |

**State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| auToken | IERC20 | Au reward token |
| agToken | IERC20 | Ag reward token |
| lpNFT | IERC721 | LP NFT contract |
| auRewardPerBlock | uint256 | Current Au reward rate |
| agRewardPerBlock | uint256 | Current Ag reward rate |
| totalWeights | uint256 | Total staked weight |
| accAuPerWeight | uint256 | Accumulated Au per weight (reward accounting) |
| accAgPerWeight | uint256 | Accumulated Ag per weight |
| lastRewardBlock | uint256 | Last block rewards distributed |
| agThreshold | uint256 | 5,000 * 1e18 Ag for max multiplier |
| _stakedWeights[tokenId] => uint256 | mapping | Weight per staked NFT |
| _stakeOwner[tokenId] => address | mapping | Owner of staked NFT |
| _ownerStakes[address] => uint256[] | mapping | Array of tokenIds per owner |
| _pendingAu[tokenId] => uint256 | mapping | Pending Au rewards |
| _pendingAg[tokenId] => uint256 | mapping | Pending Ag rewards |
| _debtAu[tokenId] => uint256 | mapping | Reward debt for Au |
| _debtAg[tokenId] => uint256 | mapping | Reward debt for Ag |
| _stakedAt[tokenId] => uint256 | mapping | Stake timestamp (for min duration) |
| dustAu / dustAg | uint256 | Dust accumulator from rounding |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| initialize(address, address, address) | public | — | Sets tokens, roles |
| announceUpgrade / cancelUpgrade | external | — | 7-day timelock |
| scheduleRateChange(uint256, uint256) | external | — | ADMIN_ROLE, starts 48h timelock |
| executeRateChange() | external | — | ADMIN_ROLE, after timelock |
| setRewardRates(uint256, uint256) | external | — | ADMIN_ROLE, schedule + execute |
| getAgMultiplier(address) | public | view | Returns multiplier (10000-25000) |
| stake(uint256 tokenId, uint256 weight) | external | — | NFT stake, nonReentrant |
| unstake(uint256 tokenId) | external | — | NFT unstake, enforces 1-day min |
| claimRewards(uint256 tokenId) | external | — | Claim pending rewards |
| recoverNFT(uint256, address) | external | — | ADMIN_ROLE, emergency recovery |
| pendingRewards(uint256) | public | view | Returns (auAmount, agAmount) |
| distributeDust() | external | — | Distribute rounding dust |
| pause() / unpause() | external | — | ADMIN_ROLE |
| onERC721Received(...) | external | pure | IERC721Receiver interface |

**Events:** StakedNFT, UnstakedNFT, RewardsClaimed, RewardRatesUpdated, RateChangeScheduled, NFTRecovered, UpgradeAnnounced/Executed/Cancelled

**Reward Accounting (Masterchef-style):**
```
_updateRewards():
  blocksElapsed = block.number - lastRewardBlock
  auEarned = auRewardPerBlock * blocksElapsed
  delta = (auEarned * 1e18) / totalWeights
  accAuPerWeight += delta

_claimRewards(tokenId):
  auOwed = (weight * accAuPerWeight) / 1e18 - debtAu[tokenId]
  agOwed = (weight * accAgPerWeight) / 1e18 - debtAg[tokenId]
  transfer(auOwed, agOwed)
  debtAu = (weight * accAuPerWeight) / 1e18
```

**Security Notes:**
- ReentrancyGuard on stake/unstake/claim
- 1-day minimum stake prevents flash-loan TVL manipulation
- 48h rate change timelock prevents sudden yield changes
- Dust accumulator prevents rounding loss exploitation
- NFT recovery is admin-only emergency function

---

### 1.4 PID_Emission_Controller_v2.sol — Emission Brain

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | AccessControl, ReentrancyGuard, Pausable |
| **Upgrade Pattern** | Non-upgradeable (immutable) |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| SCALE | 1e18 | PID parameter precision |
| MIN_PID_GAIN | 1e12 | Minimum kp/ki/kd |
| MAX_PID_GAIN | 1e18 | Maximum kp/ki/kd |
| MAX_INTEGRAL | 1e24 | Maximum integral accumulator |
| INTEGRAL_DECAY_NUM | 99 | 99% integral retention |
| INTEGRAL_DECAY_DEN | 100 | Denominator |
| MAX_SINGLE_EMISSION | 10,000 * 1e18 | Per-tick cap |
| BASE_DAILY_EMISSION_CAP | 11,000 * 1e18 | Daily floor |
| MAX_DAILY_EMISSION_CAP | 50,000 * 1e18 | Daily ceiling |
| DEFAULT_TARGET_TVL | 10,000,000 | Default target (unused, bootstrap overrides) |
| BOOTSTRAP_TARGET_TVL | 500,000 | Starting target |
| MAX_TARGET_TVL | 5,000,000 | Final target |
| BOOTSTRAP_DURATION_MONTHS | 10 | Bootstrap duration |
| SECONDS_PER_MONTH | 30 days | 30-day months |
| TVL_DROP_THRESHOLD_NUM | 95 | 95% threshold |
| TVL_DROP_THRESHOLD_DEN | 100 | Denominator |
| GAINS_CHANGE_TIMELOCK | 24 hours | Parameter change delay |
| TWATVL_SMOOTHING_NUM | 99 | 99% old value weight |
| TWATVL_SMOOTHING_DEN | 100 | Denominator |

**State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| staking | IStaking (immutable) | TVL source |
| agToken | IAgToken (immutable) | Token to mint |
| kp, ki, kd | uint256 | PID gains |
| targetTVL | uint256 | Current target (changes with bootstrap) |
| integral | int256 | Accumulated integral term |
| lastError | int256 | Previous error (for derivative) |
| lastUpdate | uint256 | Last emission timestamp |
| twatvl | uint256 | Time-Weighted Average TVL |
| deploymentTimestamp | uint256 | Bootstrap start time |
| dailyEmitted | uint256 | Current daily emission total |
| dailyWindowStart | uint256 | Daily window start |
| totalAgEmitted | uint256 | Lifetime emission counter |
| emergencyStop | bool | Emergency pause toggle |
| tvlSnapshot30d | uint256 | 30-day-old TVL for dynamic cap |
| tvlSnapshotTime | uint256 | When snapshot was taken |
| gainsChangeScheduled | bool | Parameter change pending |
| scheduledKp/Ki/Kd | uint256 | Pending gains |
| currentAdmin / pendingAdmin | address | Two-step admin transfer |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| constructor(address, address, address, uint256, uint256, uint256, uint256) | public | — | Sets roles, gains, target, timestamps |
| executeEmission() | external | — | EMIT_ROLE, main emission logic |
| updateTWATVL() | external | — | Anyone, updates TWATVL |
| getDynamicDailyCap() | public | view | Returns dynamic cap based on TVL growth |
| updateTvlSnapshot() | external | — | Anyone, once per 30 days |
| toggleEmergencyStop() | external | — | DEFAULT_ADMIN_ROLE |
| requestAdminChange(address) | external | — | Step 1 of admin transfer |
| acceptAdmin() | external | — | Step 2 of admin transfer |
| setTargetTVL(uint256) | external | — | DEFAULT_ADMIN_ROLE |
| scheduleGainsChange(uint256, uint256, uint256) | external | — | PARAM_ROLE, 24h timelock |
| executeGainsChange() | external | — | PARAM_ROLE, after timelock |
| cancelGainsChange() | external | — | PARAM_ROLE |
| pause() / unpause() | external | — | DEFAULT_ADMIN_ROLE |
| remainingDailyEmission() | public | view | Remaining daily capacity |
| timeUntilDailyReset() | public | view | Seconds until daily reset |
| timeUntilGainsChangeExecutable() | public | view | Seconds until gains change |
| getCurrentTargetTVL() | public | view | Returns interpolated bootstrap target |
| previewEmission() | public | view | Simulates emission without state change |
| grantParamRole / revokeParamRole | external | — | DEFAULT_ADMIN_ROLE |
| grantEmitRole / revokeEmitRole | external | — | DEFAULT_ADMIN_ROLE |

**PID Algorithm:**
```
error = targetTVL - effectiveTVL(TWATVL)
P = (kp * error) / SCALE
integral = integral + (error * timeElapsed)
integral = (integral * 99) / 100  // decay
integral = clamp(integral, ±MAX_INTEGRAL)
I = (ki * integral) / SCALE
D = (kd * (error - lastError) / timeElapsed) / SCALE
output = P + I + D
if output ≤ 0: return 0
if output > MAX_SINGLE_EMISSION: output = MAX_SINGLE_EMISSION
if dailyEmitted + output > dynamicCap: output = dynamicCap - dailyEmitted
if currentTVL < twatvl * 95 / 100: output = output / 2  // emission decay
mint(output) to staking contract
```

**Bootstrap Logic:**
```
elapsed = block.timestamp - deploymentTimestamp
if elapsed >= BOOTSTRAP_DURATION_MONTHS * 30 days:
    return MAX_TARGET_TVL
else:
    return BOOTSTRAP_TARGET_TVL + (MAX_TARGET_TVL - BOOTSTRAP_TARGET_TVL) * elapsed / bootstrapDuration
```

**Dynamic Cap Logic:**
```
if no 30-day snapshot: return BASE_DAILY_CAP
if TVL decreased: return BASE_DAILY_CAP
growthBps = ((currentTVL - tvlSnapshot30d) * 10000) / tvlSnapshot30d
growthBps = min(growthBps, 40000)  // cap at 400%
dynamicCap = BASE_DAILY_CAP + (BASE_DAILY_CAP * growthBps) / 10000
return min(dynamicCap, MAX_DAILY_CAP)
```

**Security Notes:**
- TWATVL (99/100 smoothing) prevents flash-loan TVL manipulation
- Emission decay (halve if TVL drops 95% below TWATVL) adds safety
- Emergency stop can halt all emissions instantly
- Two-step admin transfer prevents accidental loss
- Gains changes have 24h timelock for community review
- Division-by-zero guard (timeElapsed minimum 1 second)
- Zero-stakers guard (returns 0 if no stakers)

---

### 1.5 TreasuryAMO.sol — Buyback Engine

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | AccessControl, ReentrancyGuard, Pausable |
| **Upgrade Pattern** | Non-upgradeable |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| BPS_DENOMINATOR | 10,000 | Basis points |
| MAX_DEADLINE_EXTENSION | 1 hours | Maximum deadline |
| AMO_RESERVE_RUNWAY_MONTHS | 12 | Minimum months of reserves |
| AMO_BUYBACK_PCT | 12 | 12% of excess reserves |
| MIN_BUYBACK_USD | 500 | Minimum buyback floor |

**State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| auToken | IERC20 (immutable) | Token to buy back |
| reserveToken | IERC20 (immutable) | Token used for buyback (USDC) |
| aerodromeRouter | IAerodromeRouter | Primary DEX |
| uniswapRouter | IUniswapV2Router | Backup DEX |
| cooldown | uint256 | Minimum time between operations (24h) |
| maxSlippageBps | uint256 | Maximum slippage (0.5%) |
| maxPriceDeviationBps | uint256 | Maximum TWAP deviation (5%) |
| maxUpdateDeviationBps | uint256 | Maximum TWAP update deviation (5%) |
| minTwapUpdateInterval | uint256 | Minimum time between TWAP updates (1h) |
| maxBuybackPerEpochBps | uint256 | Maximum per-epoch buyback (5%) |
| twapWindow | uint256 | TWAP staleness window (1h) |
| minRunwayReserve | uint256 | Minimum runway reserve |
| lastOperationTime | uint256 | Last operation timestamp |
| twapPrice | uint256 | Current TWAP price |
| twapLastUpdate | uint256 | Last TWAP update |
| totalBuybacksExecuted | uint256 | Lifetime counter |
| totalAuBought | uint256 | Lifetime Au bought |
| totalReserveSpent | uint256 | Lifetime reserve spent |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| constructor(address, address, address, address) | public | — | Sets tokens, router, roles, defaults |
| executeBuyback(uint256, uint256, bool, uint256) | external | — | Main buyback function |
| _swapOnAerodrome(uint256, uint256, uint256) | internal | — | Swap on primary DEX |
| _swapOnUniswap(uint256, uint256, uint256) | internal | — | Swap on backup DEX |
| _validateTWAPPrice(uint256, uint256) | internal | view | TWAP deviation check |
| _getExpectedOutput(uint256, bool) | internal | view | Query DEX for expected output |
| updateTWAPPrice(uint256) | external | — | EXECUTOR/PARAM_ROLE, update TWAP |
| setCooldown(uint256) | external | — | PARAM_ROLE |
| setMaxSlippage(uint256) | external | — | PARAM_ROLE |
| setMaxPriceDeviation(uint256) | external | — | PARAM_ROLE |
| setMinRunwayReserve(uint256) | external | — | PARAM_ROLE |
| setMaxBuybackPerEpoch(uint256) | external | — | PARAM_ROLE |
| setAerodromeRouter(address) | external | — | PARAM_ROLE |
| setUniswapRouter(address) | external | — | PARAM_ROLE |
| pause() / unpause() | external | — | DEFAULT_ADMIN_ROLE |
| emergencyWithdraw(address, uint256) | external | — | DEFAULT_ADMIN_ROLE, whenPaused |
| timeUntilNextOperation() | public | view | Seconds until next allowed |
| getReserveBalance() | public | view | Current reserve balance |
| getAuBalance() | public | view | Current Au balance |
| getExpectedOutput(uint256, bool) | public | view | Query DEX |

**Buyback Flow:**
```
executeBuyback(reserveAmount, minAuOut, useAerodrome, deadline):
  1. Check: not paused, has EXECUTOR_ROLE
  2. Check: deadline valid (not past, not > 1h future)
  3. Check: per-epoch cap (≤ 5% of current reserve)
  4. Check: minimum buyback (≥ $500)
  5. Check: TWAP price (if set, deviation < 5%)
  6. Calculate: expectedOutput from DEX
  7. Calculate: slippageMinOut = expectedOutput * (1 - 0.005)
  8. Use: max(minAuOut, slippageMinOut) as final minimum
  9. Swap: reserveToken → Au on chosen DEX
  10. Verify: received ≥ finalMinOut
  11. Update: lastOperationTime, totals
```

**Security Notes:**
- balanceBefore pattern prevents donation attack (C-1 fix)
- TWAP validation prevents buying at manipulated prices
- Per-epoch cap prevents treasury drain
- Runway reserve ensures 12-month safety buffer
- Dual DEX routing (Aerodrome primary, Uniswap backup)
- forceApprove + clear approval pattern prevents lingering approvals
- Emergency withdraw when paused

---

### 1.6 GovernorContract.sol — DAO Governance

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| INITIAL_VOTING_DELAY | 1 | 1 block delay |
| INITIAL_VOTING_PERIOD | 216,000 | ~30 days on Base |
| INITIAL_PROPOSAL_THRESHOLD | 100,000 * 1e18 | 100K Ag |
| INITIAL_QUORUM_BPS | 4 | 4% of total supply |

**State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| proposalCount | uint256 | Total proposals created |
| proposalDescriptions[uint256] => string | mapping | Proposal descriptions |
| executorAddress | address | Timelock address |

**Functions:**
| Function | Visibility | Mutability | Description |
|----------|------------|------------|-------------|
| constructor(IVotes, address) | public | — | Sets token, executor, governance params |
| votingDelay() | public | view | Returns 1 block |
| votingPeriod() | public | view | Returns 216,000 blocks |
| quorum(uint256) | public | view | Returns 4% of total supply |
| proposalThreshold() | public | view | Returns 100,000 Ag |
| _executor() | internal | view | Returns timelock address |
| state(uint256) | public | view | Returns proposal state |
| propose(address[], uint256[], bytes[], string) | public | — | Creates proposal, stores description |
| _cancel(address[], uint256[], bytes[], bytes32) | internal | — | Cancel proposal |
| _queueOperations(...) | internal | — | Returns 0 (no queuing without timelock) |
| _executeOperations(...) | internal | — | Execute proposal |
| proposalNeedsQueuing(uint256) | public | view | Returns super's result |
| supportsInterface(bytes4) | public | view | ERC-165 |
| getProposalDescription(uint256) | public | view | Returns description |
| getProposalCount() | public | view | Returns count |

**Diamond Overrides:** _cancel, _queueOperations, _executeOperations, _executor, proposalNeedsQueuing, supportsInterface

**Security Notes:**
- Inherits OpenZeppelin Governor v5 (battle-tested)
- 30-day voting period allows broad participation
- 4% quorum prevents minority governance attacks
- 100K Ag threshold prevents spam proposals
- Executor is timelock (48h delay) — community can review before execution

---

### 1.7 ArtifactTimelock.sol — Governance Gate

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | AGPL-3.0 |
| **Inheritance** | TimelockController |

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| MIN_DELAY | 48 hours | Minimum delay |
| MAX_DELAY | 30 days | Maximum delay |
| GRACE_PERIOD | 14 days | Execution window after timelock |

**Constructor:**
- Takes: _proposer (Governor), _executor (Governor + multisig), _canceler (emergency)
- Wraps TimelockController with preset roles

**Security Notes:**
- 48h delay gives community time to review and exit if needed
- 14-day grace period after timelock expiry
- Proposer restricted to Governor only
- Executor can be Governor + multisig for redundancy
- Canceler can interrupt during timelock (emergency)

---

### 1.8 AvOracle.sol — Future Oracle

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **License** | MIT |
| **Inheritance** | AccessControl, ReentrancyGuard |

**Roles:** ORACLE_ADMIN, GOVERNOR

**Structs:** PriceFeed, TwapPool, PriceData, TvlData

**State Variables:**
- auToken, agToken (addresses)
- priceFeeds[token] => PriceFeed
- twapPools[token] => TwapPool
- cachedPrices[token] => PriceData
- tvlData (TvlData)
- tvlSources[] (address array)
- paused (circuit breaker)
- twatvl, twatvlLastUpdate

**Functions:**
- configurePriceFeed(token, aggregator, quoteToken, heartbeat, maxDeviationBps)
- configureTwapPool(token, pool, token0, token1, twapDuration, token0IsTarget)
- addTvlSource(source) / removeTvlSource(source)
- getPrice(token) → (price, source)
- getChainlinkPrice(token) → price
- getTwapPrice(token) → price
- getTVL() → (tvl, twatvl)
- updatePrice(token) — permissionless, keeper-triggered
- updateTVL() — permissionless
- pause() / unpause() — GOVERNOR only
- isPriceValid(token) → bool
- getAuAgPrices() → (auPrice, agPrice, auSource, agSource)

**Current Status:** Fully implemented but NOT WIRED to PID. PID uses direct staking TVL.

---

### 1.9 ITvlSource.sol — Interface

```solidity
interface ITvlSource {
    function getTvl() external view returns (uint256 tvl);
}
```

Implemented by: AVLPStaking_v2 (via `totalStakedNFTs()`), MockStaking (via `totalStaked`)

---

### 1.10 MockLPNFT.sol — Placeholder NFT

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **Inheritance** | ERC721, ERC721Enumerable, Ownable |

**Functions:** mint, safeMint, batchMint, burn, tokenURI

**Status:** Placeholder. Needs replacement with real LP position tracking before mainnet.

---

## 2. Sandbox Contracts

### 2.1 MockTokens.sol (Production Sandbox)

Contains 3 contracts in one file:

**MockAuToken:**
- 1,000,000 initial supply (1M, much smaller than production's 1B)
- 9bps fee (4.5bps burn, 4.5bps treasury)
- Blocklist, max tx (1%), max wallet (1%)
- No flash mint, no cooldown, no permit
- Simpler than production (no upgradeability)

**MockAgToken:**
- 100,000,000 max supply (matches production)
- MINTER_ROLE (owner is initial minter)
- No UUPS, no votes, no permit
- Simpler than production

**MockTokens (Faucet):**
- Deploys MockAuToken + MockAgToken
- fundBot(bot, auAmount, agAmount) — transfers Au, mints Ag
- mintAg(to, amount) — mints Ag (simulates PID emission)

---

### 2.2 DexSimulator.sol (Production Sandbox)

Identical to `contracts/DexSimulator.sol` — see production analysis above.

---

### 2.3 SandboxLPToken.sol — LP ERC20 Wrapper

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |
| **Inheritance** | None (standalone) |

**State:**
- dex (IDexSimulator)
- tokenA, tokenB (addresses)
- balanceOf[address] => uint256
- allowance[address][address] => uint256
- totalSupply

**Functions:**
- mint(amountAIn, amountBIn) → lpShares
- mintOneSidedA(amountAIn) → lpShares
- mintOneSidedB(amountBIn) → lpShares
- burn(lpShares) → (amountA, amountB)
- transfer, approve, transferFrom (standard ERC20)

**Purpose:** Wraps DexSimulator LP positions into ERC20 tokens that MockStaking can accept.

---

### 2.4 MockStaking.sol — LP Staking

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |

**State:**
- lpToken, auToken, agToken (IERC20)
- totalStaked
- rewardRateAu, rewardRateAg
- stakedBalance, rewardDebtAu, rewardDebtAg
- accRewardPerTokenAu, accRewardPerTokenAg
- lastRewardBlock

**Functions:**
- stake(amount) — transfer LP, update rewards, add stake
- unstake(amount) — claim rewards, remove stake, return LP
- claimRewards() — claim pending rewards
- getTvl() → totalStaked (ITvlSource interface)
- pendingRewards(user) → (auAmount, agAmount)
- setRewardRates(uint256, uint256)

**Differences from Production AVLPStaking_v2:**
- No NFTs (uses ERC20 LP tokens)
- No minimum stake duration
- No 48h rate change timelock
- No Ag multiplier
- No dust accumulator
- Same reward accounting (accRewardPerToken pattern)

---

### 2.5 MockPIDController.sol — Simplified PID

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |

**State:**
- agToken, tvlSource (ITvlSource)
- kp, ki, kd (int256)
- targetTvl, integral, prevError
- lastEmissionBlock
- maxDailyEmission, maxSingleEmission
- emissionCooldown
- dailyEmitted, lastDailyReset
- deadbandBps

**Functions:**
- tick() → amount — main emission logic
- getCurrentError() → int256
- remainingDailyEmission() → uint256
- canEmit() → bool
- setTarget, setKp, setKi, setKd, setMaxDailyEmission, setDeadband

**Differences from Production PID:**
- No TWATVL (reads instantaneous TVL)
- No bootstrap (fixed target)
- No two-step gains changes
- Adds deadband (±% error tolerance)
- Adds block cooldown (not time-based)
- No emergency stop
- No admin transfer
- Simpler daily reset (every 7200 blocks)

---

### 2.6 MockTreasuryAMO.sol — Sandbox Buyback

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |

**State:**
- agToken (reserve), auToken (buyback target), dex (IDexSimulator)
- cooldown, lastBuybackBlock
- maxSlippageBps, maxBuybackPerEpochBps, runway
- totalBuybacksExecuted, totalAuBought, totalAgSpent

**Functions:**
- executeBuyback(agAmount, minAuOut) — swap Ag→Au on DexSimulator
- canExecute() → bool
- cooldownRemaining() → uint256
- maxBuybackAmount() → uint256
- setCooldown, setMaxSlippage, setMaxBuybackPerEpoch, setRunway

**KEY DIFFERENCE FROM PRODUCTION:**
- Production: spends reserveToken (USDC) → buys Au
- Sandbox: spends Ag (tokenA) → buys Au on DexSimulator

---

### 2.7 MockGovernor.sol — Sandbox DAO

| Attribute | Value |
|-----------|-------|
| **Pragma** | solidity 0.8.26 |

**State:**
- proposalCount
- votingPeriod, timelockDelay, proposalThreshold, quorumBps
- proposals[uint256] => Proposal
- hasVoted[uint256][address] => bool
- votes[uint256][address] => uint256

**Proposal struct:** id, proposer, description, target, callData, forVotes, againstVotes, startBlock, endBlock, executeAfter, executed, canceled

**Functions:**
- propose(string, address, bytes) → uint256
- castVote(uint256, bool, uint256)
- queue(uint256)
- execute(uint256)
- cancel(uint256)
- getProposal(uint256) → Proposal
- isReady(uint256) → bool

**Differences from Production Governor:**
- No ERC20Votes (uses Au balance as vote weight directly)
- Simplified quorum check (forVotes == 0)
- No OpenZeppelin inheritance
- Anyone can propose (threshold checked externally)
- No proposalDescriptions mapping

---

## 3. Contract Comparison Matrix

| Feature | Production | Sandbox | Fidelity |
|---------|-----------|---------|----------|
| AgToken: UUPS proxy | ✅ | ❌ (plain ERC20) | Low |
| AgToken: 100M cap | ✅ | ✅ | High |
| AgToken: MINTER_ROLE | ✅ | ✅ | High |
| AgToken: Votes | ✅ | ❌ | Low |
| AuToken: 1B supply | ✅ | 1M | Scaled |
| AuToken: 9bps fee | ✅ | ✅ | High |
| AuToken: burn+treasury | ✅ | ✅ | High |
| AuToken: blocklist | ✅ | ✅ | High |
| AuToken: max-tx/wallet | ✅ | ✅ | High |
| AuToken: flash mint | ✅ | ❌ | Low |
| AuToken: cooldown | ✅ | ❌ | Low |
| Staking: NFT-based | ✅ | ❌ (ERC20) | Low |
| Staking: dual yield | ✅ | ✅ | High |
| Staking: reward accounting | ✅ | ✅ | High |
| Staking: Ag multiplier | ✅ | ❌ | Low |
| Staking: min stake 1 day | ✅ | ❌ | Medium |
| Staking: 48h rate timelock | ✅ | ❌ | Medium |
| PID: TWATVL | ✅ | ❌ | Low |
| PID: bootstrap | ✅ | ❌ | Low |
| PID: dynamic cap | ✅ | ❌ | Low |
| PID: deadband | ❌ | ✅ | Enhanced |
| PID: emergency stop | ✅ | ❌ | Low |
| PID: 2-step gains change | ✅ | ❌ | Low |
| TreasuryAMO: reserveToken buyback | ✅ | ❌ (Ag) | Different |
| TreasuryAMO: TWAP validation | ✅ | ❌ | Low |
| TreasuryAMO: dual DEX | ✅ | ❌ (single) | Low |
| Governor: OZ v5 | ✅ | ❌ (custom) | Low |
| Governor: 30-day voting | ✅ | ✅ (configurable) | High |
| Governor: timelock | ✅ | ✅ | High |
| Timelock: 48h delay | ✅ | ✅ (configurable) | High |
| AvOracle: multi-source | ✅ | ❌ (not needed) | N/A |

---

## 4. Deployment Architecture

### Production Deployment Order (scripts/deploy.js)
1. AgToken (implementation + proxy)
2. AuToken (implementation + proxy)
3. ArtifactTimelock
4. GovernorContract
5. AVLPStaking_v2 (implementation + proxy, initialize)
6. PID_Emission_Controller_v2
7. TreasuryAMO
8. Configuration (roles, funding, ownership transfer)

### Sandbox Deployment Order (sandbox/scripts/deploy-sandbox.js)
1. MockAuToken
2. MockAgToken
3. DexSimulator (Ag/Au pair)
4. SandboxLPToken (wrapper for DexSimulator)
5. MockStaking (LP → Au+Ag yield)
6. MockPIDController (reads staking TVL, mints Ag)
7. MockTreasuryAMO (Ag→Au buyback on DexSimulator)
8. MockGovernor (DAO over all)
9. Fund system (500K Ag to AMO, 100K Au to staking)
10. Add initial liquidity (50K Ag + 50K Au)
11. Fund 100 bots (1000 Ag each)
12. Save deployment manifest

---

## 5. Total System Metrics

| Metric | Value |
|--------|-------|
| Total Solidity files | 14 |
| Total lines of code | 4,632 |
| Production contracts | 12 (including interface + placeholder) |
| Sandbox contracts | 7 |
| Interfaces | 1 (ITvlSource) |
| Upgradeable contracts | 3 (AgToken, AuToken, AVLPStaking_v2) |
| Non-upgradeable contracts | 11 |
| Contracts with ReentrancyGuard | 3 (AuToken, AVLPStaking_v2, TreasuryAMO) |
| Contracts with Pausable | 5 (AgToken, AuToken, AVLPStaking_v2, PID, TreasuryAMO) |
| Contracts with AccessControl | 7 |
| Events defined | ~40+ |
| Custom errors defined | ~25+ |
| State variables (total) | ~80+ |
| Functions (total) | ~120+ |

---

*Document: CONTRACT_INVENTORY.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
