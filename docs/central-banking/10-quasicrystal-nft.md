---
title: 10 — QuasiCrystal LP NFT
date: 2026-06-29
status: draft
description: The QuasiCrystal LP NFT contract. Covers LP token staking, veAg-weighted multipliers, NFT mechanics, reward distribution, and terminology rectification.
category: central-banking
related: [03-emission-mechanics.md, 01-dual-token-architecture.md, 05-flywheel-mechanics.md, INDEX.md]
---

# 10 — QuasiCrystal LP NFT

## 10.1 Overview

The QuasiCrystal LP NFT is the **staking and reward distribution** contract.
Users deposit Slipstream LP tokens and receive an NFT representing their
staked position. The NFT encodes staked amount, lock duration, and rewards.

**Formerly known as:** RSBT, Soulbound Token (both deprecated — see §10.7)

## 10.2 Why an NFT?

Each staking position is unique — different amounts, different locks, different
reward accrual. An NFT naturally represents this:

```
NFT #1234 {
  staked_lp: 5000.00 LP
  lock_duration: 365 days
  veAg_weight: 150.00
  reward_debt: 42.50 Ag
  multiplier: 1.75×
}
```

## 10.3 Staking Flow

```
1. User provides liquidity on Slipstream → receives LP tokens
2. User approves QuasiCrystal to spend LP tokens
3. User calls stake(lp_amount, lock_duration)
4. Contract mints NFT to user
5. User earns Ag emissions proportional to NFT weight
```

## 10.4 Multiplier Mechanics

```
multiplier = 1.0 + (user_veAg / total_veAg) × 1.5
Range: 1.0× (no veAg) to 2.5× (dominant veAg holder)
```

## 10.5 Reward Distribution

```
user_reward = (epoch_emissions × 0.60) × (user_nft_weight / total_nft_weight)
```

Rewards can be claimed at any time. Auto-compound is opt-in per NFT.

## 10.6 Anti-Gaming Measures

| Measure | Implementation | Purpose |
|---------|---------------|---------|
| Minimum stake | 1 day | Prevents flash staking |
| Snapshot rewards | Epoch-start balance | Prevents front-running |
| Max lock | 4 years | Prevents permanent lock abuse |
| Unstaking cooldown | 24 hours | Prevents rapid enter/exit |
| Max NFTs per wallet | 100 | Prevents gas griefing |

## 10.7 Terminology Rectification

| Deprecated Term | Current Term | Reason |
|----------------|-------------|--------|
| RSBT | QuasiCrystal LP NFT | "RSBT" implied a token; it's an NFT |
| Soulbound Token | QuasiCrystal LP NFT | Not soulbound — transferable |
| RSBT Multiplier | veAg Multiplier | Based on veAg, not RSBT |
| RSBT Points | veAg Weight | Based on locked Ag |

All documentation, comments, and UI should use **QuasiCrystal LP NFT**
or simply **QuasiCrystal**.

## 10.8 Comparison with Traditional Staking

| Feature | Traditional Staking | QuasiCrystal LP NFT |
|---------|-------------------|---------------------|
| Asset staked | Single token | LP tokens (productive) |
| Lock duration | Fixed or none | 1 day – 4 years |
| Reward multiplier | None | veAg-weighted 1.0×–2.5× |
| Position | Balance | Unique NFT |
| Transferability | N/A | Transferable |
| Capital efficiency | Low | High (LP earns fees) |
