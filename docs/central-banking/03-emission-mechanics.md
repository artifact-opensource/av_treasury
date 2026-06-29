---
title: 03 — Ag Emission Mechanics & Distribution
date: 2026-06-29
status: canonical
description: How PID-computed Ag emissions are distributed to LP stakers and the Treasury. Covers allocation ratios, claim mechanics, and anti-gaming measures.
category: central-banking
related: [02-monetary-policy-engine.md, 01-dual-token-architecture.md, 05-flywheel-mechanics.md, 10-quasicrystal-nft.md, INDEX.md]
---

# 03 — Ag Emission Mechanics & Distribution

## 3.1 Overview

The PID Controller computes a per-epoch Ag emission rate. This document
describes how those Ag tokens flow from minting to end recipients.

## 3.2 Emission Flow

```
PID Controller computes E(t)
         │
         ▼
   Ag tokens minted
         │
         ▼
   Epoch-end distribution:
   ├── 60% → QuasiCrystal LP NFT stakers (proportional to stake)
   ├── 25% → TreasuryAMO (operational reserve)
   └── 15% → Ecosystem / future distribution
```

## 3.3 Distribution Tiers

### 3.3.1 QuasiCrystal LP NFT Stakers (60%)

Largest share flows to users who provide liquidity and stake LP NFTs
in the QuasiCrystal LP NFT contract. Distribution is **proportional to
staked amount** — no veAg multiplier exists.

```
user_reward = 0.60 × E(t) × (user_staked_amount / total_staked)
```

### 3.3.2 TreasuryAMO (25%)

25% of emissions to TreasuryAMO as operational reserve. May be sold for
stablecoins, held as treasury assets, or used for FlashBuy operations.

### 3.3.3 Ecosystem Reserve (15%)

Future distribution, grants, incentives. Controlled by governance.

## 3.4 Anti-Gaming Measures

### 3.4.1 Snapshot-Based Distribution

Ag emissions are distributed based on **epoch-start snapshots**, not real-time
balances. Prevents emission front-running and flash staking.

### 3.4.2 Minimum Stake Duration

QuasiCrystal enforces a **1-day minimum stake duration**. Users who unstake
before 24 hours forfeit that epoch's rewards.

### 3.4.3 Smoothing

Emissions are smoothed across epochs:

```
smoothed_emission = α × current_PID_output + (1 − α) × previous_emission
Where α = 0.3 (governance-adjustable)
```

## 3.5 Supply Schedule

| Phase | Epochs | Characteristic |
|-------|--------|---------------|
| Bootstrap (0–72, ~1 year) | High emission, rapidly declining | Aggressive growth incentive |
| Growth (73–360, ~5 years) | Moderate, PID-steady | Market-driven equilibrium |
| Mature (360+) | Low, maintenance-level | Minimal new issuance |

The 100M Ag hard cap ensures supply will not be reached for approximately
15-20 years under normal conditions.

## 3.6 Voting Power

Ag uses `ERC20VotesUpgradeable`:
- Voting power = Ag balance at proposal checkpoint
- Delegatable to other addresses
- No lock, no multiplier, no time-weighting
- Snapshot-based for governance participation
