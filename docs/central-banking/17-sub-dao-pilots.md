---
title: 17 — Sub-DAO Pilots — Monetary, Treasury, and Liquidity Operations
date: 2026-06-29
status: draft
description: Phase 4 — Specific sub-DAO designs for monetary policy, treasury management, and liquidity operations. Covers scope, budgets, strategies, and performance metrics.
category: central-banking
related: [16-dae-architecture.md, 04-treasury-amo.md, 06-liquidity-provisioning.md, 02-monetary-policy-engine.md, INDEX.md]
---

# 17 — Sub-DAO Pilots

## 17.1 Overview

Three pilot sub-DAOs for Phase 4. Each is a specialized operational unit
with a defined scope, budget, and performance mandate. They operate
autonomously within bounds set by governance.

## 17.2 Sub-DAO 1: Monetary Policy Council (MPC)

### 17.2.1 Scope

Operates the PID Controller. Adjusts monetary policy parameters within
governance-set bounds. Responds to market conditions in real-time.

### 17.2.2 Authority

| Can Do | Cannot Do |
|--------|-----------|
| Adjust Kp, Ki, Kd within bounds | Change bounds themselves |
| Adjust emission smoothing (α) | Mint without PID computation |
| Adjust epoch duration (1–30 days) | Change target TVL formula |
| Pause emissions in emergency | Redirect emissions to arbitrary addresses |

### 17.2.3 Current PID Parameters (Governance-Set Bounds)

| Parameter | Current | Min | Max |
|-----------|---------|-----|-----|
| Kp | 0.5 | 0.0 | 5.0 |
| Ki | 0.1 | 0.0 | 2.0 |
| Kd | 0.2 | 0.0 | 2.0 |
| Smoothing α | 0.3 | 0.0 | 1.0 |
| Epoch duration | 5 days | 1 day | 30 days |
| Max emission | 100K Ag | 10K | 500K |

### 17.2.4 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TVL tracking error | <10% of target | Per epoch |
| Emission stability | σ/μ < 0.5 | Rolling 10 epochs |
| Response time | <2 epochs to 50% gap closure | Stress test |
| Zero steady-state error | lim e(t) = 0 | Long-run average |

### 17.2.5 Budget

- 15% of Ag emissions (already flows to TreasuryAMO)
- Operational budget: 5K Ag/year for keeper gas
- No direct asset control — only parameter adjustment

## 17.3 Sub-DAO 2: Treasury Operations (TRO)

### 17.3.1 Scope

Manages TreasuryAMO assets. Handles rebalancing, fee compounding, reserve
ratio adjustments, and FlashBuy execution.

### 17.3.2 Authority

| Can Do | Cannot Do |
|--------|-----------|
| Rebalance LP positions | Withdraw to arbitrary addresses |
| Compound fee income | Change reserve ratio bounds |
| Execute FlashBuy (within rules) | Mint new Au |
| Adjust asset allocation within bands | Add new collateral types |
| Deploy idle capital to yield | Expose treasury to unapproved protocols |

### 17.3.3 Asset Allocation Bands

| Asset | Target | Min | Max |
|-------|--------|-----|-----|
| ETH | 40% | 20% | 60% |
| USDC | 35% | 20% | 50% |
| stETH/rETH | 15% | 5% | 25% |
| Au LP positions | 10% | 5% | 20% |

### 17.3.4 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| NAV stability | σ < 5% monthly | Rolling |
| Fee income | >$10K/year | Annualized |
| Rebalance efficiency | <0.1% slippage per rebalance | Per event |
| Reserve ratio compliance | Always >50% | Real-time |

### 17.3.5 Budget

- 15% of Ag emissions (TreasuryAMO share)
- All LP fee income
- FlashBuy profits (when Au bought below NAV and recovered)

## 17.4 Sub-DAO 3: Liquidity Operations (LQO)

### 17.4.1 Scope

Manages all protocol-owned liquidity on Slipstream. Handles position
management, range adjustment, and fee optimization.

### 17.4.2 Authority

| Can Do | Cannot Do |
|--------|-----------|
| Adjust LP position ranges | Remove liquidity permanently |
| Move liquidity between fee tiers | Add new pools without governance |
| Harvest and compound fees | Use LP positions as collateral |
| Deploy concentrated liquidity | Exit approved pools |

### 17.4.3 Active Pools

| Pool | Fee Tier | Status |
|------|----------|--------|
| Au/WETH | 0.3% | Active |
| Au/USDC | 0.05% | Active |

### 17.4.4 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Capital efficiency | >50% of range active | Per position |
| Fee APR | >15% on deployed capital | Annualized |
| Slippage on $10K trade | <0.5% | Simulated daily |
| Rebalance frequency | <4x/month | Per pool |

### 17.4.5 Budget

- LP fee income (shared with TRO)
- Keeper gas budget: 3K Ag/year

## 17.5 Sub-DAO Governance

### 17.5.1 Creation

New sub-DAOs require a **Constitutional-tier proposal** (500K Ag threshold,
45-day voting, 10% quorum).

### 17.5.2 Dissolution

A sub-DAO can be dissolved by:
1. Standard governance proposal (if underperforming)
2. Automatic dissolution if metrics miss targets for 3 consecutive epochs
3. Emergency dissolution by Treasury Safe (3-of-5)

### 17.5.3 Reporting

Each sub-DAO must publish an on-chain report every epoch containing:
- Actions taken
- Performance vs metrics
- Budget spent
- Risk events (if any)

## 17.6 Sub-DAO Interaction

```
MPC adjusts PID → Emissions change → Staking APY changes
     ↓                                        ↓
TRO manages reserves ← TVL changes ← Capital flows
     ↓
LQO adjusts LP → Liquidity depth changes → Slippage changes
     ↓
Oracle reports prices → MPC reads TVL → Cycle continues
```

Sub-DAOs are **loosely coupled** — they read shared state but do not
directly call each other. This prevents cascading failures.

## 17.7 Phase 4 Deployment Sequence

| Week | Action | Sub-DAO |
|------|--------|---------|
| 1–2 | Deploy keeper infrastructure | All |
| 3–4 | Activate MPC (PID already live) | MPC |
| 5–6 | Activate TRO (rebalance + compound) | TRO |
| 7–8 | Activate LQO (range management) | LQO |
| 9–10 | Full integration testing | All |
| 11–12 | Governance handover + documentation | All |
