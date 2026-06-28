# AV Treasury — Technical Architecture

*Definitive technical reference for the AV Treasury decentralized central banking protocol on Base (Ethereum L2).*

**Solidity:** 0.8.20 | **Chain:** Base (8453) | **Upgradeability:** UUPS | **License:** MIT

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Contract Inventory](#3-contract-inventory)
4. [Data Flow](#4-data-flow)
5. [Monetary Policy Engine](#5-monetary-policy-engine)
6. [AMO Module](#6-amo-module)
7. [Oracle Module](#7-oracle-module)
8. [Governance Module](#8-governance-module)
9. [Token Module](#9-token-module)
10. [Flash Buy Module](#10-flash-buy-module)
11. [Staking Module](#11-staking-module)
12. [Security Architecture](#12-security-architecture)
13. [Upgradeability](#13-upgradeability)
14. [Gas Architecture](#14-gas-architecture)
15. [Integration Points](#15-integration-points)

---

## 1. Executive Summary

The AV Treasury is a decentralized central banking protocol that algorithmically manages a dual-token monetary system — **Au** (utility token with demurrage-like fee mechanics) and **Ag** (governance token with algorithmic emission) — to achieve price stability, sustainable growth, and community governance. The system implements a **PID-controlled emission controller** that adjusts Ag minting based on Total Value Locked (TVL) feedback, an **Automated Market Operations (AMO)** module that conducts on-chain buybacks analogous to central bank open market operations, a **multi-layered oracle system** combining TWAP primary feeds with Chainlink fallback and automated below-peg buyback triggers, and a **governance pipeline** (GovernorContract → 48h Timelock → Treasury Safe) that ensures all parameter changes and upgrades are subject to time-delayed, community-approved execution. The protocol captures value through a 9 basis point transfer fee on Au (split 50/50 between burn and treasury accumulation), deploys accumulated reserves for automated liquidity provision and buybacks, and incentivizes long-term alignment via Ag-boosted LP staking with a 1x–2.5x multiplier.

---

## 2. System Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                           AV TREASURY — SYSTEM ARCHITECTURE                      ║
╚══════════════════════════════════════════════════════════════════════════════════╝

                              ┌─────────────────────────┐
                              │     GovernorContract     │
                              │  Governor + TimelockCtrl │
                              │  Voting: Ag (ERC20Votes) │
                              │  Delay: 1 block          │
                              │  Period: 216k blocks     │
                              │  Quorum: 4%              │
                              │  Approval: 66% / 80%     │
                              └────────────┬────────────┘
                                           │ PROPOSER + EXECUTOR
                                           ▼
                              ┌─────────────────────────┐
                              │   ArtifactTimelock       │
                              │   MIN_DELAY: 48 hours    │
                              │   MAX_DELAY: 30 days     │
                              │   GRACE_PERIOD: 14 days  │
                              └────────────┬────────────┘
                                           │ Queued Operations
                                           ▼
                              ┌─────────────────────────┐
                              │     Treasury Safe        │
                              │   (DAO Treasury Vault)   │
                              └────────────┬────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
   ┌──────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
   │  PID_Emission_v2  │      │    TreasuryAMO       │      │  AVLPStaking_v2  │
   │  kp, ki, kd       │      │  Buybacks            │      │  LP NFT Staking  │
   │  targetTVL        │      │  Liquidity Mgmt      │      │  Au + Ag Rewards │
   │  daily cap: 100k  │      │  Reserve Management  │      │  Ag Multiplier   │
   │  single cap: 10k  │      │  Price Bands         │      │  1x → 2.5x       │
   └────────┬─────────┘      └──────────┬──────────┘      └────────┬─────────┘
            │ mints Ag                   │ buys Au                  │ earns Au+Ag
            │                            │                          │
            ▼                            ▼                          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                          CORE TOKEN LAYER                                 │
   │  ┌────────────────────────────┐    ┌────────────────────────────┐        │
   │  │        AuToken              │    │        AgToken              │        │
   │  │  ERC20 + Permit + FlashMint │    │  ERC20 + Permit + Votes    │        │
   │  │  9 bps fee (50% burn)       │    │  No genesis mint            │        │
   │  │  Anti-bot: cooldown, max tx  │    │  Algorithmic emission only  │        │
   │  │  Blocklist, max wallet       │    │  Delegatable voting power   │        │
   │  └────────────────────────────┘    └────────────────────────────┘        │
   └──────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────────────┐
                              │     Oracle System        │
                              │                          │
                              │  ┌───────────────────┐   │
                              │  │ AvOracle           │   │
                              │  │ TWAP-primary       │   │
                              │  │ Chainlink-fallback │   │
                              │  └────────┬──────────┘   │
                              │           │              │
                              │  ┌────────▼──────────┐   │
                              │  │ OracleWrapper      │   │
                              │  │ Deviation checks   │   │
                              │  │ Flash buy triggers │   │
                              │  └────────┬──────────┘   │
                              │           │              │
                              │  ┌────────▼──────────┐   │
                              │  │ OracleFlashBuy     │   │
                              │  │ Auto below-peg     │   │
                              │  │ buyback execution  │   │
                              │  └───────────────────┘   │
                              └─────────────────────────┘

                              ┌─────────────────────────┐
                              │    Flash Buy System      │
                              │                          │
                              │  TreasuryFlashBuy        │
                              │  OracleFlashBuy          │
                              │  FlashLoan               │
                              └─────────────────────────┘

                              ┌─────────────────────────┐
                              │    LP NFT Layer          │
                              │                          │
                              │  MockLPNFT (test)        │
                              │  Aerodrome LP NFT (prod) │
                              └─────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════╗
║                              VALUE FLOW (FLYWHEEL)                              ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   Au Transfer ──► 9 bps Fee                                                    ║
║        │                                                                       ║
║        ├── 4.5 bps ──► BURNED (deflationary pressure)                          ║
║        │                                                                       ║
║        └── 4.5 bps ──► Treasury Reserves                                       ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    TreasuryAMO Buyback                                         ║
║                    Reserve ──DEX──► Au (buy pressure)                           ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    Stakers Earn Au + Ag                                        ║
║                    Ag Multiplier Boosts Yield                                  ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    PID Adjusts Ag Emission                                     ║
║                    Based on TVL vs Target                                      ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    Ag Holders Govern                                           ║
║                    Propose → Vote → Timelock → Execute                         ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    System Grows → More Usage → More Fees                       ║
║                           │                                                    ║
║                           ▼                                                    ║
║                    ═══════ LOOP CLOSES ═══════                                 ║
║                                                                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Contract Inventory

### 3.1 Core Contracts

| Contract | File | Proxy Pattern | Role | Dependencies |
|---|---|---|---|---|
| `AuToken` | `contracts/av_suite/AuToken.sol` | UUPS | Utility token with fee-on-transfer, flash mint, anti-bot | None |
| `AgToken` | `contracts/av_suite/AgToken.sol` | UUPS | Governance token with algorithmic emission, voting | None |
| `ArtifactTimelock` | `contracts/av_suite/TimelockController.sol` | None (standalone) | 48h time-delayed operation queue | None |
| `AVLPStaking_v2` | `contracts/av_suite/AVLPStaking_v2.sol` | UUPS | LP NFT staking with Au+Ag rewards and Ag multiplier | AuToken, AgToken, IERC721 |
| `PID_Emission_Controller_v2` | `contracts/av_suite/PID_Emission_Controller_v2.sol` | None | PID-controlled Ag emission based on TVL feedback | AgToken, AVLPStaking_v2 |
| `TreasuryAMO` | `contracts/av_suite/TreasuryAMO.sol` | None | Automated buybacks and liquidity operations | AuToken, IERC20, DEX Router |
| `GovernorContract` | `contracts/av_suite/GovernorContract.sol` | UUPS | DAO governance with proposal/queue/execute pipeline | AgToken, ArtifactTimelock |

### 3.2 Oracle Contracts

| Contract | File | Proxy Pattern | Role | Dependencies |
|---|---|---|---|---|
| `AvOracle` | `contracts/av_suite/AvOracle.sol` | UUPS | TWAP-primary price feed with Chainlink fallback | Aerodrome Pool, Chainlink Aggregator |
| `OracleWrapper` | `contracts/av_suite/OracleWrapper.sol` | UUPS | Deviation validation, flash buy trigger conditions | AvOracle |
| `OracleFlashBuy` | `contracts/av_suite/OracleFlashBuy.sol` | None | Automated below-peg buyback execution | AvOracle, TreasuryFlashBuy |

### 3.3 Flash Buy Contracts

| Contract | File | Proxy Pattern | Role | Dependencies |
|---|---|---|---|---|
| `TreasuryFlashBuy` | `contracts/av_suite/TreasuryFlashBuy.sol` | None | Treasury-initiated flash buy operations | AuToken, DEX Router, FlashLoan |
| `FlashLoan` | `contracts/av_suite/FlashLoan.sol` | None | Flash loan facilitation for buyback capital | AuToken (ERC3156) |

### 3.4 Supporting Contracts

| Contract | File | Proxy Pattern | Role | Dependencies |
|---|---|---|---|---|
| `MockLPNFT` | `contracts/av_suite/MockLPNFT.sol` | None | Mock LP NFT for testing (replaced by Aerodrome NFT in production) | None |

### 3.5 Deployment Addresses (Base Mainnet)

> **Note:** Placeholder addresses. Updated upon deployment.

| Contract | Proxy Address | Implementation Address |
|---|---|---|
| AuToken | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| AgToken | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| ArtifactTimelock | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |
| AVLPStaking_v2 | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| PID_Emission_Controller_v2 | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |
| TreasuryAMO | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |
| GovernorContract | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| AvOracle | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| OracleWrapper | `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000` |
| OracleFlashBuy | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |
| TreasuryFlashBuy | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |
| FlashLoan | `0x0000000000000000000000000000000000000000` | N/A (no proxy) |

---

## 4. Data Flow

### 4.1 Price Data Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Aerodrome Pool  │     │  Chainlink       │     │  On-Chain        │
│  TWAP (primary)  │     │  Price Feed      │     │  Price Cache     │
│                  │     │  (fallback)      │     │                  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       │
    ┌────────────────────────────────────┐              │
    │           AvOracle                  │              │
    │  1. Query TWAP from Aerodrome pool  │              │
    │  2. If TWAP fails/staleness:        │              │
    │     → Fallback to Chainlink         │              │
    │  3. Return price + timestamp        │              │
    └────────────────┬───────────────────┘              │
                     │                                   │
                     ▼                                   │
    ┌────────────────────────────────────┐              │
    │         OracleWrapper               │◄─────────────┘
    │  1. Validate deviation < 5%        │   (cached price
    │  2. Compare TWAP vs Spot            │    for comparison)
    │  3. If deviation > threshold:       │
    │     → Flag manipulation            │
    │  4. If price < peg:                 │
    │     → Trigger flash buy            │
    └────────────────┬───────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ Treasury  │ │ PID      │ │ OracleFlash  │
   │ AMO       │ │ Emission │ │ Buy          │
   │ (buyback) │ │ (TVL     │ │ (below-peg   │
   │           │ │  check)  │ │  buyback)    │
   └──────────┘ └──────────┘ └──────────────┘
```

### 4.2 Emission Control Flow

```
┌──────────────────┐
│  AVLPStaking_v2   │
│  totalStakedValue │
│  (TVL)            │
└────────┬─────────┘
         │ TVL query
         ▼
┌──────────────────────────────────────────────────┐
│          PID_Emission_Controller_v2                │
│                                                   │
│  error = targetTVL - currentTVL                   │
│  P = kp × error                                   │
│  I = (I × 99/100) + ki × error  [decay + accum]  │
│  D = kd × (error - lastError)                     │
│  output = P + I + D                               │
│                                                   │
│  if output > MAX_SINGLE_EMISSION → clamp          │
│  if dailyEmitted ≥ MAX_DAILY → return 0           │
│  if output ≤ 0 → return 0 (no mint)               │
└────────────────┬─────────────────────────────────┘
                 │ Ag mint
                 ▼
         ┌──────────────┐
         │   AgToken     │
         │   mint(to,amt)│
         └──────────────┘
```

### 4.3 Buyback Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Treasury Reserves│     │  Oracle Price    │     │  TWAP Validation  │
│  (USDC, cbBTC)    │     │  (Au/USD)        │     │  (max 5% dev)     │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         ▼                        ▼                        │
    ┌──────────────────────────────────────┐              │
    │         TreasuryAMO                   │◄─────────────┘
    │                                       │
    │  1. Check 24h cooldown                │
    │  2. Validate TWAP (OracleWrapper)      │
    │  3. Calculate buyback amount:          │
    │     20% of (reserves - runway)         │
    │  4. Apply epoch cap (5% of reserve)    │
    │  5. Execute swap on Aerodrome          │
    │  6. Fallback to Uniswap on failure     │
    │  7. Slippage check (max 0.5%)          │
    └────────────────┬─────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │   AuToken     │
              │   Received    │
              │   (circulating│
              │    supply ↑)  │
              └──────────────┘
```

### 4.4 Governance Action Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Propose  │───►│  Voting  │───►│  Queue   │───►│ Timelock │───►│ Execute  │
│  (1 block │    │  Period  │    │ (enter   │    │  48h     │    │ (anyone) │
│  delay)   │    │  3 days  │    │  48h     │    │  delay)  │    │          │
│           │    │          │    │  queue)  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │                              │                │
     │          ┌────┴────┐                         │                │
     │          │ Quorum?  │                         │                │
     │          │ 66%/80%? │                         │                │
     │          └─────────┘                         │                │
     │                                              │                │
     │  Requirements:                               │  Effects:      │
     │  - 100k Ag threshold                         │  - Parameter   │
     │  - Ag voting power                           │    changes     │
     │  - Snapshot-based                            │  - Upgrades    │
     │                                              │  - Transfers   │
     └──────────────────────────────────────────────┴────────────────┘
```

---

## 5. Monetary Policy Engine

### 5.1 Overview

The PID (Proportional-Integral-Derivative) Emission Controller implements an algorithmic monetary policy that adjusts Ag token supply to maintain a target Total Value Locked (TVL). This mirrors how central banks adjust money supply in response to economic conditions.

### 5.2 PID Controller Mathematics

The controller computes an emission amount based on the difference between target and actual TVL:

```
e(t) = targetTVL - currentTVL(t)           [error signal]

u(t) = Kp·e(t) + Ki·∫e(τ)dτ + Kd·de(t)/dt  [PID output]

Where:
  Kp = Proportional gain (immediate response to error)
  Ki = Integral gain (accumulated error correction over time)
  Kd = Derivative gain (rate-of-change dampening)
```

### 5.3 Implementation

**File:** `contracts/av_suite/PID_Emission_Controller_v2.sol`

```solidity
struct PIDParams {
    int256 kp;           // Proportional gain (default: 1e15)
    int256 ki;           // Integral gain (default: 1e13)
    int256 kd;           // Derivative gain (default: 1e14)
    int256 integral;     // Accumulated integral term
    int256 lastError;    // Previous error for derivative calculation
    uint256 lastUpdate;  // Timestamp of last update
}

struct EmissionBounds {
    uint256 maxSingleEmission;   // Max per-call: 10,000 Ag (10k)
    uint256 maxDailyEmission;    // Max per-day: 100,000 Ag (100k)
    uint256 maxIntegral;         // Max integral magnitude: 1e24
    uint256 integralDecay;        // Decay factor: 99/100 per call
}
```

### 5.4 PID Algorithm (Detailed)

```solidity
function _calculateEmission() internal returns (uint256) {
    uint256 currentTVL = getCurrentTVL();          // From AVLPStaking
    int256 error = int256(targetTVL) - int256(currentTVL);

    // === PROPORTIONAL TERM ===
    // Immediate response: larger error → larger emission/burn
    int256 proportional = kp * error;

    // === INTEGRAL TERM ===
    // Decay prevents unbounded accumulation (99% retention per call)
    integral = (integral * integralDecay) / 100;
    integral += ki * error;

    // Clamp integral to prevent windup
    if (integral > int256(maxIntegral)) integral = int256(maxIntegral);
    if (integral < -int256(maxIntegral)) integral = -int256(maxIntegral);

    // === DERIVATIVE TERM ===
    // Dampens oscillation: responds to rate of change
    int256 derivative = kd * (error - lastError);
    lastError = error;

    // === COMBINE ===
    int256 output = proportional + integral + derivative;

    // === BOUNDS ===
    if (output <= 0) return 0;                    // No negative emission
    if (output > int256(maxSingleEmission))       // Per-call cap
        return maxSingleEmission;

    // === DAILY CAP ===
    _resetDailyIfNeeded();
    if (dailyEmitted >= maxDailyEmission) return 0;

    uint256 emission = uint256(output);
    if (dailyEmitted + emission > maxDailyEmission)
        emission = maxDailyEmission - dailyEmitted;

    dailyEmitted += emission;
    return emission;
}
```

### 5.5 Monetary Policy Modes

| Condition | PID Error | Emission | Policy Effect |
|---|---|---|---|
| TVL < Target | Positive | Mint Ag | Expansionary: incentivize staking |
| TVL = Target | Zero | Minimal | Neutral: equilibrium |
| TVL > Target | Negative | Zero | Contractionary: no new emission |
| TVL rapidly dropping | Large positive | Max single cap | Emergency expansion |

### 5.6 Parameter Table

| Parameter | Default Value | Bounds | Governance | Description |
|---|---|---|---|---|
| `targetTVL` | 10,000,000e18 | > 0 | Governor | Target TVL in USD terms |
| `kp` | 1e15 | 1e12 – 1e18 | Governor | Proportional gain |
| `ki` | 1e13 | 1e10 – 1e16 | Governor | Integral gain |
| `kd` | 1e14 | 1e11 – 1e17 | Governor | Derivative gain |
| `maxSingleEmission` | 10,000e18 | ≤ 100,000e18 | Governor | Max Ag minted per call |
| `maxDailyEmission` | 100,000e18 | ≤ 1,000,000e18 | Governor | Max Ag minted per day |
| `integralDecay` | 99/100 | 90/100 – 99/100 | Governor | Integral decay per call |
| `maxIntegral` | 1e24 | ≤ 1e27 | Governor | Max integral magnitude |

### 5.7 Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `agToken` | `AgToken` | Ag token contract reference |
| 1 | `stakingContract` | `AVLPStaking_v2` | Staking contract (TVL source) |
| 2 | `targetTVL` | `uint256` | Target TVL in USD (18 decimals) |
| 3 | `kp` | `int256` | Proportional gain |
| 4 | `ki` | `int256` | Integral gain |
| 5 | `kd` | `int256` | Derivative gain |
| 6 | `integral` | `int256` | Accumulated integral term |
| 7 | `lastError` | `int256` | Previous error value |
| 8 | `lastUpdate` | `uint256` | Last update timestamp |
| 9 | `dailyEmitted` | `uint256` | Ag emitted today |
| 10 | `dailyResetTime` | `uint256` | Daily counter reset timestamp |
| 11 | `emergencyStopped` | `bool` | Emergency stop flag |
| 12 | `pendingAdmin` | `address` | Two-step admin transfer |
| 13 | `maxIntegral` | `uint256` | Max integral value |

---

## 6. AMO Module

### 6.1 Overview

The **TreasuryAMO** (Automated Market Operations) module implements central bank-style open market operations. It manages treasury reserves to:

1. **Execute buybacks** — Purchase Au from DEX liquidity using accumulated reserves
2. **Provide liquidity** — Deploy reserves into Au/reserveToken liquidity pools
3. **Maintain price bands** — Intervene when Au price deviates beyond acceptable range
4. **Manage runway** — Ensure minimum operational reserves are always available

### 6.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        TreasuryAMO                                │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Reserve     │  │  Buyback    │  │  Liquidity              │  │
│  │  Manager     │  │  Engine     │  │  Provider               │  │
│  │             │  │             │  │                         │  │
│  │  - USDC     │  │  - 20% of   │  │  - Add/remove liquidity │  │
│  │  - cbBTC    │  │    excess    │  │  - Concentrated ranges  │  │
│  │  - Au       │  │  - 24h       │  │  - Fee collection       │  │
│  │             │  │    cooldown  │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────────┘  │
│         │                │                     │                  │
│         └────────────────┼─────────────────────┘                  │
│                          │                                        │
│                ┌─────────▼─────────┐                              │
│                │  DEX Router        │                              │
│                │  (Aerodrome /      │                              │
│                │   Uniswap)         │                              │
│                └───────────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Core Functions

```solidity
/// @notice Execute automated buyback using treasury reserves
/// @dev Called by keeper or governance. Validates TWAP before execution.
/// @return buybackAmount The amount of reserve tokens spent
/// @return auReceived The amount of Au received from the swap
function executeBuyback() external nonReentrant whenNotPaused
    returns (uint256 buybackAmount, uint256 auReceived);

/// @notice Calculate the available buyback amount
/// @return amount The reserve tokens available for buyback this epoch
function getBuybackAmount() public view returns (uint256 amount);

/// @notice Validate TWAP price against spot price
/// @return valid True if deviation is within acceptable bounds
function validateTWAP() public view returns (bool valid);

/// @notice Add liquidity to Au/reserveToken pool
/// @param reserveAmount Amount of reserve tokens to add
/// @param auAmount Amount of Au to add
function addLiquidity(uint256 reserveAmount, uint256 auAmount) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Remove liquidity from Au/reserveToken pool
/// @param lpAmount LP tokens to burn
function removeLiquidity(uint256 lpAmount) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Emergency withdraw tokens (only when paused)
function emergencyWithdraw(address token, address to, uint256 amount)
    external onlyRole(DEFAULT_ADMIN_ROLE);
```

### 6.4 Buyback Mechanics

```
Buyback Amount = min(
    20% × (totalReserves - runwayReserve),    // Sustainable amount
    5% × totalReserves,                         // Per-epoch cap
    availableReserves                           // Cannot exceed balance
)

Where:
  runwayReserve = minimum operational reserve (governance-set)
  20% = buybackBps / 10000
  5% = epochCapBps / 10000
```

### 6.5 Parameter Table

| Parameter | Default | Bounds | Description |
|---|---|---|---|
| `buybackBps` | 2000 (20%) | 0 – 5000 | % of excess reserves for buyback |
| `buybackCooldown` | 24 hours | 1h – 7 days | Time between buyback executions |
| `epochCapBps` | 500 (5%) | 0 – 10000 | Max % of reserves per buyback epoch |
| `slippageTolerance` | 50 (0.5%) | 0 – 500 | Max slippage on DEX swaps |
| `runwayReserve` | 100,000e6 | ≥ 0 | Minimum reserve balance maintained |
| `priceBandUpper` | 105e16 (105%) | > 100% | Upper intervention threshold |
| `priceBandLower` | 95e16 (95%) | < 100% | Lower intervention threshold |

### 6.6 Reserve Management Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Reserve Allocation                         │
│                                                              │
│  Total Reserves = USDC + cbBTC + Au (in USD terms)          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Runway Reserve (untouchable)                        │    │
│  │  → Ensures operational continuity                    │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Active Reserves (deployable)                        │    │
│  │  → Buybacks, liquidity provision, yield generation   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Allocation:                                                 │
│  - 20% of excess → Buybacks (Au purchase)                   │
│  - Remaining → Liquidity provision / yield                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.7 DEX Interaction Flow

```
TreasuryAMO.executeBuyback()
    │
    ├── 1. Check: block.timestamp >= lastBuyback + buybackCooldown
    ├── 2. Check: !paused && !emergencyStopped
    ├── 3. OracleWrapper.validateTWAP() → must be true
    ├── 4. Calculate buyback amount (getBuybackAmount)
    ├── 5. Approve DEX router for reserveToken spend
    ├── 6. Swap on Aerodrome (primary)
    │       ├── Success → continue
    │       └── Failure → fallback to Uniswap V3
    ├── 7. Slippage check: auReceived >= minAmountOut
    ├── 8. Update lastBuyback timestamp
    └── 9. Emit BuybackExecuted(reserveSpent, auReceived)
```

---

## 7. Oracle Module

### 7.1 Architecture Overview

The oracle system implements a **three-layer architecture** for price data:

1. **AvOracle** — Primary price feed (TWAP) with fallback (Chainlink)
2. **OracleWrapper** — Validation layer with deviation checks and trigger conditions
3. **OracleFlashBuy** — Automated action layer for below-peg buybacks

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ORACLE ARCHITECTURE                           │
│                                                                       │
│  Layer 1: AvOracle                                                    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Source A: Aerodrome TWAP (primary)                           │    │
│  │  Source B: Chainlink Price Feed (fallback)                    │    │
│  │  Logic: TWAP if fresh & valid, else Chainlink                │    │
│  │  Output: price (uint256, 18 decimals), timestamp              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  Layer 2: OracleWrapper                                               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Deviation Check: |TWAP - Spot| / Spot < maxDeviation       │    │
│  │  Staleness Check: block.timestamp - timestamp < maxStaleness │    │
│  │  Trigger: price < pegThreshold → signal flash buy            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  Layer 3: OracleFlashBuy                                              │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Listens for trigger signal from OracleWrapper                │    │
│  │  Executes buyback via TreasuryFlashBuy                        │    │
│  │  Validates price improvement after execution                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 AvOracle

**File:** `contracts/av_suite/AvOracle.sol`

```solidity
struct OracleConfig {
    address pool;                  // Aerodrome pool address
    address token0;                // Token0 in pool
    address token1;                // Token1 in pool
    uint32 twapDuration;           // TWAP window (default: 1800s = 30min)
    address chainlinkAggregator;   // Chainlink price feed
    uint256 maxDeviation;          // Max TWAP/spot deviation (default: 500 = 5%)
    uint256 maxStaleness;          // Max staleness in seconds (default: 3600)
}

/// @notice Get the current Au price in USD
/// @return price The price with 18 decimal precision
/// @return timestamp The timestamp of the price data
function getPrice() external view returns (uint256 price, uint256 timestamp);

/// @notice Get TWAP price from Aerodrome pool
/// @return twapPrice The TWAP price over configured duration
function getTWAP() public view returns (uint256 twapPrice);

/// @notice Get Chainlink fallback price
/// @return chainlinkPrice The Chainlink reported price
function getChainlinkPrice() public view returns (uint256 chainlinkPrice);
```

**Price Resolution Logic:**
```
1. Query Aerodrome pool TWAP for configured duration
2. If TWAP succeeds AND (block.timestamp - twapTimestamp) < maxStaleness:
     → Return TWAP price
3. Else:
     → Query Chainlink aggregator.latestRoundData()
     → Validate round completeness
     → Return Chainlink price
4. If both fail:
     → Revert with OracleUnavailable()
```

### 7.3 OracleWrapper

**File:** `contracts/av_suite/OracleWrapper.sol`

```solidity
struct WrapperConfig {
    uint256 maxDeviationBps;        // Max deviation between TWAP and spot (500 = 5%)
    uint256 pegThresholdBps;       // Below-peg trigger threshold (9800 = 98%)
    uint256 flashBuyThresholdBps;  // Flash buy trigger threshold (9700 = 97%)
    uint256 cooldown;              // Min time between flash buy triggers
}

/// @notice Validate price data integrity
/// @return valid True if all checks pass
function validatePrice() external view returns (bool valid);

/// @notice Check if flash buy should be triggered
/// @return shouldTrigger True if conditions met
function checkFlashBuyTrigger() external view returns (bool shouldTrigger);

/// @notice Get validated price for consumption by other contracts
/// @return price Validated USD price (18 decimals)
function getValidatedPrice() external view returns (uint256 price);
```

**Deviation Check:**
```
deviation = |twapPrice - spotPrice| × 10000 / spotPrice
if deviation > maxDeviationBps:
    → Return invalid (potential manipulation)
else:
    → Return valid
```

### 7.4 OracleFlashBuy

**File:** `contracts/av_suite/OracleFlashBuy.sol`

```solidity
/// @notice Execute automated below-peg buyback
/// @dev Called when OracleWrapper signals trigger condition
/// @return success True if buyback executed successfully
function executeFlashBuy() external nonReentrant returns (bool success);

/// @notice Check if conditions warrant a flash buy
/// @return eligible True if all preconditions met
function isEligible() external view returns (bool eligible);

/// @notice Calculate optimal flash buy amount
/// @return amount Reserve tokens to spend
function getOptimalAmount() external view returns (uint256 amount);
```

### 7.5 Oracle Parameter Table

| Parameter | Default | Bounds | Contract | Description |
|---|---|---|---|---|
| `twapDuration` | 1800s (30min) | 60s – 7200s | AvOracle | TWAP window |
| `maxDeviation` | 500 (5%) | 100 – 2000 | AvOracle | Max TWAP/spot deviation |
| `maxStaleness` | 3600s (1hr) | 300s – 86400s | AvOracle | Max price staleness |
| `pegThreshold` | 9800 (98%) | 9000 – 10000 | OracleWrapper | Below-peg trigger |
| `flashBuyThreshold` | 9700 (97%) | 9000 – 9900 | OracleWrapper | Flash buy trigger |
| `flashBuyCooldown` | 1 hours | 15min – 24h | OracleWrapper | Min time between triggers |
| `maxPriceAge` | 300s (5min) | 60s – 3600s | OracleWrapper | Max age for price consumption |

---

## 8. Governance Module

### 8.1 Architecture

The governance pipeline follows a **three-stage delayed execution** pattern:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     GOVERNANCE PIPELINE                                  │
│                                                                         │
│  Stage 1: GovernorContract (OpenZeppelin Governor)                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  - Proposal submission (100k Ag threshold)                     │    │
│  │  - Voting period: 216k blocks (~3 days)                        │    │
│  │  - Quorum: 4% of total supply                                  │    │
│  │  - Approval threshold: 66% (normal) / 80% (critical)          │    │
│  │  - Voting delay: 1 block                                       │    │
│  │  - ERC20Votes for snapshot-based voting power                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼ (if vote succeeds)                       │
│  Stage 2: ArtifactTimelock (TimelockController)                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  - MIN_DELAY: 48 hours                                         │    │
│  │  - MAX_DELAY: 30 days                                          │    │
│  │  - GRACE_PERIOD: 14 days                                       │    │
│  │  - PROPOSER role: GovernorContract                             │    │
│  │  - EXECUTOR role: GovernorContract                             │    │
│  │  - CANCELLER role: GovernorContract + multisig                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼ (after timelock expires)                 │
│  Stage 3: Treasury Safe                                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  - Receives queued operations                                  │    │
│  │  - Executes parameter changes, upgrades, transfers             │    │
│  │  - All state changes take effect                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### 8.2 GovernorContract

**File:** `contracts/av_suite/GovernorContract.sol`

```solidity
// Inherits from OpenZeppelin Governor + GovernorVotes + GovernorTimelockControl

struct GovernanceParams {
    uint256 votingDelay;            // Blocks before voting starts: 1
    uint256 votingPeriod;           // Blocks for voting: 216000 (~3 days)
    uint256 quorumNumerator;        // Quorum: 4% (400/10000)
    uint256 proposalThreshold;      // Min Ag to propose: 100,000e18
    uint256 quorumNumeratorNormal;  // Normal approval: 66% (6600/10000)
    uint256 quorumNumeratorCritical;// Critical approval: 80% (8000/10000)
}

/// @notice Submit a proposal for governance vote
/// @param targets Target addresses for calls
/// @param values ETH values for calls
/// @param calldatas Calldata for each call
/// @param description Human-readable description
/// @return proposalId The unique proposal identifier
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public override returns (uint256 proposalId);

/// @notice Queue a successful proposal for timelock
function queue(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public override returns (uint256 operationId);

/// @notice Execute a queued proposal after timelock
function execute(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public payable override returns (uint256);
```

### 8.3 ArtifactTimelock

**File:** `contracts/av_suite/TimelockController.sol`

```solidity
struct TimelockConfig {
    uint256 minDelay;          // Minimum delay: 172800 (48 hours)
    uint256 maxDelay;          // Maximum delay: 2592000 (30 days)
    uint256 gracePeriod;       // Grace period: 1209600 (14 days)
}

/// @notice Schedule an operation with timelock delay
/// @param target Address to call
/// @param value ETH to send
/// @param data Calldata
/// @param predecessor Predecessor operation (bytes32(0) if none)
/// @param salt Unique salt for operation ID
/// @return operationId Unique operation identifier
function schedule(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt
) external onlyRole(PROPOSER_ROLE) returns (bytes32 operationId);

/// @notice Execute a scheduled operation after delay
function execute(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt
) external payable onlyRole(EXECUTOR_ROLE);

/// @notice Cancel a pending operation
function cancel(bytes32 id) external onlyRole(CANCELLER_ROLE);
```

### 8.4 Proposal Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  PENDING │────►│ ACTIVE  │────►│ DEFEATED│     │QUEUED   │────►│EXECUTED │
│          │     │         │     │         │     │         │     │         │
│ voting   │     │ voting  │     │ quorum  │     │ in      │     │ after    │
│ delay    │     │ period  │     │ not met │     │ timelock│     │ delay    │
│ (1 block)│     │ (3 days)│     │ or      │     │         │     │          │
│          │     │         │     │ against │     │         │     │          │
└─────────┘     └────┬────┘     └─────────┘     └────┬────┘     └─────────┘
                     │                                │
                     │ (quorum met + majority yes)    │
                     ▼                                │
                ┌─────────┐                           │
                │SUCCEEDED│───────────────────────────┘
                │         │    (queue called)
                └─────────┘
                     │
                     │ (if cancelled)
                     ▼
                ┌─────────┐
                │CANCELLED│
                └─────────┘
```

### 8.5 Governance Parameter Table

| Parameter | Value | Description |
|---|---|---|
| `votingDelay` | 1 block | Delay before voting begins |
| `votingPeriod` | 216,000 blocks (~3 days) | Duration of voting |
| `quorumNumerator` | 400 (4%) | Minimum participation for valid vote |
| `proposalThreshold` | 100,000 Ag | Minimum Ag to submit proposal |
| `approvalThresholdNormal` | 66% | Yes votes needed for normal proposals |
| `approvalThresholdCritical` | 80% | Yes votes needed for critical proposals |
| `timelockMinDelay` | 48 hours | Minimum timelock delay |
| `timelockMaxDelay` | 30 days | Maximum timelock delay |
| `timelockGracePeriod` | 14 days | Window to execute after delay |

### 8.6 Critical vs Normal Proposals

| Type | Approval Threshold | Examples |
|---|---|---|
| **Normal** | 66% | Parameter adjustments, minor upgrades, fee changes |
| **Critical** | 80% | Timelock parameter changes, contract replacements, emergency powers |

---

## 9. Token Module

### 9.1 AuToken — Utility Token

**File:** `contracts/av_suite/AuToken.sol`

```solidity
contract AuToken is ERC20, ERC20Permit, ERC3156FlashMintable, UUPSUpgradeable {
    // === Fee Configuration ===
    uint256 public constant FEE_BPS = 9;           // 9 basis points
    uint256 public constant BURN_SHARE = 50;       // 50% of fee burned
    uint256 public constant TREASURY_SHARE = 50;   // 50% to treasury

    // === Anti-Bot Protection ===
    uint256 public cooldownDuration;               // Min time between sells
    uint256 public maxTransactionAmount;           // Max tx size
    uint256 public maxWalletAmount;                // Max wallet balance
    mapping(address => bool) public blocklisted;   // Blocklist
    mapping(address => uint256) public lastSellTime; // Sell cooldown tracker

    // === Core Functions ===
    function transfer(address to, uint256 amount) public override returns (bool);
    function transferFrom(address from, address to, uint256 amount) public override returns (bool);
    function flashLoan(
        address receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}
```

### 9.2 AuToken Fee Mechanics

```
Transfer Amount: X
Fee = X × 9 / 10000 = X × 0.0009

Distribution:
  ├── Burn: Fee × 50% = X × 0.00045 (sent to address(0))
  └── Treasury: Fee × 50% = X × 0.00045 (sent to Treasury Safe)

Net received by recipient: X - Fee = X × 0.9991
```

### 9.3 AuToken Anti-Bot Configuration

| Parameter | Default | Bounds | Description |
|---|---|---|---|
| `cooldownDuration` | 60s | 0 – 3600s | Minimum time between sells |
| `maxTransactionAmount` | 1% of supply | 0 – 10% | Max tokens per transaction |
| `maxWalletAmount` | 2% of supply | 0 – 10% | Max tokens per wallet |
| `blocklisted` | dynamic | N/A | Addresses blocked from trading |

### 9.4 AgToken — Governance Token

**File:** `contracts/av_suite/AgToken.sol`

```solidity
contract AgToken is ERC20, ERC20Permit, ERC20Votes, UUPSUpgradeable {
    // === Emission Control ===
    address public emissionController;  // PID_Emission_Controller_v2

    // === Constraints ===
    uint256 public constant MAX_SUPPLY = 1_000_000 * 1e18;  // 1M hard cap (soft)
    // Note: No genesis mint. All supply created via PID emission.

    // === Core Functions ===
    function mint(address to, uint256 amount) external onlyEmissionController;
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override;
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override;
}
```

### 9.5 AgToken Emission Flow

```
PID_Emission_Controller_v2
    │
    ├── calculateEmission() → returns amount
    │
    ├── Check: amount > 0
    ├── Check: dailyEmitted + amount ≤ maxDailyEmission
    │
    └── AgToken.mint(treasury, amount)
            │
            └── Tokens sent to Treasury Safe
                └── Distributed to stakers as rewards
```

### 9.6 Cross-Token Staking Mechanism

```
┌──────────────────────────────────────────────────────────────────┐
│                    CROSS-TOKEN STAKING FLOW                        │
│                                                                   │
│  User provides liquidity on Aerodrome (Au/USDC pool)             │
│       │                                                           │
│       ▼                                                           │
│  Receives LP NFT (representing share of pool)                     │
│       │                                                           │
│       ▼                                                           │
│  AVLPStaking_v2.stake(lpNFT)                                      │
│       │                                                           │
│       ▼                                                           │
│  Earns:                                                           │
│  ├── Au rewards (from treasury fees)                             │
│  ├── Ag rewards (from PID emission)                              │
│  └── Ag multiplier boosts Au reward rate (1x → 2.5x)             │
│       │                                                           │
│       ▼                                                           │
│  Ag tokens also grant governance voting power                     │
│  (ERC20Votes: snapshot-based, delegatable)                        │
└──────────────────────────────────────────────────────────────────┘
```

### 9.7 Token Parameter Table

| Parameter | AuToken | AgToken | Description |
|---|---|---|---|
| `name` | "AV Au" | "AV Ag" | Token name |
| `symbol` | "Au" | "Ag" | Token symbol |
| `decimals` | 18 | 18 | Token decimals |
| `initialSupply` | 0 (fair launch) | 0 (no genesis) | Initial mint |
| `maxSupply` | Unlimited | 1,000,000 (soft) | Supply cap |
| `transferFee` | 9 bps | 0 | Transfer fee |
| `feeSplit` | 50% burn / 50% treasury | N/A | Fee distribution |
| `votingPower` | None | ERC20Votes | Governance power |
| `permit` | ERC20Permit | ERC20Permit | Gasless approvals |
| `flashMint` | ERC3156 | None | Flash loan support |

---

## 10. Flash Buy Module

### 10.1 Overview

The Flash Buy system implements **automated below-peg buybacks** that activate when Au price falls below a configured threshold. This mechanism mirrors a central bank defending a currency peg by purchasing its own currency from the open market.

### 10.2 Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                       FLASH BUY SYSTEM                                  │
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  OracleFlashBuy   │    │ TreasuryFlashBuy  │    │    FlashLoan     │  │
│  │                   │    │                   │    │                  │  │
│  │  - Monitors price │    │  - Treasury-init  │    │  - ERC3156       │  │
│  │  - Auto-triggers  │    │  - Manual trigger │    │  - Flash borrow  │  │
│  │  - Optimal amount │    │  - Reserve-based  │    │  - Same-tx repay │  │
│  │  - Price improve  │    │  - Cooldown-based  │    │  - Arbitrage     │  │
│  └────────┬──────────┘    └────────┬──────────┘    └────────┬─────────┘ │
│           │                        │                        │           │
│           └────────────────────────┼────────────────────────┘           │
│                                    │                                    │
│                          ┌─────────▼─────────┐                          │
│                          │    DEX Router      │                          │
│                          │  (Aerodrome)       │                          │
│                          └───────────────────┘                          │
└────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Flash Buy Types

#### 10.3.1 OracleFlashBuy (Automated)

```solidity
/// @notice Execute automated flash buy when below peg
/// @dev Called by keeper or anyone when conditions are met
function executeFlashBuy() external nonReentrant returns (bool success) {
    // 1. Verify price is below peg threshold
    (uint256 price, ) = avOracle.getPrice();
    require(price < pegThreshold, "Price above peg");

    // 2. Verify cooldown has elapsed
    require(
        block.timestamp >= lastFlashBuy + flashBuyCooldown,
        "Cooldown active"
    );

    // 3. Calculate optimal buyback amount
    uint256 amount = getOptimalAmount();

    // 4. Execute buyback via TreasuryFlashBuy
    bool success = treasuryFlashBuy.executeBuyback(amount);

    // 5. Verify price improvement
    if (success) {
        (uint256 newPrice, ) = avOracle.getPrice();
        require(newPrice >= price, "Price not improved");
        lastFlashBuy = block.timestamp;
    }

    return success;
}
```

#### 10.3.2 TreasuryFlashBuy (Manual/Semi-Automated)

```solidity
/// @notice Execute treasury-funded buyback
/// @param amount Reserve tokens to spend
function executeBuyback(uint256 amount) external onlyRole(OPERATOR_ROLE)
    returns (uint256 auReceived) {
    // 1. Transfer reserve tokens from Treasury Safe
    IERC20(reserveToken).transferFrom(treasury, address(this), amount);

    // 2. Approve DEX router
    IERC20(reserveToken).approve(router, amount);

    // 3. Execute swap
    auReceived = router.swapExactTokensForTokens(
        amount,
        minAmountOut,
        path,
        address(this),
        block.timestamp + 300
    );

    // 4. Transfer Au to Treasury Safe
    auToken.transfer(treasury, auReceived);
}
```

#### 10.3.3 FlashLoan (Capital-Efficient)

```solidity
/// @notice Execute flash buy using borrowed capital
/// @dev Uses ERC3156 flash loans for same-tx capital
function executeFlashBuy() external nonReentrant {
    // 1. Request flash loan of reserve tokens
    auToken.flashLoan(
        address(this),
        address(reserveToken),
        borrowAmount,
        ""
    );
    // Note: flashLoan triggers onFlashLoan() callback
}

/// @notice ERC3156 flash loan callback
function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata data
) external returns (bytes32) {
    // 1. Swap borrowed reserves for Au on DEX
    uint256 auReceived = router.swapExactTokensForTokens(
        amount, minAmountOut, path, address(this), block.timestamp + 300
    );

    // 2. Repay flash loan: amount + fee
    uint256 repayAmount = amount + fee;
    uint256 profit = auReceived - repayAmount;

    // 3. Transfer Au profit to Treasury Safe
    auToken.transfer(treasury, auReceived);

    // 4. Approve flash loan repayment
    IERC20(token).approve(address(auToken), repayAmount);

    return keccak256("ERC3156FlashBorrower.onFlashLoan");
}
```

### 10.4 Flash Buy Parameter Table

| Parameter | Default | Bounds | Description |
|---|---|---|---|
| `pegThreshold` | 98e16 (98 cents) | 90e16 – 100e16 | Price trigger threshold |
| `flashBuyCooldown` | 1 hour | 15min – 24h | Min time between flash buys |
| `maxFlashBuyAmount` | 50,000e6 | ≤ 500,000e6 | Max reserve tokens per flash buy |
| `minPriceImprovement` | 0.1% | 0.01% – 5% | Required price improvement post-buy |
| `flashLoanFee` | Protocol-defined | N/A | ERC3156 flash loan fee |

### 10.5 Flash Buy Execution Flow

```
OracleFlashBuy.executeFlashBuy()
    │
    ├── 1. CHECK: price < pegThreshold
    │       └── OracleWrapper.getValidatedPrice()
    │
    ├── 2. CHECK: block.timestamp ≥ lastFlashBuy + cooldown
    │
    ├── 3. CALCULATE: optimal buyback amount
    │       └── getOptimalAmount() based on deviation magnitude
    │
    ├── 4. EXECUTE: TreasuryFlashBuy.executeBuyback(amount)
    │       ├── Transfer reserves from Treasury
    │       ├── Swap on Aerodrome
    │       └── Transfer Au to Treasury
    │
    ├── 5. VALIDATE: price improved post-execution
    │       └── newPrice ≥ oldPrice + minImprovement
    │
    └── 6. EMIT: FlashBuyExecuted(amount, auReceived, newPrice)
```

---

## 11. Staking Module

### 11.1 Overview

**AVLPStaking_v2** is the LP NFT staking contract that incentivizes liquidity provision. Users deposit Aerodrome LP NFTs and earn Au + Ag rewards, with Ag holders receiving a boosted reward multiplier.

### 11.2 Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      AVLPStaking_v2 ARCHITECTURE                        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAKING LAYER                                                    │  │
│  │  - Accepts LP NFTs (ERC721)                                       │  │
│  │  - Tracks staked value per user                                    │  │
│  │  - Calculates TVL for PID controller                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  REWARD ENGINE                                                    │  │
│  │  - Au rewards: from treasury fee accumulation                     │  │
│  │  - Ag rewards: from PID emission controller                       │  │
│  │  - Reward rate: proportional to staked share                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Ag MULTIPLIER                                                     │  │
│  │  - Base multiplier: 1.0x                                          │  │
│  │  - Max multiplier: 2.5x                                           │  │
│  │  - Based on user's Ag balance / staked value ratio                │  │
│  │  - Formula: 1.0 + 1.5 × min(AgValue / StakedValue, 1.0)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Core Interface

```solidity
contract AVLPStaking_v2 is IERC721Receiver, UUPSUpgradeable {
    struct StakeInfo {
        address owner;           // NFT owner
        uint256 tokenId;         // LP NFT token ID
        uint256 stakedAt;        // Stake timestamp
        uint256 stakedValueUSD;  // USD value at time of staking
    }

    struct RewardState {
        uint256 rewardPerShare;  // Accumulated reward per share (1e18 precision)
        uint256 lastUpdateTime;  // Last reward distribution timestamp
        uint256 totalStakedValue; // Total USD value staked (TVL)
    }

    // === Staking Functions ===
    function stake(uint256 tokenId) external;
    function unstake(uint256 tokenId) external;
    function emergencyUnstake(uint256 tokenId) external; // Skip rewards, no cooldown

    // === Reward Functions ===
    function claimRewards(uint256 tokenId) external;
    function claimAllRewards() external;
    function pendingRewards(address user) external view returns (uint256 auReward, uint256 agReward);

    // === Multiplier Functions ===
    function getMultiplier(address user) public view returns (uint256 multiplier);
    function getEffectiveStakeValue(address user) external view returns (uint256 effectiveValue);

    // === View Functions ===
    function getUserStakes(address user) external view returns (StakeInfo[] memory);
    function getTVL() external view returns (uint256 totalValue);
    function getRewardRate() external view returns (uint256 auRate, uint256 agRate);
}
```

### 11.4 Ag Multiplier Mechanics

```
Multiplier = 1.0 + 1.5 × min(AgBalance / StakedValueUSD, 1.0)

Where:
  AgBalance = user's Ag token balance (in USD terms)
  StakedValueUSD = user's total staked LP value in USD

Examples:
  No Ag held:     multiplier = 1.0x
  25% Ag ratio:   multiplier = 1.375x
  50% Ag ratio:   multiplier = 1.75x
  100% Ag ratio:  multiplier = 2.5x (max)
```

### 11.5 Reward Distribution

```
Au Reward Pool:
  Source: 4.5 bps of every Au transfer goes to staking pool
  Distribution: Proportional to effective stake value (staked × multiplier)

Ag Reward Pool:
  Source: PID_Emission_Controller_v2 mints Ag for staking rewards
  Distribution: Proportional to effective stake value (staked × multiplier)

Reward Calculation per epoch:
  rewardPerShare += rewardAmount × 1e18 / totalEffectiveStake
  userReward = (userEffectiveStake × rewardPerShare) / 1e18 - userDebt
```

### 11.6 Staking Parameter Table

| Parameter | Default | Bounds | Description |
|---|---|---|---|
| `minStakeDuration` | 0 blocks | 0 – 7 days | Minimum stake duration |
| `maxMultiplier` | 2.5x | 1x – 5x | Maximum Ag multiplier |
| `multiplierAgRatio` | 1.0 (100%) | 0 – 2.0 | Ag/staked ratio for max multiplier |
| `rewardDuration` | 7 days | 1 – 30 days | Reward distribution period |
| `auRewardRate` | Dynamic | Set by governance | Au tokens per second |
| `agRewardRate` | Dynamic | Set by PID | Ag tokens per second |

### 11.7 LP NFT Flow

```
Aerodrome Swap
    │
    ├── User provides Au + USDC to Au/USDC pool
    ├── Receives LP NFT (ERC721 representing pool share)
    │
    └── AVLPStaking_v2.stake(tokenId)
            │
            ├── NFT transferred to staking contract
            ├── StakeInfo recorded (owner, tokenId, value)
            ├── TVL updated
            └── Rewards begin accruing
```

---

## 12. Security Architecture

### 12.1 Access Control Matrix

| Contract | Role | Target | Capabilities |
|---|---|---|---|
| `AuToken` | `DEFAULT_ADMIN_ROLE` | Governance | Configure fees, anti-bot params |
| `AuToken` | `FLASH_MINTER_ROLE` | FlashLoan contract | Execute flash loans |
| `AgToken` | `MINTER_ROLE` | PID_Emission_Controller_v2 | Mint Ag tokens |
| `AgToken` | `DEFAULT_ADMIN_ROLE` | Governance | Set emission controller |
| `PID_Emission_Controller_v2` | `DEFAULT_ADMIN_ROLE` | Governance | Set parameters, emergency stop |
| `TreasuryAMO` | `DEFAULT_ADMIN_ROLE` | Governance | Configure buyback params |
| `TreasuryAMO` | `OPERATOR_ROLE` | Keeper/Guardian | Execute buybacks |
| `AVLPStaking_v2` | `DEFAULT_ADMIN_ROLE` | Governance | Set reward rates, rescue tokens |
| `GovernorContract` | `PROPOSER_ROLE` | Governance | Queue timelock operations |
| `GovernorContract` | `EXECUTOR_ROLE` | Governance | Execute timelock operations |
| `ArtifactTimelock` | `CANCELLER_ROLE` | Multisig/Governance | Cancel pending operations |

### 12.2 Timelock Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│  Timelock Levels                                                     │
│                                                                      │
│  Level 0: Instant                                                    │
│  ├── Emergency pause (multisig or guardian)                          │
│  └── Critical bug patches (requires 80% governance vote)            │
│                                                                      │
│  Level 1: 24 hours                                                   │
│  ├── Routine parameter adjustments                                   │
│  └── Keeper function authorizations                                  │
│                                                                      │
│  Level 2: 48 hours (default timelock)                                │
│  ├── Standard governance proposals                                   │
│  ├── Treasury allocation changes                                     │
│  └── AMO parameter changes                                           │
│                                                                      │
│  Level 3: 7 days                                                     │
│  ├── Contract upgrades (UUPS)                                        │
│  ├── Timelock parameter changes                                      │
│  └── Critical system modifications                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.3 Circuit Breakers

```solidity
/// @notice Emergency pause mechanism
/// @dev Can be triggered by guardian multisig or governance
function pause() external onlyRole(GUARDIAN_ROLE);

/// @notice Emergency stop for PID controller
/// @dev Immediately halts all Ag minting
function emergencyStop() external onlyRole(GUARDIAN_ROLE);

/// @notice Circuit breaker for excessive buyback frequency
/// @dev If > 3 buybacks in 24h, cooldown increases
function checkBuybackFrequency() internal returns (bool withinBounds);

/// @notice Max emission circuit breaker
/// @dev If Ag price drops > 20% in 1h, halt emission
function checkEmissionSafety() internal returns (bool safe);
```

### 12.4 Emergency Procedures

| Scenario | Response | Trigger | Effect |
|---|---|---|---|
| Oracle manipulation | Pause buybacks | Guardian multisig | All AMO operations halted |
| Excessive emission | Emergency stop PID | Guardian multisig | Ag minting halted |
| Price crash (>20%) | Auto-flash buy | OracleFlashBuy | Automatic buyback execution |
| Governance attack | Timelock delay | Built-in timelock | 48h window to cancel malicious ops |
| Contract vulnerability | Emergency pause | Guardian multisig | All token transfers paused |
| Reserve depletion | Stop buybacks | TreasuryAMO | Buyback cooldown extended |

### 12.5 Invariant Checks

```
1. Ag totalSupply() ≤ MAX_SUPPLY (1,000,000e18)
2. PID dailyEmitted ≤ maxDailyEmission (100,000e18)
3. Treasury buyback amount ≤ 5% of reserves per epoch
4. TWAP deviation ≤ 5% (else reject price)
5. Slippage on all DEX swaps ≤ 0.5%
6. Treasury reserves ≥ runwayReserve (100,000 USDC)
7. No single address holds > 10% of Ag supply (soft limit)
```

### 12.6 Audit & Formal Verification Targets

| Component | Priority | Status | Focus Area |
|---|---|---|---|
| PID_Emission_Controller_v2 | Critical | Pending | Overflow, precision, manipulation |
| TreasuryAMO | Critical | Pending | Slippage, reentrancy, price manipulation |
| AuToken | High | Pending | Fee calculation, anti-bot bypass |
| Oracle System | High | Pending | Staleness, deviation, flash loan attacks |
| AVLPStaking_v2 | Medium | Pending | Reward calculation, reentrancy |
| GovernorContract | Medium | Pending | Proposal threshold, voting power |

---

## 13. Upgradeability

### 13.1 Proxy Pattern

The system uses **UUPS (Universal Upgradeable Proxy Standard)** for upgradeable contracts:

```
┌─────────────────────────────────────────────────────────────────────┐
│  UUPS Architecture                                                   │
│                                                                      │
│  Proxy Contract (deployed, immutable)                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  - Holds all state (balances, allowances, staking data)       │   │
│  │  - delegatecall to implementation contract                    │   │
│  │  - Contains fallback() → delegates to implementation           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ delegatecall                          │
│                              ▼                                       │
│  Implementation Contract (replaceable)                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  - Contains logic only (no state)                             │   │
│  │  - Can be replaced via upgradeTo() in proxy                   │   │
│  │  - Authorized upgrader: ArtifactTimelock (48h delay)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Upgradeable Contracts

| Contract | Proxy Pattern | Upgrader | Storage Critical |
|---|---|---|---|
| `AuToken` | UUPS | ArtifactTimelock | Balances, allowances, fee config |
| `AgToken` | UUPS | ArtifactTimelock | Balances, voting power, delegates |
| `AVLPStaking_v2` | UUPS | ArtifactTimelock | Staked NFTs, reward state |
| `GovernorContract` | UUPS | ArtifactTimelock | Proposal state, timelock ref |
| `AvOracle` | UUPS | ArtifactTimelock | Oracle config, pool refs |
| `OracleWrapper` | UUPS | ArtifactTimelock | Wrapper config |

### 13.3 Non-Upgradeable Contracts

| Contract | Reason |
|---|---|
| `ArtifactTimelock` | Security: timelock must not be replaceable |
| `PID_Emission_Controller_v2` | Re-deploy for parameter changes |
| `TreasuryAMO` | Re-deploy for strategy changes |
| `OracleFlashBuy` | Stateless execution layer |
| `TreasuryFlashBuy` | Stateless execution layer |
| `FlashLoan` | Stateless execution layer |

### 13.4 Upgrade Process

```
1. Deploy new implementation contract
2. Verify on BaseScan
3. Submit governance proposal: "Upgrade X to implementation 0x..."
4. Proposal passes (66% or 80% threshold)
5. Queue in ArtifactTimelock (48h delay)
6. After 48h, execute upgrade
7. Proxy now points to new implementation
8. Verify storage compatibility
```

### 13.5 Storage Layout Safety

```
AuToken Storage (Proxy):
  Slot 0: _initialized (bool)
  Slot 1: _initializedVersion (uint8)
  Slot 2: _gap[50] (reserved for future variables)
  Slot 52: _balances (mapping)
  Slot 53: _allowances (mapping)
  Slot 54: _totalSupply (uint256)
  Slot 55: _name (string)
  Slot 56: _symbol (string)
  Slot 57: feeBps, burnShare, treasuryShare
  Slot 58: cooldown, maxTx, maxWallet
  Slot 59: blocklisted mapping
  Slot 60: lastSellTime mapping
  ... (additional slots for new variables must append only)
```

---

## 14. Gas Architecture

### 14.1 Gas Optimization Strategies

| Strategy | Implementation | Savings |
|---|---|---|
| **Custom errors** | `revert CustomError()` instead of `require(string)` | ~50 gas per call |
| **Calldata over memory** | Use `calldata` for external function arrays | Avoids memory copy |
| **Storage packing** | Pack related variables into single slots | ~20,000 gas per slot write |
| **Immutable values** | Use `immutable` for addresses set at construction | ~2,100 gas per read |
| **Short-circuit evaluation** | Order conditions by likelihood | Variable |
| **Batch operations** | Multi-call patterns for related operations | Amortized overhead |
| **Minimal proxy** | UUPS over Transparent Proxy | ~40% deployment savings |

### 14.2 Storage Packing

```
Before Packing (4 slots = 80,000 gas):
  Slot 0: address owner        // 20 bytes
  Slot 1: uint256 targetTVL    // 32 bytes
  Slot 2: bool paused          // 1 byte
  Slot 3: uint256 lastUpdate   // 32 bytes

After Packing (3 slots = 60,000 gas):
  Slot 0: address owner + uint96 targetTVL_hi  // 20 + 12 bytes
  Slot 1: uint256 targetTVL_lo                // 32 bytes
  Slot 2: bool paused + uint96 lastUpdate     // 1 + 12 bytes
  // (remaining 20 bytes available for new vars)
```

### 14.3 Estimated Gas Costs

| Operation | Estimated Gas | Notes |
|---|---|---|
| `AuToken.transfer()` | ~65,000 | Includes fee calculation + split |
| `AuToken.transferFrom()` | ~85,000 | Includes allowance check |
| `AVLPStaking_v2.stake()` | ~180,000 | NFT transfer + state update |
| `AVLPStaking_v2.claimRewards()` | ~120,000 | Reward calculation + transfer |
| `TreasuryAMO.executeBuyback()` | ~250,000 | Oracle check + DEX swap |
| `PID_Emission_Controller_v2.calculateEmission()` | ~150,000 | TVL query + PID math + mint |
| `GovernorContract.propose()` | ~200,000 | State storage + event emission |
| `OracleFlashBuy.executeFlashBuy()` | ~300,000 | Full flash buy pipeline |
| `ArtifactTimelock.schedule()` | ~100,000 | Operation scheduling |
| `ArtifactTimelock.execute()` | ~150,000 | Operation execution |

### 14.4 L2-Specific Optimizations (Base)

| Optimization | Description | Impact |
|---|---|---|
| **Blob transactions** | Use blob posting for large calldata | Reduced L1 data costs |
| **Fast precompiles** | Leverage L2 precompiles for EC operations | Cheaper signature verification |
| **Batched calls** | Group multiple operations in single tx | Amortized base fee |
| **Warm storage** | Pre-warm frequently accessed storage slots | Reduced cold read costs |

---

## 15. Integration Points

### 15.1 External Protocol Dependencies

```
┌────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATION MAP                              │
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │   Aerodrome       │ ← DEX: TWAP oracle, LP NFTs, swap execution     │
│  │   (Base DEX)      │                                                   │
│  └──────────────────┘                                                   │
│           │                                                             │
│  ┌──────────────────┐                                                   │
│  │   Chainlink       │ ← Oracle: Fallback price feed (Au/USD)          │
│  │   Price Feeds     │                                                   │
│  └──────────────────┘                                                   │
│           │                                                             │
│  ┌──────────────────┐                                                   │
│  │   Uniswap V3      │ ← DEX: Fallback router for buybacks             │
│  │   (Base)          │                                                   │
│  └──────────────────┘                                                   │
│           │                                                             │
│  ┌──────────────────┐                                                   │
│  │   Base L2         │ ← Chain: Sequencer, blob posting, gas market    │
│  │   Infrastructure  │                                                   │
│  └──────────────────┘                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Aerodrome Integration

| Component | Interface | Usage |
|---|---|---|
| `IPool` | TWAP query | Primary price feed (`consult()`) |
| `IPool` | Swap execution | Buyback and liquidity operations |
| `IPool` | LP NFT (ERC721) | Staking collateral |
| `IRouter` | Swap routing | Multi-hop swaps for buybacks |

```solidity
interface IAerodromePool {
    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data) external returns (int256 amount0, int256 amount1);
}
```

### 15.3 Chainlink Integration

| Feed | Pair | Purpose | Staleness |
|---|---|---|---|
| Au/USD | Primary | Fallback price | 1 hour |
| Ag/USD | Secondary | Safety check | 1 hour |

```solidity
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
```

### 15.4 Uniswap V3 Fallback

```solidity
/// @notice Fallback router for buyback execution
/// @dev Used when Aerodrome swap fails or returns suboptimal output
function executeFallbackBuyback(
    uint256 reserveAmount,
    uint256 minAuOut,
    address[] calldata path
) external returns (uint256 amountOut) {
    // Execute on Uniswap V3 with 0.05% fee tier
    amountOut = swapRouter.exactInputSingle(
        ISwapRouter.ExactInputSingleParams({
            tokenIn: reserveToken,
            tokenOut: address(auToken),
            fee: 500,  // 0.05%
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: reserveAmount,
            amountOutMinimum: minAuOut,
            sqrtPriceLimitX96: 0
        })
    );
}
```

### 15.5 Integration Risk Matrix

| Dependency | Risk | Mitigation |
|---|---|---|
| Aerodrome downtime | High | Uniswap V3 fallback router |
| Chainlink staleness | Medium | TWAP primary, Chainlink fallback |
| Uniswap V3 liquidity | Low | Multi-hop routing, slippage checks |
| Base sequencer down | High | Graceful degradation, pause mode |
| Aerodrome TWAP manipulation | Medium | OracleWrapper deviation check (5%) |

### 15.6 Contract Interaction Summary

```
AuToken
  ├── Receives: Transfer fees (9 bps)
  ├── Sends: 50% to burn, 50% to Treasury
  ├── FlashMint: ERC3156 interface for FlashLoan contract
  └── Anti-bot: Cooldown, max tx, blocklist

AgToken
  ├── Minted by: PID_Emission_Controller_v2 only
  ├── Voting: ERC20Votes (snapshot-based, delegatable)
  └── Used for: Governance, staking multiplier

TreasuryAMO
  ├── Reads: AvOracle (price), OracleWrapper (validation)
  ├── Writes: Au balance (buyback received)
  └── Interacts: Aerodrome (swap), Uniswap V3 (fallback)

PID_Emission_Controller_v2
  ├── Reads: AVLPStaking_v2 (TVL)
  ├── Writes: AgToken.mint()
  └── Controlled by: GovernorContract → ArtifactTimelock

GovernorContract
  ├── Proposes: Any governance action
  ├── Queues: ArtifactTimelock
  └── Executes: After 48h delay

AVLPStaking_v2
  ├── Holds: LP NFTs (ERC721)
  ├── Distributes: Au + Ag rewards
  ├── Calculates: Ag multiplier (1x → 2.5x)
  └── Provides: TVL data to PID controller
```

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **AMO** | Automated Market Operations — central bank-style open market operations |
| **TWAP** | Time-Weighted Average Price — manipulation-resistant price feed |
| **PID** | Proportional-Integral-Derivative — control loop for emission adjustment |
| **TVL** | Total Value Locked — aggregate USD value of staked LP positions |
| **UUPS** | Universal Upgradeable Proxy Standard — upgradeable contract pattern |
| **Flash Buy** | Automated below-peg buyback using treasury or flash loan capital |
| **Au** | Utility token with fee-on-transfer mechanics |
| **Ag** | Governance token with algorithmic emission and voting power |
| **LP NFT** | ERC721 token representing share of a liquidity pool |
| **Runway** | Minimum treasury reserves to ensure operational continuity |

## Appendix B: Parameter Quick Reference

| Parameter | Value | Contract |
|---|---|---|
| Au transfer fee | 9 bps | AuToken |
| Fee split | 50% burn / 50% treasury | AuToken |
| Ag max supply | 1,000,000 | AgToken |
| PID kp | 1e15 | PID_Emission_Controller_v2 |
| PID ki | 1e13 | PID_Emission_Controller_v2 |
| PID kd | 1e14 | PID_Emission_Controller_v2 |
| Max daily emission | 100,000 Ag | PID_Emission_Controller_v2 |
| Max single emission | 10,000 Ag | PID_Emission_Controller_v2 |
| Buyback % of excess | 20% | TreasuryAMO |
| Buyback cooldown | 24 hours | TreasuryAMO |
| Epoch cap | 5% of reserves | TreasuryAMO |
| TWAP duration | 30 minutes | AvOracle |
| Max deviation | 5% | OracleWrapper |
| Flash buy threshold | 97% of peg | OracleFlashBuy |
| Staking max multiplier | 2.5x | AVLPStaking_v2 |
| Governance voting period | 3 days | GovernorContract |
| Governance quorum | 4% | GovernorContract |
| Timelock delay | 48 hours | ArtifactTimelock |
| Timelock grace period | 14 days | ArtifactTimelock |

---

*Document version: 2.0.0 | Last updated: 2026-06-28 | Author: AV Treasury Core Team*