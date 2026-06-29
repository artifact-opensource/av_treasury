---
title: 08 — FlashBuy Treasury Buyback Mechanism
date: 2026-06-29
status: draft
description: The FlashBuy contract as lender-of-last-resort. Covers buyback triggers, execution mechanics, funding sources, and price floor dynamics.
category: central-banking
related: [04-treasury-amo.md, 07-oracle-system.md, 05-flywheel-mechanics.md, INDEX.md]
---

# 08 — FlashBuy Mechanism

## 8.1 Overview

FlashBuy is the **lender-of-last-resort** mechanism. When Au trades below
its NAV, FlashBuy purchases Au from the open market using treasury reserves,
providing a **soft price floor**.

**Contract:** `0xf6383860837E6cb983F9Af8Def92fc08F15Be65b`

## 8.2 Central Banking Analogy

| Traditional Central Bank | AV Treasury FlashBuy |
|--------------------------|---------------------|
| Open market operations | Buy Au from DEX when below NAV |
| Quantitative easing | Deploy treasury reserves |
| Currency intervention | Buy pressure to stabilize |
| Discount window | Direct redemption via TreasuryAMO |

## 8.3 Trigger Conditions

FlashBuy activates when ALL are true:

```
1. market_price < NAV × (1 − 2%)     [Au below peg]
2. oracle_deviation < 5%              [Price not manipulated]
3. oracle_staleness < 1 hour          [Fresh data]
4. treasury_balance > minimum_reserve  [Can afford it]
5. Not in cooldown (6 hours)           [Rate limit]
```

## 8.4 Execution Mechanics

### 8.4.1 Buyback Size

```
buyback_amount = min(
    max_buyback_per_epoch,
    treasury_stable_balance × 0.10,
    deficit_size / market_price
)
```

### 8.4.2 Post-Buyback Routing

| Destination | Allocation | Purpose |
|-------------|-----------|---------|
| Burn | 50% | Supply reduction |
| Treasury reserve | 30% | Re-sell when price recovers |
| Staker rewards | 20% | Additional yield |

## 8.5 Safety Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max per buyback | 10% of stables | Prevents draining |
| Cooldown | 6 hours | Rate limiting |
| Max per day | 3 buybacks | Rate limiting |
| Min NAV deviation | 2% | Only meaningful deviations |
| Oracle deviation | <5% | No buying on manipulated prices |

## 8.6 Interaction with PID

```
Au drops below NAV → FlashBuy buys (immediate support)
→ TVL drops → PID detects gap → Increases Ag emissions
→ Higher APY → New deposits → TVL recovers → Au price recovers
→ FlashBuy stops
```
