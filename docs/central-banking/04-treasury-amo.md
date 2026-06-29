---
title: 04 — TreasuryAMO Reserve Management
date: 2026-06-29
status: draft
description: The TreasuryAMO contract as central bank reserve manager. Covers deposit/minting, redemption, reserve ratios, AMO operations via Slipstream, and asset management.
category: central-banking
related: [01-dual-token-architecture.md, 06-liquidity-provisioning.md, 08-flashbuy-mechanism.md, INDEX.md]
---

# 04 — TreasuryAMO Reserve Management

## 4.1 Overview

TreasuryAMO is the **central vault** of the AV Treasury. It holds protocol
reserves, manages liquidity positions, and serves as the backing mechanism
for Au. It is the on-chain equivalent of a central bank's FX reserve department.

**Contract:** `0x56653245f4718fe105b95C8424947B31b84b5188`

## 4.2 Core Functions

### 4.2.1 Deposit & Mint

```
Au_minted = (deposit_value × reserve_ratio) / Au_price
Current reserve ratio: 60%
  → $1000 deposit → $600 worth of Au minted
  → $400 remains as excess reserve
```

### 4.2.2 Redeem & Burn

```
collateral_returned = Au_amount × Au_price × (1 − redemption_fee)
Redemption fee: 5 bps (0.05%)
```

### 4.2.3 Reserve Ratio Management

```
MIN_RESERVE_RATIO = 50% (absolute floor)
MAX_RESERVE_RATIO = 100% (fully backed)
CURRENT            = 60%
```

## 4.3 AMO Operations

Algorithmic Market Operations — autonomous liquidity management on Slipstream.

### 4.3.1 Concentrated Liquidity Positions

TreasuryAMO holds Slipstream LP positions in Au/ETH and Au/USDC pools.
These generate fee income, provide exit liquidity, and maintain price stability.

### 4.3.2 Rebalancing

Triggered when:
- Price moves outside concentrated range
- Reserve composition shifts >10%
- Governance triggers manual rebalance

### 4.3.3 Fee Income

LP fee income flows to TreasuryAMO and is used for:
1. FlashBuy buybacks
2. Reserve building
3. Operations (gas, keeper incentives)

## 4.4 Asset Composition

| Asset | Target | Purpose |
|-------|--------|---------|
| ETH | 40% | Primary reserve |
| USDC | 35% | Stable reserve |
| stETH / rETH | 15% | Yield-bearing |
| Au LP positions | 10% | Market making |

## 4.5 NAV Calculation

```
NAV = total_reserves_USD / Au_circulating_supply
```

## 4.6 Treasury Safe

- **Address:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`
- **Type:** 3-of-5 Multi-signature
- **Can:** Adjust reserve ratio, pause, approve collateral types
- **Cannot:** Mint Au directly, withdraw individual assets

## 4.7 Emergency Procedures

| Trigger | Action | Recovery |
|---------|--------|----------|
| Oracle staleness >1h | Pause minting | Resume when oracle recovers |
| NAV deviation >20% | Activate FlashBuy | Auto-resolves |
| Reserve ratio <50% | Halt redemptions | Governance restores |
| Contract upgrade needed | Timelock → upgrade | Standard governance |
