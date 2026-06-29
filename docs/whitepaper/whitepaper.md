---
title: AV Treasury Whitepaper
date: 2026-06-29
status: final
description: Core protocol whitepaper covering Au/Ag dual-token system, economic flywheel, and PID controller design.
category: whitepaper
related: [vision.md, ../technical/deployment-plan.md, ../reports/formal_verification.md, ../sim/index.md]
---

# AV Treasury Whitepaper

> **HISTORICAL DOCUMENT:** This whitepaper describes the original vision
> including veAg lock-weighted governance and RSBT soulbound tokens. The
> deployed system uses AgToken (ERC20Votes) for governance and
> QuasiCrystalLPNFT (ERC-721) for LP positions. See
> [docs/central-banking/](../central-banking/index.md) for current specs.

## A Self-Sustaining Decentralized Economic Organism

---

**Version:** 2.0  
**Date:** June 28, 2026  
**Status:** Live — Base Mainnet  
**Author:** ARTIFACT RESEARCH DIVISION

---

## Abstract

The AV Treasury is an autonomous on-chain economic system that maintains itself through programmatic value capture, algorithmic monetary policy, and decentralized governance. It issues two native tokens: **Au (Gold)**, a utility token required for all system operations, and **Ag (Silver)**, a governance token distributed to liquidity providers and stakers. Every interaction with the system generates fees, a portion of which is used to buy back Au from open markets and redistribute it to participants, creating a self-reinforcing economic flywheel.

This system functions as a **decentralized central bank**: Au is the currency, Ag represents governance shares in the monetary policy framework, PID emission control implements interest-rate-like policy, TreasuryAMO manages foreign exchange reserves, and a GovernorContract provides decentralized oversight. An oracle infrastructure provides manipulation-resistant price feeds that drive both monetary policy and automated peg-support operations.

All contracts are live on **Base Mainnet** (Chain ID: 8453), an Ethereum Layer 2.

---

## Table of Contents

1. [Introduction & Philosophy](#1-introduction--philosophy)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Token Design](#3-token-design)
4. [The Flywheel: Four-Layer Value Accrual](#4-the-flywheel-four-layer-value-accrual)
5. [PID Emission Controller: Algorithmic Monetary Policy](#5-pid-emission-controller-algorithmic-monetary-policy)
6. [TreasuryAMO: Foreign Exchange Reserve Management](#6-treasuryamo-foreign-exchange-reserve-management)
7. [Oracle Integration: Price Intelligence & Peg Support](#7-oracle-integration-price-intelligence--peg-support)
8. [Governance Formalization: GovernorContract](#8-governance-formalization-governorcontract)
9. [Central Banking Model](#9-central-banking-model)
10. [Security Architecture](#10-security-architecture)
11. [Deployment Status](#11-deployment-status)
12. [Risk Factors](#12-risk-factors)
13. [What This System Is and Is Not](#13-what-this-system-is-and-is-not)
14. [Future Integration](#14-future-integration)
15. [Conclusion](#15-conclusion)

---

## 1. Introduction & Philosophy

### 1.1 The Problem

Most blockchain token systems face a fundamental sustainability problem: they require continuous external capital inflows to maintain value. When new capital slows, the system enters a death spiral—participants leave, liquidity drains, and token value collapses. Existing models rely on either inflationary emissions (diluting holders) or speculative demand (requiring perpetual growth).

The AV Treasury addresses this by creating a **self-sustaining economic organism**—a system that captures value from its own operations and recycles that value back into the system without relying on external capital or speculative mania.

### 1.2 Design Philosophy

| Principle | Implementation |
|---|---|
| Self-sustainability | Every operation generates fees; fees drive buybacks |
| Algorithmic control | PID controller replaces discretionary monetary policy |
| Decentralized governance | GovernorContract with timelock, quorum, and delegation |
| Manipulation resistance | TWAP oracles with deviation detection and bounds checking |
| Progressive decentralization | Admin powers narrow over time toward full autonomy |

### 1.3 The Bootstrapping Phase

The AV Treasury is currently in its **early bootstrapping phase**. The Au token trades at approximately **$0.0085 USDC**—far below the $1.00 target that the system's peg-support mechanisms are calibrated for. This is expected and intentional:

1. **Early Au pricing reflects adoption stage** — As the ecosystem grows (Dapps launching, AI compute consuming Au), demand-side pressure will push Au toward its peg.
2. **The system is designed for this** — PID emission floors, buyback runway reserves, and the TreasuryAMO provide structural support regardless of current price.
3. **The $0.98 buyback trigger is conservative** — At current price levels, the OracleFlashBuy mechanism will aggressively absorb any sell pressure that drives Au below the oracle-determined fair value.
4. **Governance can recalibrate** — The GovernorContract can adjust PID parameters, buyback thresholds, and emission rates as the system matures.

**Implication for participants:** Early stakers and liquidity providers receive higher Ag emissions (PID compensates for lower TVL with higher per-unit rewards), positioning them for outsized governance power and fee accrual as the system scales.

---

## 2. System Architecture Overview

### 2.1 Component Map

```
                            ┌─────────────────────────────┐
                            │       GovernorContract        │
                            │   (Decentralized Oversight)   │
                            └──────────────┬───────────────┘
                                           │ proposes/executes
                                           ▼
┌──────────┐    fees     ┌──────────┐   auAgPrice   ┌──────────────┐
│  Dapps   │───────────▶│  Fee     │─────────────▶│  TreasuryAMO │
│  (Au     │            │  Engine  │              │  (Reserve +   │
│  spent)  │            └────┬─────┘              │  Buybacks)   │
└──────────┘                 │                    └──────┬───────┘
                             │ buybackAmount             │
                             ▼                           ▼
                      ┌──────────┐  swapUSDCforAu  ┌──────────┐
                      │  PID     │────────────────▶│ DEX      │
                      │  Emission│                  │ (Aero-   │
                      │  Control │                  │ drome)   │
                      └────┬─────┘                  └─────▲────┘
                           │ Au/block                       │
                           ▼                       buyback │
                      ┌──────────┐  stake        ┌────────┴───┐
                      │Staking   │◀──────────────│OracleFlash │
                      │(Au+Ag    │               │Buy         │
                      │ rewards) │               └──────▲─────┘
                      └────┬─────┘                       │
                           │                             │
                           ▼                       deviation│
                      ┌──────────┐                  detected│
                      │  LP NFT  │               ┌──────────┴───┐
                      │  Staking  │               │OracleWrapper │
                      │  (Au+Ag  │               │(Deviation    │
                      │  + NFT)  │               │ Detection)   │
                      └──────────┘               └──────▲───────┘
                                                       │
                            ┌──────────────────────────┴───┐
                            │         AvOracle              │
                            │  (TWAP + Chainlink Fallback)  │
                            └───────────────────────────────┘
```

### 2.2 Contract Inventory

| Contract | Role | Layer |
|---|---|---|
| AuToken | Native utility token (ERC-20) | Core |
| AgToken | Governance token (ERC-20) | Core |
| AVLPStaking_v2 | Staking + LP NFT rewards | Core |
| PID_Emission_Controller_v2 | Algorithmic monetary policy | Monetary |
| TreasuryAMO | Reserve management + buybacks | Monetary |
| GovernorContract | Decentralized governance | Governance |
| ArtifactTimelock | Timelock for governance actions | Governance |
| OracleWrapper | Deviation detection + triggers | Infrastructure |
| OracleFlashBuy | Automated below-peg buybacks | Infrastructure |
| AvOracle | TWAP + Chainlink price feeds | Infrastructure |

### 2.3 Interaction Flow

A complete lifecycle of value through the system:

1. A **Dapp** requires Au for operation (compute, access, attestation)
2. Au is spent → **Fee Engine** captures a portion (e.g., 1.5%)
3. Fees are split: one portion funds **PID emissions** (new Au for stakers), another portion is routed to **TreasuryAMO** for buybacks
4. **TreasuryAMO** queries **OracleWrapper** for the current Au/USDC price via **AvOracle**
5. If Au trades below peg, **OracleFlashBuy** executes a DEX swap (USDC → Au) to support price
6. Bought-back Au is distributed to stakers as additional yield, compounding the flywheel

---

## 3. Token Design

### 3.1 Au (Gold) — The Utility Token

| Property | Value |
|---|---|
| Name | Au Token |
| Symbol | Au |
| Decimals | 18 |
| Supply | Inflationary (PID-controlled) |
| Current Price | ~$0.0085 USDC (bootstrapping phase) |
| Target Peg | $1.00 USDC (long-term) |
| Utility | Required for all Dapp operations |
| Fee Generation | Every transfer/burn produces fees |

Au is the **currency** of the AV ecosystem. It is required for:
- AI compute resource consumption
- Dapp operation fees
- Shard attestation operations
- Staking into LP positions

Au is **not** a stablecoin. Its price is market-determined, though the system's buyback mechanisms and PID emission floor provide structural support.

### 3.2 Ag (Silver) — The Governance Token

| Property | Value |
|---|---|
| Name | Ag Token |
| Symbol | Ag |
| Decimals | 18 |
| Supply | Inflationary (PID-controlled) |
| Distribution | LP staking rewards + direct staking |
| Governance Power | Ag balance + veAg time-weighted balance |
| Voting | GovernorContract proposals |

Ag represents **governance shares** in the AV Treasury. Holders can:
- Vote on monetary policy parameters (PID tuning)
- Approve treasury allocation changes
- Adjust oracle thresholds and buyback limits
- Upgrade contract implementations

Ag is earned by providing liquidity (LP NFT staking) or staking Au/Ag directly.

### 3.3 veAg (Vested Escrow Ag) — Time-Weighted Governance

Users can lock Ag to receive **veAg** (vested escrow Ag), which provides:
- **Multiplied voting power** — Longer locks = higher voting weight
- **Proportional fee share** — veAg holders receive a portion of protocol fees
- **Governance commitment** — Signals long-term alignment

```
veAg_weight = Ag_locked × (lock_duration / max_lock_duration)

Where:
  max_lock_duration = 4 years (1,461 days)
  min_lock_duration = 1 week (7 days)
```

This mechanism ensures that governance power is weighted toward participants with the longest time horizons, aligning incentives with the system's sustained health.

### 3.4 Token Relationship Diagram

```
                    ┌─────────────────┐
                    │   Dapp Users    │
                    │   (need Au)     │
                    └────────┬────────┘
                             │ spend Au
                             ▼
                    ┌─────────────────┐
                    │   Fee Engine    │
                    │   (1.5% fee)    │
                    └────┬───────┬────┘
                         │       │
              PID Au/block│       │buybackAmount
                         ▼       ▼
                  ┌──────────┐ ┌──────────────┐
                  │ Staking  │ │ TreasuryAMO  │
                  │ Rewards  │ │ (USDC Res.)  │
                  └────┬─────┘ └──────┬───────┘
                       │              │
           Au + Ag     │              │ buyback Au
           rewards     ▼              ▼
                  ┌──────────┐  ┌──────────┐
                  │LP Stakers│  │ DEX Swap │
                  │(LP NFTs) │  │(Aerodrome│
                  └──────────┘  └──────────┘
```

---

## 4. The Flywheel: Four-Layer Value Accrual

### 4.1 Flywheel Overview

The AV Treasury's flywheel is a **four-layer positive feedback loop**. Each layer reinforces the next, creating compounding value accrual as the system scales.

```
        ┌──────────────────────────────────────────────┐
        │                                              │
        │   Layer 4: Oracle/Buyback                    │
        │   ┌──────────────────────────────────┐       │
        │   │  Oracle detects below-peg Au     │       │
        │   │  → FlashBuy executes USDC→Au     │       │
        │   │  → Buoyancy supports price        │       │
        │   └──────────────┬───────────────────┘       │
        │                  │                            │
        │                  ▼                            │
        │   Layer 3: PID Monetary Policy               │
        │   ┌──────────────────────────────────┐       │
        │   │  PID reads auAgPrice from oracle  │       │
        │   │  → Adjusts Au emission rate       │       │
        │   │  → Compounds staker yields        │       │
        │   └──────────────┬───────────────────┘       │
        │                  │                            │
        │                  ▼                            │
        │   Layer 2: Staking Demand                  │
        │   ┌──────────────────────────────────┐       │
        │   │  Higher yields → more staking     │       │
        │   │  → More Au locked in LP          │       │
        │   │  → Reduced circulating supply     │       │
        │   └──────────────┬───────────────────┘       │
        │                  │                            │
        │                  ▼                            │
        │   Layer 1: Dapp Demand                     │
        │   ┌──────────────────────────────────┐       │
        │   │  More Dapps → more Au spent      │       │
        │   │  → More fees generated           │       │
        │   │  → More buyback pressure         │       │
        │   └──────────────┬───────────────────┘       │
        │                  │                            │
        │                  └──────── back to Layer 4   │
        │                                              │
        └──────────────────────────────────────────────┘
```

### 4.2 Layer 1: Dapp Demand

**Mechanism:** Dapps require Au for operation. Every Au spent generates fees.

- As more Dapps launch on the AV ecosystem, aggregate Au consumption increases
- Fee revenue scales linearly (or super-linearly) with adoption
- This is the **exogenous input** that drives the entire flywheel

**Current state:** The ecosystem is in early bootstrapping. Initial Dapps (AI compute, Shard attestation) are being onboarded. Au price at ~$0.0085 reflects early adoption, not failure—the flywheel is beginning to spin.

### 4.3 Layer 2: Staking Demand

**Mechanism:** PID-controlled emissions create yield that attracts stakers.

- Stakers deposit Au/Ag LP tokens into AVLPStaking_v2
- They earn Au (from PID) + Ag (from PID) + LP NFT rewards
- Higher PID rates (triggered by low TVL) mean **early stakers earn more**
- Staked Au is locked, reducing circulating supply and creating scarcity

**Feedback loop:** As Au price rises from buyback pressure → TVL increases → PID reduces per-unit emissions → but total fee revenue increases → net staker yield remains attractive

### 4.4 Layer 3: PID Monetary Policy

**Mechanism:** The PID Emission Controller algorithmically adjusts Au emission rates based on the Au/Ag price ratio.

- PID reads `auAgPrice` from OracleWrapper
- When Au is undervalued relative to Ag → PID increases Au emission (expansionary policy)
- When Au is overvalued → PID decreases emission (contractionary policy)
- This creates **counter-cyclical monetary policy** that stabilizes the system

**Key insight:** PID doesn't target a specific Au price in USDC terms—it targets a healthy Au/Ag ratio that reflects balanced growth between utility demand and governance participation.

### 4.5 Layer 4: Oracle/Buyback Layer (NEW)

**Mechanism:** The oracle infrastructure detects below-peg conditions and triggers automated buybacks.

- **OracleWrapper** continuously monitors Au price against TWAP references
- When Au drops below a configurable threshold (currently $0.98, adjustable by governance), **OracleFlashBuy** is signaled
- OracleFlashBuy swaps USDC from TreasuryAMO reserves for Au on Aerodrome (Base DEX)
- This creates **automatic, programmatic buyback pressure** that supports Au price

**Why this layer matters:** In traditional flywheels, buyback pressure depends on manual intervention or simple time-based rules. The oracle/buyback layer adds **intelligence**—buybacks only occur when needed, at the right price, with manipulation-resistant validation.

**Current bootstrapping implication:** At Au ~$0.0085, the OracleFlashBuy mechanism is highly sensitive. Any significant sell-off that pushes Au below the oracle-determined fair value will trigger immediate buyback execution, providing a strong floor. As Au approaches $1.00, the mechanism becomes more about defending the peg against moderate dips.

### 4.6 Flywheel Equilibrium

The system reaches equilibrium when:

```
Dapp Demand (Au spent/day) × Fee Rate = Buyback Amount (USDC/day) + PID Au Emission Value

AND

Staker Yield (Au + Ag + fees) ≥ Opportunity Cost (risk-free DeFi yield)

AND

Au Market Price ≈ Oracle-determined Fair Value ± deviation_threshold
```

At this point, the flywheel spins sustainably: fees fund buybacks, buybacks support price, price stability attracts Dapps, Dapp usage generates more fees.

---

## 5. PID Emission Controller: Algorithmic Monetary Policy

### 5.1 Overview

The PID (Proportional-Integral-Derivative) Emission Controller is the **monetary policy engine** of the AV Treasury. It algorithmically adjusts the rate at which new Au tokens are minted and distributed to stakers, analogous to how central banks adjust interest rates or money supply.

### 5.2 PID Fundamentals

A PID controller computes an output based on the difference (error) between a measured variable and a target setpoint:

```
u(t) = Kp·e(t) + Ki·∫e(τ)dτ + Kd·de(t)/dt

Where:
  u(t)    = control output (Au emission rate)
  e(t)    = error = setpoint - measured_value
  Kp      = proportional gain (reacts to current error)
  Ki      = integral gain (reacts to accumulated error)
  Kd      = derivative gain (reacts to rate of change)
```

### 5.3 Application to AV Treasury

| PID Component | Monetary Analogy | AV Implementation |
|---|---|---|
| **Setpoint** | Target inflation rate | Target Au/Ag price ratio |
| **Measured Variable** | CPI / economic indicators | `auAgPrice` from OracleWrapper |
| **Proportional (Kp)** | Immediate rate adjustment | Au emission change proportional to current deviation |
| **Integral (Ki)** | Cumulative policy correction | Au emission change based on persistent deviation over time |
| **Derivative (Kd)** | Forward-looking adjustment | Au emission change based on trend direction |
| **Output** | Interest rate decision | Au tokens per block |

### 5.4 Emission Rate Bounds

The PID output is bounded to prevent runaway inflation or deflation:

```
MIN_EMISSION ≤ PID_output ≤ MAX_EMISSION

Where:
  MIN_EMISSION = emission_floor (ensures baseline staker rewards)
  MAX_EMISSION = emission_cap (prevents excessive dilution)
```

Additionally, an **emission floor** ensures that even when the PID would reduce emissions to zero (because Au is overvalued), stakers still receive baseline rewards. This prevents a scenario where the system completely stops incentivizing participation.

### 5.5 PID State Variables

```solidity
struct PIDState {
    uint256 auAgPrice;          // Current Au/Ag price from oracle
    uint256 setpoint;           // Target Au/Ag ratio (governance-set)
    uint256 kp;                 // Proportional gain (scaled by 1e18)
    uint256 ki;                 // Integral gain (scaled by 1e18)
    uint256 kd;                 // Derivative gain (scaled by 1e18)
    uint256 integral;           // Accumulated error
    uint256 lastError;          // Previous error (for derivative)
    uint256 lastUpdateBlock;    // Block of last update
    uint256 emissionRate;       // Current Au/block emission
}
```

### 5.6 Monetary Policy Scenarios

| Scenario | PID Response | Effect |
|---|---|---|
| Au undervalued vs Ag | Increase Au emission | More rewards → more staking → price support |
| Au overvalued vs Ag | Decrease Au emission | Less inflation → scarcity → price support |
| Persistent undervaluation | Integral term accumulates → stronger response | Aggressive expansion |
| Rapid price change | Derivative term dampens oscillation | Stability |
| Au at target | Minimal adjustment | Steady-state operation |

### 5.7 PID and the Oracle Connection

The PID controller reads `auAgPrice` from **OracleWrapper**, not directly from a DEX. This is critical:

1. **Manipulation resistance** — OracleWrapper validates prices against TWAP, rejecting flash-loan-distorted values
2. **Deviation bounds** — If the current price deviates >5% from the reference, the update is rejected
3. **Staleness check** — Prices older than 1 hour are rejected (Chainlink fallback if TWAP is stale)

This means the PID controller makes monetary policy decisions based on **validated, manipulation-resistant price data**, not easily-gamed spot prices.

---

## 6. TreasuryAMO: Foreign Exchange Reserve Management

### 6.1 Overview

The TreasuryAMO (Automated Market Operator) functions as the **foreign exchange reserve** of the AV Treasury central bank. It holds USDC reserves and deploys them for:

1. **Au buybacks** — Supporting Au price when it trades below peg
2. **Liquidity provision** — Ensuring healthy Au/USDC markets
3. **Reserve management** — Maintaining adequate runway for sustained operations

### 6.2 Reserve Sources

| Source | Mechanism |
|---|---|
| Fee revenue | Portion of Dapp fees routed to TreasuryAMO |
| Buyback proceeds | USDC accumulated from DEX operations |
| Surplus Au | Excess Au from PID emissions (sold for USDC) |

### 6.3 Buyback Execution Flow

```
OracleWrapper detects Au < $0.98
        │
        ▼
TreasuryAMO.swapUSDCforAu(amountUSDC, minAuOut)
        │
        ├── Validate: amountUSDC ≤ maxPerExecution (1,000 USDC)
        ├── Validate: cooldown period elapsed (1 hour)
        ├── Validate: OracleWrapper confirms below-peg condition
        │
        ▼
Aerodrome DEX: USDC → Au
        │
        ▼
Bought Au → Distributed to stakers as supplemental yield
```

### 6.4 Reserve Runway

The TreasuryAMO maintains a **minimum 24-month runway** of USDC reserves:

```
Runway (months) = USDC_Reserve / (Monthly_Buyback_Spend + Monthly_Operations)

If Runway < 6 months:
  → Governance is alerted
  → PID may increase emission to attract more TVL
  → Fee rate adjustment may be proposed
```

### 6.5 TreasuryAMO Parameters

| Parameter | Value | Adjustable by Governance |
|---|---|---|
| Max buyback per execution | 1,000 USDC | Yes |
| Buyback cooldown | 1 hour | Yes |
| Buyback trigger price | $0.98 (or oracle fair value) | Yes |
| Reserve runway minimum | 6 months (alert threshold) | Yes |
| DEX router | Aerodrome | Yes |

### 6.6 Relationship to Oracle

TreasuryAMO does not hold or manage price data—it **consumes** validated prices from OracleWrapper:

- TreasuryAMO calls `OracleWrapper.auAgPrice()` to determine if conditions warrant action
- OracleWrapper provides a single, validated price that accounts for TWAP, Chainlink, and deviation checks
- This separation of concerns means TreasuryAMO logic is simple and predictable, while oracle complexity is isolated

---

## 7. Oracle Integration: Price Intelligence & Peg Support

### 7.1 Oracle Architecture Overview

The AV Treasury operates a **three-layer oracle stack** that provides manipulation-resistant price data to all downstream contracts:

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 3: Consumers                     │
│  PID Controller │ TreasuryAMO │ OracleFlashBuy │ Frontend│
└────────────┬────────────┬────────────┬───────────────────┘
             │            │            │
             ▼            ▼            ▼
┌─────────────────────────────────────────────────────────┐
│                    Layer 2: OracleWrapper                 │
│  • Deviation detection (>5% from reference → reject)     │
│  • Price bounds validation ($0.0001 - $1000)             │
│  • Staleness check (>1 hour → reject)                   │
│  • Below-peg signal generation                          │
│  • FlashBuy trigger activation                          │
│  Deployed: 0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Layer 1: AvOracle                      │
│  • TWAP reader (time-weighted average from DEX pools)    │
│  • Chainlink fallback (if TWAP stale >1 hour)           │
│  • Dual DEX support (Aerodrome + backup)                │
│  Deployed: 0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD   │
└─────────────────────────────────────────────────────────┘
```

### 7.2 AvOracle: Primary Price Feed

AvOracle is the **base data layer**. It provides raw price information:

| Feature | Implementation |
|---|---|
| Primary source | TWAP from on-chain DEX pools |
| Fallback source | Chainlink price feeds |
| Staleness threshold | 1 hour (if TWAP data >1h old, use Chainlink) |
| Update frequency | On-demand (called by consumers) |
| Manipulation resistance | TWAP inherently resistant to flash loan attacks |
| Multi-DEX | Can read from multiple pools for cross-validation |

**Why TWAP?** A flash loan attacker can momentarily distort a DEX spot price, but they cannot distort a time-weighted average that spans the duration of their manipulation. The attacker would need to maintain the distorted price for the entire TWAP window, which is prohibitively expensive.

### 7.3 OracleWrapper: Deviation Detection & Trigger Layer

OracleWrapper sits between AvOracle and downstream contracts, adding **validation and intelligence**:

#### 7.3.1 Deviation Detection Mechanism

```solidity
function updateAuAgPrice() external {
    uint256 currentPrice = avOracle.getAuAgPrice();
    uint256 referencePrice = getReferencePrice(); // TWAP or last valid
    
    uint256 deviation = _calculateDeviation(currentPrice, referencePrice);
    
    require(deviation <= MAX_DEVIATION, "OracleWrapper: deviation exceeds threshold");
    // MAX_DEVIATION = 5% (50000000000000000000 in 1e18 precision)
    
    auAgPrice = currentPrice;
    lastUpdateBlock = block.number;
    emit PriceUpdated(currentPrice, referencePrice, deviation);
}
```

**Deviation calculation:**
```
deviation = |currentPrice - referencePrice| / referencePrice

If deviation > 5%:
  → Transaction reverts
  → PID does not update (uses last valid price)
  → TreasuryAMO does not execute buyback
  → System remains in safe state
```

#### 7.3.2 Price Bounds

OracleWrapper enforces absolute price bounds as a final safety layer:

```
LOWER_BOUND = $0.0001 USDC per Au
UPPER_BOUND = $1000 USDC per Au

If price < LOWER_BOUND or price > UPPER_BOUND:
  → Reject update
  → Flag for governance review
```

These bounds are intentionally wide to avoid false positives during volatile markets, while catching clearly erroneous oracle responses.

#### 7.3.3 Below-Peg Detection & FlashBuy Trigger

```solidity
function checkBelowPegCondition() external view returns (bool) {
    uint256 currentPrice = getAuUSDCPrice();
    uint256 pegPrice = getPegPrice(); // e.g., $0.98 or oracle fair value
    
    return currentPrice < pegPrice;
}

// Called by OracleFlashBuy or any external actor
function signalFlashBuy() external {
    require(checkBelowPegCondition(), "OracleWrapper: price above peg");
    emit FlashBuySignaled(auPrice, pegPrice, block.timestamp);
}
```

**Current bootstrapping note:** At Au ~$0.0085, the below-peg condition is almost always true. This means OracleFlashBuy will be highly active during the bootstrapping phase, providing continuous buyback pressure. This is the intended behavior—the system is designed to aggressively accumulate Au at early-stage prices.

### 7.4 OracleFlashBuy: Automated Buyback Executor

OracleFlashBuy is the **automated market operations agent** that executes buybacks when OracleWrapper signals a below-peg condition.

#### 7.4.1 Execution Flow

```
1. Anyone (keeper, bot, user) calls OracleFlashBuy.executeBuyback(amountUSDC)
2. OracleFlashBuy re-verifies below-peg condition via OracleWrapper
3. If confirmed, transfers USDC from TreasuryAMO
4. Swaps USDC → Au on Aerodrome DEX
5. Transfers bought Au to Staking contract as supplemental rewards
6. Updates lastExecution timestamp (cooldown)
```

#### 7.4.2 Safety Mechanisms

| Mechanism | Purpose | Value |
|---|---|---|
| Re-verification | Prevents buying at manipulated prices | Calls OracleWrapper before every swap |
| Max per execution | Limits exposure to oracle errors | 1,000 USDC |
| Cooldown period | Prevents rapid draining of reserves | 1 hour |
| Slippage protection | Ensures fair swap rate | minAuOut parameter |
| Oracle safety check | Validates price within bounds | Inherited from OracleWrapper |

#### 7.4.3 Keeper Incentive

External keepers can call `executeBuyback()` and receive a small incentive (gas reimbursement + small Au bonus). This ensures that even when TreasuryAMO is not actively monitoring, third-party keepers maintain the buyback mechanism.

### 7.5 Oracle Data Flow Diagram

```
DEX Pools (Aerodrome)
    │
    │ spot price (manipulable)
    │ TWAP (manipulation-resistant)
    ▼
AvOracle ──────────────────── Chainlink (fallback)
    │                              │
    │ getAuAgPrice()               │ (if TWAP stale)
    ▼                              │
OracleWrapper ◀───────────────────┘
    │
    ├── Deviation check (>5% → reject)
    ├── Bounds check ($0.0001 - $1000)
    ├── Staleness check (<1 hour)
    │
    ├──→ PID Controller (auAgPrice for monetary policy)
    ├──→ TreasuryAMO (price for buyback decisions)
    └──→ OracleFlashBuy (below-peg signal)
              │
              ▼
         DEX Swap: USDC → Au
              │
              ▼
         Stakers receive bought-back Au
```

### 7.6 Oracle Governance

Oracle parameters are controlled by governance through GovernorContract:

| Parameter | Current | Adjustable |
|---|---|---|
| MAX_DEVIATION | 5% | Yes |
| LOWER_BOUND | $0.0001 | Yes |
| UPPER_BOUND | $1,000 | Yes |
| STALENESS_THRESHOLD | 1 hour | Yes |
| FlashBuy trigger price | $0.98 | Yes |
| FlashBuy max per execution | 1,000 USDC | Yes |
| FlashBuy cooldown | 1 hour | Yes |

---

## 8. Governance Formalization: GovernorContract

### 8.1 Overview

The GovernorContract is the **decentralized governance layer** of the AV Treasury. It enables Ag and veAg holders to propose, vote on, and execute changes to the system's parameters, architecture, and policies. It functions as the **central bank council**—a deliberative body that sets policy but cannot act unilaterally or instantaneously.

### 8.2 Proposal Lifecycle

```
┌─────────┐    submit     ┌─────────┐   votingDelay   ┌─────────┐
│  DRAFT  │──────────────▶│ ACTIVE  │───────────────▶│ VOTING  │
│         │               │         │   (1 day)       │ PERIOD  │
│ (off-   │               │(queued) │                 │(5 days) │
│  chain) │               │         │                 │         │
└─────────┘               └─────────┘                 └────┬────┘
                                                           │
                              ┌────────────────────────────┤
                              │ quorum reached & majority yes
                              ▼
                         ┌─────────┐   timelock    ┌──────────┐
                         │ QUEUED  │──────────────▶│EXECUTED  │
                         │         │   (2 days)    │          │
                         │(timelock│               │(on-chain │
         ┌───────────────│ delay)  │               │ effect)  │
         │               └────┬────┘               └──────────┘
         │                    │
         │ quorum not reached │ majority no
         │ or voting expired  │
         ▼                    ▼
    ┌──────────┐        ┌───────────┐
    │CANCELLED │        │ CANCELLED │
    └──────────┘        └───────────┘
```

### 8.3 Proposal States

| State | Description | Transitions To |
|---|---|---|
| **Draft** | Off-chain preparation, not yet submitted | Active (when submitted) |
| **Active** | Submitted, voting delay not yet elapsed | Voting Period (after delay) |
| **Voting Period** | Active voting, countdown running | Queued (if passed), Cancelled (if failed) |
| **Queued** | Passed, in timelock delay | Executed (after timelock), Cancelled (if cancelled) |
| **Executed** | Successfully executed on-chain | Terminal |
| **Cancelled