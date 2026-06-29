---
title: 06 — Liquidity Provisioning via Slipstream
date: 2026-06-29
status: draft
description: How the TreasuryAMO manages concentrated liquidity on Slipstream (Base's CL-AMM). Covers position management, fee generation, rebalancing, and protocol-owned liquidity.
category: central-banking
related: [04-treasury-amo.md, 05-flywheel-mechanics.md, 08-flashbuy-mechanism.md, INDEX.md]
---

# 06 — Liquidity Provisioning via Slipstream

## 6.1 Overview

The TreasuryAMO holds **protocol-owned liquidity** on Slipstream, Base's
concentrated liquidity AMM (fork of Uniswap v3). This liquidity serves three
purposes:
1. Exit liquidity for Au holders
2. Fee income for the treasury
3. Price stability through passive market making

## 6.2 Active Slipstream Pools

| Pool | Fee Tier | Status |
|------|----------|--------|
| Au/WETH | 0.3% | Active |
| Au/USDC | 0.05% | Active |

Pool addresses confirmed in [address.book](../../address.book).

## 6.3 Concentrated Liquidity Mechanics

### 6.3.1 Position Structure

```
Position {
  token0: Au or WETH/USDC
  token1: WETH or USDC
  tickLower: lower price bound
  tickUpper: upper price bound
  liquidity: amount of concentrated liquidity
}
```

### 6.3.2 Current Ranges

| Pool | Lower Bound | Upper Bound | Strategy |
|------|------------|------------|----------|
| Au/WETH | NAV × 0.85 | NAV × 1.15 | Tight range around NAV |
| Au/USDC | NAV × 0.90 | NAV × 1.05 | Tighter, stable-heavy |

## 6.4 Fee Generation

```
daily_fee_estimate = daily_volume × fee_tier × (position_liquidity / total_pool_liquidity)

Example: $100K daily volume × 0.3% fee × 25% share = $75/day = ~$27K/year
```

## 6.5 Rebalancing Policy

### 6.5.1 Automatic Rebalance Triggers

| Condition | Action |
|-----------|--------|
| Price moves outside position range | Close and reopen at current price |
| NAV shifts >10% | Widen range to accommodate |
| Pool composition drifts >15% | Rebalance token ratios |
| Gas costs < expected fee income | Compound harvested fees |

### 6.5.2 Keeper Network

Rebalancing performed by incentivized keeper bots (0.1% of harvested rewards).

## 6.6 Protocol-Owned Liquidity (POL)

The TreasuryAMO's LP positions are **protocol-owned** — they cannot be
withdrawn by any individual. Benefits:

1. **Permanent liquidity** — users always have an exit
2. **Fee capture** — all swap fees accrue to protocol
3. **Price floor support** — deep liquidity reduces slippage
4. **No IL risk to LPs** — protocol absorbs impermanent loss

## 6.7 Slipstream Advantages over Uniswap v3

| Feature | Benefit |
|---------|---------|
| Native on Base | Lower gas costs |
| Optimized for L2 | Calldata efficiency |
| Uniswap v3 compatible | Same tooling, same math |
| Higher capital efficiency | More fees per dollar of liquidity |
