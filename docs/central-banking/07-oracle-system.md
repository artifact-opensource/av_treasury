---
title: 07 — AvOracle v5 and OracleWrapper — Price Infrastructure
date: 2026-06-29
status: draft
description: The three-layer oracle stack. Covers TWAP price feeds, deviation detection, staleness checks, Chainlink fallback, and how manipulation-resistant data powers the PID and FlashBuy.
category: central-banking
related: [02-monetary-policy-engine.md, 08-flashbuy-mechanism.md, 04-treasury-amo.md, INDEX.md]
---

# 07 — Oracle System

## 7.1 Overview

The AV Treasury operates a **three-layer oracle stack** that provides
manipulation-resistant price data to all downstream contracts. The PID's
monetary policy decisions and FlashBuy's triggers depend entirely on oracle data.

## 7.2 Architecture

```
Layer 3: Consumers
  PID Controller │ TreasuryAMO │ FlashBuy │ Frontend
             │            │            │
             ▼            ▼            ▼
Layer 2: OracleWrapper (0xb479...32bdB)
  • Deviation detection (>5% from reference → reject)
  • Price bounds validation
  • Staleness check (>1 hour → reject)
  • Below-peg signal generation
  • FlashBuy trigger activation
             │
             ▼
Layer 1: AvOracle v5 (0xfd04...47CD)
  • TWAP reader (time-weighted average from DEX pools)
  • Chainlink fallback (if TWAP stale >1 hour)
  • Concentrated liquidity aware (Slipstream)
```

## 7.3 Layer 1: AvOracle v5

**Contract:** `0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD`

### 7.3.1 TWAP

```
TWAP = Σ(price_i × Δt_i) / Σ(Δt_i)
Window: configurable (default: 30 minutes)
```

TWAP requires sustained manipulation over the entire window, making attacks
prohibitively expensive.

### 7.3.2 Chainlink Fallback

If TWAP data is stale (>1 hour), falls back to Chainlink price feeds.

### 7.3.3 Concentrated Liquidity Awareness

Reads TWAP from Slipstream's concentrated liquidity pools.

## 7.4 Layer 2: OracleWrapper

**Contract:** `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB`

### 7.4.1 Deviation Detection

```
deviation = |new_price − reference_price| / reference_price
If deviation > 5% → Reject update + log anomaly + use last valid price
```

### 7.4.2 Staleness Check

Prices older than 1 hour are rejected. Consumers switch to fallback logic.

### 7.4.3 Price Bounds

```
MIN_PRICE = $0.0001
MAX_PRICE = $1000.00
```

### 7.4.4 Below-Peg Signal

```
below_peg = (market_price < NAV × (1 − threshold))
threshold = 2% (governance-adjustable)
```

## 7.5 Consumer Integration

- **PID Controller:** Reads validated TVL from OracleWrapper
- **FlashBuy:** Reads below-peg signal
- **TreasuryAMO:** NAV calculation, deposit/redemption pricing

## 7.6 Security Properties

| Attack Vector | Defense |
|--------------|---------|
| Flash loan manipulation | TWAP window (30 min) |
| Oracle stale data | Staleness check + Chainlink fallback |
| Extreme price spikes | 5% deviation detection + hard bounds |
| Governance attack on oracle | Timelock-controlled parameters |
| Chainlink downtime | TWAP primary, Chainlink backup |
| Concentrated pool manipulation | Multiple sources + deviation check |

## 7.7 Governance Parameters

| Parameter | Current | Range |
|-----------|---------|-------|
| TWAP window | 30 min | 5 min – 24 hr |
| Deviation threshold | 5% | 1% – 20% |
| Staleness threshold | 1 hr | 5 min – 24 hr |
| Below-peg threshold | 2% | 0.5% – 10% |
| Price bounds | $0.0001–$1000 | Any |
