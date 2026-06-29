---
title: 05 — Economic Flywheel Mechanics
date: 2026-06-29
status: draft
description: The self-reinforcing economic cycle of the AV Treasury. How deposits, PID emissions, staking demand, and liquidity form a positive feedback loop.
category: central-banking
related: [02-monetary-policy-engine.md, 03-emission-mechanics.md, 04-treasury-amo.md, 06-liquidity-provisioning.md, INDEX.md]
---

# 05 — Economic Flywheel Mechanics

## 5.1 Overview

The AV Treasury flywheel is a **self-reinforcing economic cycle**. Each stage
feeds into the next, creating compounding growth. Unlike Ponzi-nomics, this
flywheel is anchored by real reserves and algorithmic monetary policy.

## 5.2 The Cycle

```
Step 1: DEPOSIT
  Users deposit ETH/stables into TreasuryAMO
  → TVL grows → Au is minted
  │
  ▼
Step 2: PID DETECTS GAP
  PID reads actual TVL vs target TVL
  → If TVL < target: increase Ag emissions
  → If TVL > target: decrease Ag emissions
  │
  ▼
Step 3: HIGHER APY
  More Ag distributed to stakers
  → Staking APY increases
  → QuasiCrystal multiplier boosts effective yield
  │
  ▼
Step 4: DEMAND RESPONSE
  High APY attracts new capital
  → More users buy Ag to participate
  → More users deposit to earn yield
  │
  ▼
Step 5: MORE LIQUIDITY
  Capital flows in → TVL increases
  → LP positions deepen → Au price stability improves
  │
  └──→ Back to Step 2
```

## 5.3 Flywheel Braking Mechanisms

| Mechanism | Trigger | Effect |
|-----------|---------|--------|
| PID derivative term | Rapid TVL growth | Reduces emission to prevent overshoot |
| Emission cap | PID output too high | Clamps maximum Ag/epoch |
| Reserve ratio floor | Reserves too low | Halts new minting |
| Transfer tax | Every Au transfer | 9bps friction reduces velocity |
| veAg decay | Lock expires | Gradual voting power reduction |

## 5.4 Flywheel Reversal

The flywheel can reverse (capital outflow). The PID handles this:

```
TVL drops → PID error increases → Emissions rise to floor
→ Stakers still earn baseline rewards → Prevents mass exodus
→ FlashBuy activates if Au < NAV → Price floor support
```

The system is designed to **slow contraction, not prevent it**. A system that
prevents exits is a trap.

## 5.5 Comparison with Traditional Economic Cycles

| Phase | Traditional Economy | AV Treasury |
|-------|-------------------|-------------|
| Expansion | Low rates, high growth | High Ag emission, TVL growth |
| Peak | Inflation concerns | PID reduces emission |
| Contraction | Rate cuts | Emission floor, FlashBuy |
| Recovery | Stimulus | PID detects gap, increases emission |

Key difference: AV Treasury operates at blockchain speed. Traditional central
banks meet every 6 weeks. The PID updates every 5 days.
