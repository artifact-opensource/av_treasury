---
title: 02 — PID Monetary Policy Engine
date: 2026-06-29
status: draft
description: The Proportional-Integral-Derivative (PID) controller that governs Ag token emissions. Covers the mathematical model, on-chain implementation, tuning parameters, and monetary policy scenarios.
category: central-banking
related: [01-dual-token-architecture.md, 03-emission-mechanics.md, 11-pid-mathematics.md, 12-stability-analysis.md, INDEX.md]
---

# 02 — PID Monetary Policy Engine

## 2.1 Overview

The PID Emission Controller is the **monetary policy engine** of the AV
Treasury. It algorithmically adjusts the rate at which new **Ag tokens**
are minted and distributed to stakers, analogous to how central banks adjust
interest rates or money supply.

**Contract:** `0x991138923880773D67c01392c31A255e770F7f70`

## 2.2 Central Banking Analogy

| Traditional Central Bank | AV Treasury PID |
|--------------------------|-----------------|
| Interest rate targeting | Ag emission rate targeting |
| GDP growth / employment data | TVL and price oracle data |
| Federal Reserve Board votes | Autonomous algorithm (governance-tuned) |
| Quarterly policy meetings | Per-epoch updates (5-day epochs) |
| Open market operations | Ag minting + FlashBuy buybacks |

## 2.3 PID Mathematical Model

### 2.3.1 Core Equation

```
E(t) = Kp · e(t) + Ki · ∫e(τ)dτ + Kd · de(t)/dt

Where:
  E(t) = Ag emission rate at time t (tokens per epoch)
  e(t) = target_TVL − actual_TVL (the "gap")
  Kp   = proportional gain (immediate response)
  Ki   = integral gain (steady-state correction)
  Kd   = derivative gain (dampening)
```

### 2.3.2 Discrete Implementation

On-chain, the continuous PID is discretized per epoch:

```
E[n] = Kp · e[n] + Ki · Σ(e[i] · Δt) + Kd · (e[n] − e[n−1]) / Δt

Where:
  n    = current epoch index
  Δt   = epoch duration (5 days = ~7,200 blocks on Base)
  e[n] = target_TVL[n] − actual_TVL[n]
```

### 2.3.3 Component Breakdown

**Proportional (P):** Reacts to the current gap. Bigger gap = harder push.

**Integral (I):** Accumulates past error. Eliminates steady-state offset.

**Derivative (D):** Predicts future error. Dampens oscillations.

## 2.4 On-Chain State Variables

```solidity
struct PIDState {
    uint256 targetTVL;          // Target TVL in USD (governance-set)
    uint256 actualTVL;          // Current TVL from oracle + Slipstream
    uint256 kp;                 // Proportional gain (scaled by 1e18)
    uint256 ki;                 // Integral gain (scaled by 1e18)
    uint256 kd;                 // Derivative gain (scaled by 1e18)
    uint256 integral;           // Accumulated error (Σ e·Δt)
    uint256 lastError;          // e[n-1] for derivative computation
    uint256 lastUpdateEpoch;    // Epoch of last update
    uint256 emissionRate;       // Current Ag/epoch emission
}
```

## 2.5 Emission Bounds

```
MIN_EMISSION ≤ E(t) ≤ MAX_EMISSION

  MIN_EMISSION = emission_floor (ensures baseline staker rewards)
  MAX_EMISSION = emission_cap (prevents excessive Ag dilution)
```

An emission floor ensures that even when TVL exceeds target, stakers still
receive baseline rewards.

## 2.6 Target TVL Scaling

```
Phase 1 (0-12 months): $500K → $5M linear ramp
Phase 2 (12+ months):  Governance-controlled adjustments

target_TVL(epoch) = initial_TVL + (max_TVL - initial_TVL) × min(epoch / ramp_epochs, 1)
```

## 2.7 Monetary Policy Scenarios

| Scenario | Error | PID Response | Effect |
|----------|-------|-------------|--------|
| TVL << Target | Large positive | High Ag emission | More rewards → more staking → TVL grows |
| TVL >> Target | Large negative | Low Ag emission | Less inflation → scarcity → price support |
| Persistent gap | Integral grows | Stronger response | Aggressive expansion |
| Rapid TVL rise | Derivative negative | Reduced emission | Prevents overshoot |
| TVL at target | e ≈ 0 | Minimal adjustment | Steady-state |
| Market crash | Negative spike | Emission floor | Baseline rewards continue |

## 2.8 Oracle Dependency

The PID reads TVL from **OracleWrapper** → **AvOracle v5**:
1. **Manipulation resistance** — TWAP-based prices
2. **Deviation bounds** — >5% from reference rejected
3. **Staleness check** — >1 hour rejected
4. **Multi-source** — Chainlink fallback

## 2.9 Governance Parameters

| Parameter | Current | Range | Effect |
|-----------|---------|-------|--------|
| Kp | 0.5 | 0–5 | Immediate response strength |
| Ki | 0.1 | 0–2 | Persistent error correction |
| Kd | 0.2 | 0–2 | Oscillation dampening |
| Epoch duration | 5 days | 1–30 days | Policy update frequency |
| Target TVL | Scaling curve | $100K–$1B | Growth target |
| Emission floor | > 0 | 0–10K/epoch | Minimum rewards |
| Emission cap | < 100M | 10K–1M/epoch | Maximum rewards |

## 2.10 Epoch Lifecycle

```
Day 0    : Epoch N begins. PID state from epoch N-1 is active.
Day 4.9  : Anyone can call updatePID() to compute new emission rate.
Day 5    : Epoch N+1 begins. New emission rate active.
           Stakers claim rewards from epoch N.
```
