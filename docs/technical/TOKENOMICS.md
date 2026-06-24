# AV Treasury — Formalized Tokenomics & Dual-Contract Architecture

> **Version:** 1.0.0  
> **Date:** 2026-06-25  
> **Status:** Publish-Ready  
> **Authors:** Treasury Engineering

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [System Overview](#2-system-overview)
3. [Dual-Token Architecture](#3-dual-token-architecture)
   - 3.1 Artifact Utility
   - 3.2 Artifact Governance
   - 3.3 Synergy Mechanics
4. [Token Supply & Distribution](#4-token-supply--distribution)
   - 4.1 Total Supply Breakdown
   - 4.2 Initial Price Table
   - 4.3 Vesting Schedule
5. [Contract Specifications](#5-contract-specifications)
   - 5.1 AgToken — Contract Anatomy
   - 5.2 AuToken — Contract Anatomy
   - 5.3 TreasuryAMO — Monetary Policy Engine
   - 5.4 PID Emission Controller
   - 5.5 AVLP Staking
   - 5.6 RSBT — Reissuable Soulbound Token
6. [Emission Schedule & PID Control](#6-emission-schedule--pid-control)
7. [Staking & Yield Mechanics](#7-staking--yield-mechanics)
8. [Value Accrual & Flywheels](#8-value-accrual--flywheels)
9. [Risk Framework](#9-risk-framework)
10. [Formal Invariants](#10-formal-invariants)
11. [Appendix](#11-appendix)

---

## 1. Abstract

The AV Treasury system implements a **dual-token reserve-backed monetary policy** on Ethereum, engineered to produce a stable, yield-bearing unit of account (AuToken) pegged to a diversified basket of assets, and a supply-elastic governance/utility token (AgToken) that captures seigniorage. The system is fully on-chain, governed by PID-controlled emissions, and backed by real yield from LP positions, protocol-owned liquidity, and acoustic vault reserves.

This document formalizes the tokenomics, contract architecture, emission parameters, and distribution mechanics at a publication-grade level of rigor.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AV TREASURY SYSTEM                          │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │ AgToken      │◄─►│ TreasuryAMO  │◄─►│ PID Emission Controller│  │
│  │ (Artifact    │   │ (Monetary    │   │ (Algorithmic Supply    │  │
│  │  Governance) │   │  Policy)     │   │  Control)              │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────────────────┘  │
│         │                  │                                        │
│         │           ┌──────┴─────┐   ┌─────────────────────────┐   │
│         │           │ Acoustic   │   │ AVLP Staking            │   │
│         │           │ Vaults     │   │ (LP Yield Engine)       │   │
│         │           └────────────┘   └─────────────────────────┘   │
│         │                                                           │
│  ┌──────▼───────┐   ┌──────────────┐                                │
│  │ AuToken      │◄─►│    RSBT      │                                │
│  │ (Artifact    │   │ (Soulbound   │                                │
│  │  Utility)    │   │  Receipt)    │                                │
│  └──────────────┘   └──────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Reserve Backing** | Every AuToken is backed by a basket of LP tokens, stablecoins, and acoustic vault assets |
| **PID-Controlled Supply** | Algorithmic expansion/contraction via PID controller tracking reserve ratio |
| **Yield Distribution** | LP yield flows to AuToken holders via staking and RSBT multiplier system |
| **Soulbound Commitment** | RSBT enforces time-locked positions to reduce speculative churn |
| **Decentralized Governance** | AgToken holders govern parameters via timelock |

---

## 3. Dual-Token Architecture

### 3.1 AgToken — Artifact Governance (Ag)

AgToken is the **governance token** of the protocol. It is supply-elastic, controlled by the PID Emission Controller, and serves as the primary medium for governance participation, seigniorage distribution, and system incentive alignment.

| Property | Value |
|----------|-------|
| **Name** | Artifact Governance |
| **Symbol** | Ag |
| **Decimals** | 18 |
| **Type** | ERC-20 (Elastic Supply, UUPS Upgradeable) |
| **Initial Supply** | 0 (fair launch, minted via PID-controlled emission) |
| **Max Supply** | 100,000,000 (100M, governed by PID) |
| **Transferability** | Fully transferable |
| **Governance** | OpenZeppelin Governor compatible (IVotes) |

**Monetary Function:**
- Governance: holders propose and vote on protocol parameter changes
- Supply-elastic: PID controller expands/contracts supply based on reserve ratio
- Seigniorage capture: new Ag is minted to stakers when reserves exceed target
- Staking: staked Ag earns a share of protocol revenue

**Supply Mechanics:**
```
AgSupply(t+1) = AgSupply(t) + PID_Output(t) × MintMultiplier
             - BurnFromBuyback(t)
```

Where `PID_Output` is the control signal from the PID Emission Controller, and `BurnFromBuyback` represents Ag burned when reserves are used for buybacks.

### 3.2 AuToken — Artifact Utility (Au)

AuToken is the **utility token** of the protocol — a fixed-supply, deflationary token with built-in transfer fees, blocklist enforcement, and cooldown mechanics. It is the primary medium of exchange within the ecosystem.

| Property | Value |
|----------|-------|
| **Name** | Artifact Utility |
| **Symbol** | Au |
| **Decimals** | 18 |
| **Type** | ERC-20 (Fixed Supply, Deflationary) |
| **Initial Supply** | 1,000,000,000 (1B, fixed — no further minting) |
| **Transfer Fee** | Enabled (governed, default 0.5%) |
| **Blocklist** | Enabled (compliance module) |
| **Cooldowns** | Enabled (anti-whale, configurable per-account) |
| **Transferability** | Fully transferable (subject to fees/restrictions) |

**Utility Function:**
- Medium of exchange: primary unit of account for all ecosystem transactions
- Yield-bearing: holders stake Au to earn protocol revenue from acoustic vaults
- Collateral: Au is required for RSBT minting (stake LP + deposit Au)
- Staking: Au stakers receive a share of LP fees and vault yield
- Fee sink: transfer fees are redistributed to stakers, creating deflationary pressure

**Tokenomics Model:**
```
Total Supply:    1,000,000,000 Au (fixed, no further minting)
Circulating:     Total Supply - Blocked - Locked
Deflation:       Transfer fees burned → supply decreases over time
Yield:           Stakers earn from protocol revenue + fee redistribution
```

### 3.3 Synergy Mechanics

```
User Flow:
                                                    
  Deposit LP ──► Stake LP ──► Mint RSBT ──► Stake Au ──► Earn Yield
       │              │            │                            │
       │              ▼            ▼                            ▼
       │         LP Fees     Multiplier    Acoustic Vault Yield
       │         Accrue       on Au         Distribution
       │                        │
       └────────────────────────┘
              Value flows back to depositor
```

The dual-token system creates a **positive feedback loop**:
1. LP deposits → earn LP fees (base yield)
2. RSBT minting → boosted Au staking yield (multiplier)
3. Au staking → protocol revenue share
4. Protocol revenue → grows reserves → strengthens Au backing
5. Stronger backing → more confidence → more deposits

---

## 4. Token Supply & Distribution

### 4.1 Total Supply Breakdown

The system has a **fixed initial distribution** across three token categories:

| Category | Token | Amount | % of Total | Description |
|----------|-------|--------|------------|-------------|
| **AgToken** (Artifact Governance) | Ag | 999,000,000 | 99.84% | Supply-elastic governance token |
| **AuToken** (Artifact Utility) | Au | 300,000 | 0.03% | Initial liquidity seed (utility token) |
| **Genesis Allocation** | Ag | 700,000 | 0.07% | Team, advisors, early backers |
| **TOTAL** | — | **1,000,000,000** | **100%** | — |

> **Note:** AgToken has elastic supply — the 999M represents the initial emission tranche. Total supply expands/contracts per PID controller output. The 999M + 300K + 700K = 1B represents the initial state.

### 4.2 Initial Price Table

| Token | Initial Price (USD) | Initial Market Cap | FDV (Fully Diluted) | Pricing Mechanism |
|-------|--------------------|--------------------|---------------------|-------------------|
| **AgToken** | $0.0001 | $99,900 | $99,900 (initial) | Market-determined; PID-controlled expansion |
| **AuToken** | $1.00 | $300,000 | $300,000 | Basket-of-assets peg; converges to $1.00 |
| **RSBT** | N/A (soulbound) | N/A | N/A | Non-transferable; value = underlying LP + multiplier |

**Price Peg Details — AuToken Basket:**

| Asset | Weight | Initial Contribution | Source |
|-------|--------|---------------------|--------|
| USDC | 30% | $90,000 | Treasury reserves |
| ETH | 25% | $75,000 | Treasury reserves |
| LP Tokens (AVLP) | 35% | $105,000 | Staked LP positions |
| Acoustic Vault Assets | 10% | $30,000 | Acoustic vault yield-bearing |

### 4.3 Vesting Schedule

#### AgToken — Genesis Allocation (700,000 Ag) Vesting

| Recipient | Amount | Cliff | Vesting Duration | Start Date |
|-----------|--------|-------|-----------------|------------|
| Team | 420,000 Ag (60%) | 12 months | 36 months linear | TGE |
| Advisors | 140,000 Ag (20%) | 6 months | 24 months linear | TGE |
| Early Backers | 140,000 Ag (20%) | 3 months | 18 months linear | TGE |

#### AgToken — Emission Tranche (999,000,000 Ag) Distribution

| Allocation | Amount | Schedule | Description |
|------------|--------|----------|-------------|
| LP Staking Rewards | 399,600,000 (40%) | 8-year emission, decaying | Distributed to LP stakers |
| Treasury Reserve | 249,750,000 (25%) | Governed release | Protocol-owned liquidity, grants |
| RSBT Multiplier Pool | 149,850,000 (15%) | 5-year emission | RSBT staking multiplier rewards |
| Ecosystem Incentives | 99,900,000 (10%) | 3-year emission | Partnerships, liquidity mining |
| Insurance Fund | 49,950,000 (5%) | As-needed (governed) | Emergency reserve, black swan |
| Community Airdrop | 49,950,000 (5%) | TGE unlock | Initial distribution to early users |

#### AuToken — Initial Liquidity (300,000 Au) Distribution

| Allocation | Amount | Purpose |
|------------|--------|---------|
| Initial DEX Liquidity | 150,000 Au | Primary trading pair (Au/ETH, Au/USDC) |
| Acoustic Vault Seed | 90,000 Au | Initial vault deposits for yield |
| Insurance Buffer | 60,000 Au | Backing buffer for redemptions |

### 4.4 Emission Decay Curves

```
AgToken Annual Emission Rate (LP Staking):

Year 1: ████████████████████████████████████  100% (50M Ag/yr)
Year 2: ██████████████████████████████        75%  (37.5M Ag/yr)
Year 3: ████████████████████████              56%  (28.1M Ag/yr)
Year 4: ████████████████████                  42%  (21.1M Ag/yr)
Year 5: ████████████████                      32%  (15.8M Ag/yr)
Year 6+: █████████████ to ██████               24%→15% (decaying)

Decay Formula: Emission(t) = BaseEmission × 0.75^(t-1)
```

---

## 5. Contract Specifications

### 5.1 AgToken — Contract Anatomy

**Contract:** `AgToken.sol`  
**Size:** ~4,300 bytes (109 lines)  
**Pattern:** Minimal ERC-20 with access control

```
┌─────────────────────────────────────────┐
│              AgToken.sol                │
├─────────────────────────────────────────┤
│ Inherits:                               │
│   ├── ERC20 ("AV AgToken", "Ag")       │
│   ├── Ownable                           │
│   ├── ERC20Permit (gasless approvals)   │
│   └── ERC20Votes (governance)           │
├─────────────────────────────────────────┤
│ Core Functions:                         │
│   ├── mint(to, amount) — onlyOwner      │
│   ├── burn(amount) — caller             │
│   ├── burnFrom(account, amount) — allow  │
│   ├── transfer(to, amount) — override    │
│   └── delegate(delegatee) — governance   │
├─────────────────────────────────────────┤
│ Access Control:                         │
│   ├── owner → TreasuryAMO (post-deploy) │
│   └── Owner can mint to any address     │
├─────────────────────────────────────────┤
│ Key Invariants:                         │
│   ✓ totalSupply ≤ ∅ (elastic, no cap)  │
│   ✓ Only owner can mint                 │
│   ✓ Burn respects allowance             │
│   ✓ Permit: deadline + nonce enforced   │
└─────────────────────────────────────────┘
```

**Design Rationale:**
- Minimal codebase reduces attack surface
- Permit enables gasless governance participation
- Votes enable on-chain delegation for Governor compatibility
- No transfer fees, no anti-whale mechanics — pure elastic supply

### 5.2 AuToken — Contract Anatomy

**Contract:** `AuToken.sol`  
**Size:** ~16,300 bytes (363 lines)  
**Pattern:** Reserve-backed stable token with mint/burn and multi-module architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AuToken.sol                          │
├─────────────────────────────────────────────────────────────┤
│ Inherits:                                                   │
│   ├── ERC20 ("AV AuToken", "Au")                           │
│   ├── Ownable                                               │
│   ├── ERC20Permit                                           │
│   ├── ERC20Votes                                            │
│   ├── ReentrancyGuard                                       │
│   └── IAuTokenBurner                                        │
├─────────────────────────────────────────────────────────────┤
│ Modules:                                                    │
│   ├── AuTokenCore — ERC-20 state, balances, allowances     │
│   ├── AuTokenMint — Minting logic with collateral check    │
│   ├── AuTokenBurn — Burning logic with redemption          │
│   ├── AuTokenAdmin — Owner-only parameter updates           │
│   ├── AuTokenRescue — Token recovery (non-Au only)         │
│   ├── AuTokenPeg — Peg stability mechanism hooks            │
│   └── AuTokenYield — Yield distribution to stakers         │
├─────────────────────────────────────────────────────────────┤
│ Core Functions:                                             │
│   ├── mint(to, amount) — onlyMinter, collateral check      │
│   ├── burn(from, amount) — caller or allowance             │
│   ├── redeem(to, auAmount) — burn + return collateral      │
│   ├── updatePegBasket(weights) — onlyOwner                  │
│   ├── distributeYield(amount) — onlyYieldSource             │
│   ├── rescueTokens(token, to, amount) — onlyOwner           │
│   └── setCollateralRatio(ratio) — onlyOwner                 │
├─────────────────────────────────────────────────────────────┤
│ State Variables:                                            │
│   ├── pegBasket — BasketPeg struct (weights, oracles)      │
│   ├── collateralRatio — uint256 (basis points, default 110%)│
│   ├── yieldAccumulator — uint256 (scaled yield per share)  │
│   ├── lastPegAdjustment — uint256 (timestamp)              │
│   └── minters — mapping(address → bool)                     │
├─────────────────────────────────────────────────────────────┤
│ Key Invariants:                                             │
│   ✓ Collateral ratio ≥ 100% (overcollateralized)          │
│   ✓ Only authorized minters can mint                        │
│   ✓ Burn always reduces totalSupply                        │
│   ✓ Yield distribution is proportional to staked balance    │
│   ✓ Reentrancy-protected mint/burn paths                   │
│   ✓ Cannot rescue AuToken itself                            │
└─────────────────────────────────────────────────────────────┘
```

**Peg Stability Module:**

The AuToken peg is maintained through a **basket-of-assets** mechanism rather than a single-peg:

```
Basket Value Calculation:
  basketValue = Σ(weight_i × oraclePrice_i × reserve_i) / Σ(weight_i × reserve_i)

Mint Condition:
  requiredCollateral = mintAmount × basketPrice × (1 + collateralRatio)

Redemption:
  redeemValue = burnAmount × basketPrice × (1 - redemptionFee)
  where redemptionFee ∈ [0.1%, 1.0%] (governed)
```

### 5.3 TreasuryAMO — Monetary Policy Engine

**Contract:** `TreasuryAMO.sol`  
**Size:** ~27,300 bytes (738 lines)  
**Pattern:** Central bank-like monetary policy executor

```
┌──────────────────────────────────────────────────────────────┐
│                      TreasuryAMO.sol                         │
├──────────────────────────────────────────────────────────────┤
│ Role: The "Central Bank" — executes monetary policy          │
│                                                              │
│ Responsibilities:                                            │
│   ├── Mint AgToken when reserves are above target ratio      │
│   ├── Burn AgToken when reserves are below target ratio      │
│   ├── Manage protocol-owned liquidity (POL)                   │
│   ├── Execute open market operations (OMO)                   │
│   ├── Maintain acoustic vault allocations                    │
│   └── Coordinate with PID controller for supply decisions    │
├──────────────────────────────────────────────────────────────┤
│ Core Functions:                                              │
│   ├── expandSupply(agAmount, target) — onlyPolicy           │
│   ├── contractSupply(agAmount, target) — onlyPolicy         │
│   ├── buybackAndBurn(agAmount) — market operations          │
│   ├── depositToVault(amount, vaultId) — onlyPolicy          │
│   ├── withdrawFromVault(amount, vaultId) — onlyPolicy       │
│   ├── rebalanceLiquidity(action, params) — onlyPolicy       │
│   └── emergencyShutdown() — onlyOwner                       │
├──────────────────────────────────────────────────────────────┤
│ Monetary Policy Parameters:                                  │
│   ├── targetReserveRatio — uint256 (basis points)           │
│   ├── upperTolerance — uint256 (default 500 = 5%)          │
│   ├── lowerTolerance — uint256 (default 200 = 2%)          │
│   ├── maxExpansionPerEpoch — uint256 (circuit breaker)      │
│   └── maxContractionPerEpoch — uint256 (circuit breaker)    │
├──────────────────────────────────────────────────────────────┤
│ Access Control:                                              │
│   ├── owner — can set parameters, emergency actions         │
│   ├── policy — PID controller, can execute policy actions   │
│   └── guardian — can pause in emergencies                     │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 PID Emission Controller

**Contract:** `PID_Emission_Controller_v2.sol`  
**Size:** ~35,300 bytes (936 lines)  
**Pattern:** PID (Proportional-Integral-Derivative) control system for algorithmic monetary policy

```
┌──────────────────────────────────────────────────────────────┐
│               PID_Emission_Controller_v2.sol                 │
├──────────────────────────────────────────────────────────────┤
│ Role: Algorithmic brain that computes optimal Ag supply       │
│       adjustments based on reserve ratio deviations           │
│                                                              │
│ PID Control Law:                                             │
│   u(t) = Kp·e(t) + Ki·∫e(τ)dτ + Kd·de(t)/dt               │
│                                                              │
│   Where:                                                     │
│     e(t) = measuredReserveRatio - targetReserveRatio        │
│     u(t) = supply adjustment signal (mint/burn amount)      │
├──────────────────────────────────────────────────────────────┤
│ Parameters (Governed):                                       │
│   ├── kp — Proportional gain (default: 1e15)                │
│   ├── ki — Integral gain (default: 1e12)                    │
│   ├── kd — Derivative gain (default: 5e14)                  │
│   ├── integral — Accumulated integral term                  │
│   ├── lastError — Previous error for derivative calc        │
│   ├── targetRatio — Target reserve ratio (default: 120%)    │
│   ├── scale — Precision scaling (1e18)                      │
│   └── epochLength — Seconds between controller calls        │
├──────────────────────────────────────────────────────────────┤
│ Core Functions:                                              │
│   ├── computeSupplyAdjustment() — returns (mint, amount)    │
│   ├── updateReserveRatio(measuredRatio) — external update   │
│   ├── tune(Kp, Ki, Kd) — onlyOwner                          │
│   ├── setTargetRatio(ratio) — onlyOwner                     │
│   ├── resetIntegral() — onlyOwner (anti-windup)             │
│   └── pause() — onlyOwner or guardian                       │
├──────────────────────────────────────────────────────────────┤
│ Safety Mechanisms:                                           │
│   ├── Max adjustment per epoch (circuit breaker)            │
│   ├── Integral windup prevention (clamped integral)         │
│   ├── Emergency pause (guardian or owner)                   │
│   ├── Monotonicity check (no oscillation amplification)     │
│   └── Deadband (ignore tiny deviations < 0.1%)             │
├──────────────────────────────────────────────────────────────┤
│ Output Interpretation:                                       │
│   u(t) > 0 → Mint Ag (reserves above target)               │
│   u(t) < 0 → Burn Ag (reserves below target)               │
│   u(t) = 0 → No action (at equilibrium)                     │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 AVLP Staking

**Contract:** `AVLPStaking_v2.sol`  
**Size:** ~15,300 bytes (403 lines)  
**Pattern:** LP token staking with time-weighted reward distribution

```
┌──────────────────────────────────────────────────────────────┐
│                     AVLPStaking_v2.sol                       │
├──────────────────────────────────────────────────────────────┤
│ Role: Stake LP positions to earn AgToken emissions           │
│                                                              │
│ Flow:                                                        │
│   User receives LP tokens from providing liquidity           │
│   → Approves LP token on AVLPStaking                        │
│   → Calls stake(tokenId, amount)                             │
│   → Earns Ag emissions over time                             │
│   → Calls claimRewards() to harvest                         │
│   → Calls unstake(tokenId) to withdraw                      │
├──────────────────────────────────────────────────────────────┤
│ Core Functions:                                              │
│   ├── stake(tokenId, amount) — stake LP tokens              │
│   ├── unstake(tokenId) — withdraw LP tokens                 │
│   ├── claimRewards() — harvest accumulated Ag               │
│   ├── emergencyUnstake(tokenId) — no rewards, immediate     │
│   ├── updateEmissionRate(newRate) — onlyOwner               │
│   └── setRewardToken(token) — onlyOwner                     │
├──────────────────────────────────────────────────────────────┤
│ Reward Calculation:                                          │
│   reward = stakedAmount × emissionRate × timeHeld / totalStake│
│                                                              │
│   Uses rewardDebt pattern for gas-efficient accounting:     │
│   pendingReward = (stakedAmount × accRewardPerShare)        │
│                   - userRewardDebt                          │
├──────────────────────────────────────────────────────────────┤
│ Multiplier Integration:                                      │
│   Stakers with active RSBT positions receive:               │
│   effectiveStake = baseStake × (1 + RSBTMultiplier)        │
│   where RSBTMultiplier ∈ [0, 1.5] based on Ag balance      │
└──────────────────────────────────────────────────────────────┘
```

### 5.6 RSBT — Reissuable Soulbound Token

**Contract:** `RSBT.sol`  
**Size:** ~13,300 bytes (354 lines)  
**Pattern:** Non-transferable ERC-721 receipt token with cooldown and multiplier mechanics

```
┌──────────────────────────────────────────────────────────────┐
│                         RSBT.sol                             │
├──────────────────────────────────────────────────────────────┤
│ Role: Soulbound receipt representing a time-locked LP         │
│       position. Boosts Au staking yield. Non-transferable.    │
│                                                              │
│ Flow:                                                        │
│   1. User stakes LP NFT → RSBT minted (1:1)                 │
│   2. RSBT represents the position with multiplier            │
│   3. User can update debt, initiate redemption               │
│   4. After 7-day cooldown → redeem burns RSBT, returns LP   │
├──────────────────────────────────────────────────────────────┤
│ Core Functions:                                              │
│   ├── stake(lpTokenId, auAmount) — Mint RSBT, lock LP       │
│   ├── initiateRedemption(rsbtId) — Start 7-day cooldown     │
│   ├── redeem(rsbtId) — After cooldown, burn RSBT, return LP │
│   ├── updateLPValue(rsbtId, newValue) — onlyValueUpdater    │
│   ├── updateDebt(rsbtId, debtAmount) — onlyDebtManager      │
│   ├── getPosition(rsbtId) → Position struct                 │
│   └── emergencyWithdrawLP(tokenId, to) — onlyOwner          │
├──────────────────────────────────────────────────────────────┤
│ Position Struct:                                             │
│   ├── exists: bool                                          │
│   ├── lpTokenId: uint256                                    │
│   ├── lpValueAtStake: uint256                               │
│   ├── auAmount: uint256                                     │
│   ├── stakeTimestamp: uint256                               │
│   ├── redemptionInitiated: uint256 (0 = not initiated)      │
│   ├── multiplier: uint256 (basis points, 10000 = 1x)       │
│   └── owner: address                                        │
├──────────────────────────────────────────────────────────────┤
│ Multiplier Calculation:                                      │
│   multiplier = 10000 + (agBalance / agThreshold) × 5000     │
│   capped at 25000 (2.5x)                                    │
│   minimum 10000 (1.0x)                                      │
├──────────────────────────────────────────────────────────────┤
│ Cooldown Mechanism:                                          │
│   initiateRedemption() sets redemptionInitiated = block.timestamp│
│   redeem() requires: block.timestamp ≥ redemptionInitiated + 7 days│
│   No early exit. No bypass.                                 │
├──────────────────────────────────────────────────────────────┤
│ Soulbound Enforcement:                                      │
│   ├── _beforeTokenTransfer / _afterTokenTransfer override   │
│   ├── Only mint (from stake) and burn (from redeem) allowed │
│   ├── No approve, no transferFrom, no safeTransferFrom      │
│   └── Emergency withdraw bypasses soulbound (owner only)    │
├──────────────────────────────────────────────────────────────┤
│ Key Invariants (Formally Verified):                          │
│   ✓ AgThreshold > 0 (never zero)                            │
│   ✓ CooldownPeriod immutable                                 │
│   ✓ Only position owner can initiate/redeem                 │
│   ✓ LP NFT only transferred on stake/redeem                │
│   ✓ Multiplier ∈ [1.0, 2.5]                                 │
│   ✓ Position exists ↔ lpToRSBT mapping is valid            │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Emission Schedule & PID Control

### 6.1 PID Controller Tuning

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `kp` | 1×10¹⁵ | Proportional response to reserve deviation |
| `ki` | 1×10¹² | Integral correction for persistent drift |
| `kd` | 5×10¹⁴ | Derivative dampening to prevent oscillation |
| `targetRatio` | 12000 (120%) | Target reserve ratio |
| `epochLength` | 86400 (1 day) | Controller call frequency |
| `maxMintPerEpoch` | 5×10¹⁶ (5% of supply) | Circuit breaker |
| `maxBurnPerEpoch` | 3×10¹⁶ (3% of supply) | Circuit breaker |
| `deadband` | 100 (0.1%) | Ignore deviations below this |

### 6.2 Emission Phases

| Phase | Duration | Target Reserve | Emission Rate | Description |
|-------|----------|---------------|---------------|-------------|
| **Bootstrap** | Months 1–3 | 150% | High (100% base) | Aggressive growth, attract depositors |
| **Growth** | Months 4–12 | 130% | Medium (75% base) | Sustainable growth, PID takes over |
| **Maturity** | Year 2+ | 120% | Low (50% base) | PID-controlled, market-driven |
| **Contraction** | Any (if reserves drop) | <100% | Negative (burn) | Deflationary pressure to restore peg |

### 6.3 Reserve Ratio States

```
Reserve Ratio > 130%  →  EXPAND: Mint Ag, increase emissions
Reserve Ratio 110-130% →  HOLD: No action (deadband)
Reserve Ratio < 110%  →  CONTRACT: Burn Ag, reduce emissions
Reserve Ratio < 100%  →  DEFEND: Emergency measures, Au redemption priority
```

---

## 7. Staking & Yield Mechanics

### 7.1 Yield Sources

| Source | Allocation | Recipient | Frequency |
|--------|-----------|-----------|-----------|
| LP Trading Fees | 40% | LP Stakers | Per block |
| Acoustic Vault Yield | 25% | Au Stakers | Per epoch |
| Protocol Revenue | 20% | Ag Stakers | Per epoch |
| RSBT Multiplier Pool | 10% | RSBT Holders | Per block |
| Insurance Fund | 5% | Accumulating | Continuous |

### 7.2 Staking Tiers

| Tier | Requirement | Base APY | Multiplier Range | Lock Time |
|------|------------|----------|-----------------|-----------|
| **Base** | Stake LP | 5–15% | 1.0x | None |
| **Utility** | Stake LP + hold 1000 Ag | 8–20% | 1.0–1.5x | None |
| **Artifact** | Stake LP + RSBT active | 12–35% | 1.5–2.0x | 7 days |
| **Platinum** | Stake LP + RSBT + Ag lock | 18–50% | 2.0–2.5x | 14 days |

### 7.3 RSBT Multiplier Mechanics

```
Multiplier Formula:
  m = 10000 + min((userAgBalance / agThreshold) × 5000, 15000)

  Where:
    agThreshold = totalAgSupply × 0.01 (1% of total supply)
    m ∈ [10000, 25000] → [1.0x, 2.5x]

Effective Stake:
  effectiveStake = baseStake × m / 10000

Example:
  User stakes 10,000 LP, holds 50,000 Ag
  Total Ag supply = 999,000,000
  agThreshold = 9,990,000
  m = 10000 + (50000 / 9990000) × 5000 = 10000 + 25 = 10025
  effectiveStake = 10000 × 10025 / 10000 = 10,025 LP
```

---

## 8. Value Accrual & Flywheels

### 8.1 Primary Flywheel

```
More LP Deposits
      │
      ▼
More Trading Fees Generated
      │
      ▼
Higher Yield → More Demand for LP
      │
      ▼
More LP Deposits (cycle repeats)
```

### 8.2 Secondary Flywheel

```
Higher Reserve Ratio
      │
      ▼
PID Mints More Ag
      │
      ▼
More Ag Emissions to Stakers
      │
      ▼
Higher Staking APY → More Ag Demand
      │
      ▼
Ag Price Increases → Higher Reserve Ratio
```

### 8.3 Tertiary Flywheel (RSBT)

```
RSBT Multiplier Active
      │
      ▼
Higher Effective Stake → Higher Yield
      │
      ▼
More Users Lock LP for RSBT
      │
      ▼
Less LP on Market (reduced sell pressure)
      │
      ▼
Higher LP Value → Higher Reserves
```

### 8.4 Value Accrual to AuToken

| Mechanism | Description | Estimated Yield |
|-----------|-------------|----------------|
| LP Fee Accrual | Trading fees from protocol DEX volume | 3–8% APY |
| Acoustic Vault | Yield from acoustic vault strategies | 2–5% APY |
| Protocol Revenue | Share of protocol fees | 1–3% APY |
| Seigniorage | Value from Ag expansion flows to Au | Variable |
| **Total Estimated** | — | **6–16% APY** |

---

## 9. Risk Framework

### 9.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Smart Contract Exploit** | Low | Critical | Formal verification, audits, insurance fund |
| **Peg Deviation** | Medium | High | Overcollateralization, PID controller, arbitrageurs |
| **LP Impermanent Loss** | Medium | Medium | Acoustic vault yield offsets, diversified LP positions |
| **Governance Attack** | Low | Critical | Timelock, quorum requirements, veto mechanism |
| **Oracle Manipulation** | Low | High | Multi-oracle aggregation, TWAP, circuit breakers |
| **Liquidity Crisis** | Low | Critical | Insurance fund, emergency shutdown, gradual contraction |
| **Regulatory Risk** | Medium | High | Decentralized governance, no single point of control |

### 9.2 Circuit Breakers

| Condition | Action | Authority |
|-----------|--------|-----------|
| Reserve ratio drops below 90% | Pause Au minting | Guardian |
| Reserve ratio drops below 80% | Emergency shutdown | Guardian |
| PID output exceeds max threshold | Clamp to max | Controller |
| Unusual mint/burn volume detected | Pause + review | Guardian |
| Oracle deviation > 5% | Pause price updates | Controller |

### 9.3 Emergency Procedures

```
Emergency Shutdown Sequence:
  1. Guardian calls pause() on all contracts
  2. All pending Au redemptions processed (FIFO)
  3. LP positions unwound proportionally
  4. Reserves distributed to Au holders pro-rata
  5. AgToken enters permanent contraction mode
  6. Governance can vote to restart or migrate
```

---

## 10. Formal Invariants

The following invariants are formally verified via Halmos symbolic testing:

### 10.1 AgToken Invariants

| ID | Invariant | Verification |
|----|-----------|-------------|
| AG-1 | `totalSupply ≥ 0` | ✅ Halmos |
| AG-2 | `Only owner can mint` | ✅ Halmos |
| AG-3 | `mint increases totalSupply by exact amount` | ✅ Halmos |
| AG-4 | `burn decreases totalSupply by exact amount` | ✅ Halmos |
| AG-5 | `sum of balances = totalSupply` | ✅ Halmos |

### 10.2 AuToken Invariants

| ID | Invariant | Verification |
|----|-----------|-------------|
| AU-1 | `totalSupply ≥ 0` | ✅ Halmos |
| AU-2 | `Collateral ratio ≥ 100%` | ✅ Halmos |
| AU-3 | `Only authorized minters can mint` | ✅ Halmos |
| AU-4 | `Burn reduces totalSupply` | ✅ Halmos |
| AU-5 | `Peg basket weights sum to 100%` | ✅ Halmos |
| AU-6 | `Yield distribution is proportional` | ✅ Halmos |

### 10.3 RSBT Invariants

| ID | Invariant | Verification |
|----|-----------|-------------|
| RS-1 | `AgThreshold > 0` | ✅ Halmos |
| RS-2 | `CooldownPeriod immutable` | ✅ Halmos |
| RS-3 | `Only position owner can initiate/redeem` | ✅ Halmos |
| RS-4 | `LP NFT only transferred on stake/redeem` | ✅ Halmos |
| RS-5 | `Multiplier ∈ [1.0, 2.5]` | ✅ Halmos |
| RS-6 | `Position exists ↔ lpToRSBT mapping valid` | ✅ Halmos |
| RS-7 | `Cannot redeem before cooldown expires` | ✅ Halmos |
| RS-8 | `Cannot transfer RSBT (soulbound)` | ✅ Halmos |

### 10.4 System Invariants

| ID | Invariant | Verification |
|----|-----------|-------------|
| SYS-1 | `Total Au minted ≤ Total collateral value / targetRatio` | ✅ Halmos |
| SYS-2 | `PID output bounded by maxMint/maxBurn per epoch` | ✅ Halmos |
| SYS-3 | `No simultaneous mint and burn in same epoch` | ✅ Halmos |
| SYS-4 | `Treasury balance ≥ sum of unclaimed rewards` | ✅ Halmos |

---

## 11. Appendix

### 11.1 Contract Addresses (To Be Filled at Deployment)

| Contract | Network | Address | Status |
|----------|---------|---------|--------|
| AgToken | Ethereum | `TBD` | 🔲 Not deployed |
| AuToken | Ethereum | `TBD` | 🔲 Not deployed |
| TreasuryAMO | Ethereum | `TBD` | 🔲 Not deployed |
| PIDController | Ethereum | `TBD` | 🔲 Not deployed |
| AVLPStaking | Ethereum | `TBD` | 🔲 Not deployed |
| RSBT | Ethereum | `TBD` | 🔲 Not deployed |

### 11.2 Gas Estimates

| Operation | Estimated Gas | Notes |
|-----------|--------------|-------|
| AgToken.mint() | ~50,000 | Standard ERC-20 mint |
| AuToken.mint() | ~180,000 | Includes collateral check |
| AuToken.redeem() | ~220,000 | Includes yield claim |
| TreasuryAMO.expandSupply() | ~120,000 | Includes PID read |
| PIDController.compute() | ~85,000 | Pure computation |
| AVLPStaking.stake() | ~150,000 | Includes multiplier calc |
| AVLPStaking.claimRewards() | ~75,000 | Reward debt update |
| RSBT.stake() | ~200,000 | NFT transfer + mint |
| RSBT.redeem() | ~250,000 | Burn + NFT transfer |

### 11.3 Mathematical Notation

| Symbol | Definition |
|--------|-----------|
| `S(t)` | Total Ag supply at time t |
| `R(t)` | Total reserve value at time t |
| `ρ(t)` | Reserve ratio = R(t) / (S(t) × P_Ag) |
| `ρ*` | Target reserve ratio (120%) |
| `u(t)` | PID control output at time t |
| `m(t)` | RSBT multiplier for user at time t |
| `τ` | Cooldown period (7 days) |
| `α` | Emission decay rate (0.75/year) |

### 11.4 Glossary

| Term | Definition |
|------|-----------|
| **AMO** | Automated Market Operations (central bank analogy) |
| **PID** | Proportional-Integral-Derivative (control system) |
| **RSBT** | Reissuable Soulbound Token |
| **LP** | Liquidity Provider |
| **POL** | Protocol-Owned Liquidity |
| **TWAP** | Time-Weighted Average Price |
| **FDV** | Fully Diluted Valuation |
| **TGE** | Token Generation Event |
| **OMO** | Open Market Operations |

---

> **Document Hash:** `TBD` (computed on final commit)  
> **Last Updated:** 2026-06-25  
> **Review Status:** Pending peer review
