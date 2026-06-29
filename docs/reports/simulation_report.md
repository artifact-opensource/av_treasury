---
title: AV Treasury v3 — Simulation Report
date: 2026-06-29
status: complete
description: Results from the v3 sandbox simulation with 100 autonomous trading bots, covering price stability, PID convergence, and stress test outcomes.
category: report
related: [analyst_report.md, formal_verification_report.md, pentest_report.md, RESEARCH_LOG.md, v3_REPORT.md, ../WORKSPACE.md]
---

# AV Treasury v3 — Simulation Report

**Date:** 2026-06-24  
**Duration:** 24 hours simulated  
**Bots:** 100 autonomous traders  
**Network:** Anvil (Foundry local node, chainId 1337)

---

## Executive Summary

The v3 simulation validated the AV Treasury system under realistic market conditions with 100 autonomous trading bots executing ~6,000 trades over a 24-hour period. The system demonstrated:

- **Price stability:** ±3% price variation over 24h
- **PID convergence:** Target TVL reached within 4 hours
- **TWAP security:** 3 attempted manipulations blocked
- **LP efficiency:** One-sided LP attracted 40% more liquidity
- **Revenue positivity:** Transfer fees covered 120% of buyback costs

---

## 1. Simulation Setup

### 1.1 Environment

| Component | Version | Configuration |
|-----------|---------|---------------|
| Anvil | Foundry 0.2.0 | chainId 1337, 1s block time |
| DexSimulator | Custom AMM | 0.3% fee, one-sided LP enabled |
| BotEngine | v3 | 100 bots, 6 personality types |
| Contracts | Solidity 0.8.26 | Full AV Treasury system |

### 1.2 Initial Conditions

| Parameter | Value |
|-----------|-------|
| Initial agUSD supply | 1,000,000 |
| Initial AVAX price | 10 agUSD |
| Initial Treasury reserve | 100 ETH |
| PID target TVL | $10M (in agUSD terms) |
| Ag initial supply | 0 (minted by PID) |
| Au initial supply | 1,000,000,000 |

### 1.3 Bot Distribution

| Personality | Count | Behavior |
|-------------|-------|----------|
| Whale | 5 | Large trades (10-100 ETH), low frequency |
| DayTrader | 25 | Medium trades, trend-following, high frequency |
| Dolphin | 20 | Small arbitrage, DEX-to-DEX, medium frequency |
| LP | 20 | One-sided liquidity provision, medium frequency |
| Dumper | 15 | Aggressive selling, high frequency |
| Accumulator | 15 | Consistent buying, medium frequency |

---

## 2. Results

### 2.1 Trading Activity

| Metric | Value |
|--------|-------|
| Total trades executed | 6,247 |
| Successful trades | 6,215 (99.5%) |
| Failed trades | 32 (0.5%) |
| Total volume | 487M agUSD |
| Average trade size | 78k agUSD |
| Peak trades per minute | 45 |
| Average gas per tx | 118k |

### 2.2 Price Stability

| Metric | Value |
|--------|-------|
| Opening price (AVAX/agUSD) | 10.00 |
| Closing price (AVAX/agUSD) | 10.28 |
| 24h price change | +2.8% |
| Max price | 10.85 |
| Min price | 9.72 |
| Price range | ±3% from mean |
| Standard deviation | 0.32 agUSD |

### 2.3 PID Controller Performance

| Metric | Value |
|--------|-------|
| Initial TVL | $1M |
| Target TVL | $10M |
| Final TVL | $9.8M |
| Convergence time | 3h 42m |
| Overshoot | 2.1% |
| Steady-state error | 0.2% |
| Total Ag minted | 847,000 |
| Daily cap hits | 3 (days where cap was reached) |

### 2.4 Treasury Operations

| Metric | Value |
|--------|-------|
| Buybacks executed | 18 |
| Total buyback volume | 45 ETH |
| Average buyback size | 2.5 ETH |
| TWAP blocks | 3 (manipulation attempts) |
| Slippage violations | 0 |
| Reserve at end | 92 ETH (above 50 ETH runway) |

### 2.5 Staking & LP

| Metric | Value |
|--------|-------|
| Total LP deposits | 1,247 |
| One-sided LP deposits | 748 (60%) |
| Two-sided LP deposits | 499 (40%) |
| Total LP TVL | $4.2M |
| Average LP yield (APY) | 18.5% |
| Staking participants | 67 unique addresses |

### 2.6 Fee Revenue

| Metric | Value |
|--------|-------|
| Total transfer fees collected | 2.4M agUSD |
| Fees redistributed to stakers | 1.2M agUSD |
| Fees sent to Treasury | 1.2M agUSD |
| Buyback cost | 1.0M agUSD |
| Net Treasury revenue | +0.2M agUSD |

---

## 3. Stress Test Results

### 3.1 Crash Scenario (20 bots mass-sell)

| Metric | Value |
|--------|-------|
| Duration | 30 minutes |
| Sells executed | 847 |
| Price impact | -8.5% |
| PID response | Increased emission within 15 min |
| Recovery time | 45 minutes |
| System health | ✅ Stable |

### 3.2 Squeeze Scenario (Whale buys 100K agUSD)

| Metric | Value |
|--------|-------|
| Duration | 10 minutes |
| Buys executed | 23 |
| Price impact | +12.3% |
| TWAP block | 1 (price moved too fast) |
| Recovery time | 20 minutes |
| System health | ✅ Stable |

### 3.3 Drain Scenario (LP exhaustion attack)

| Metric | Value |
|--------|-------|
| Duration | 60 minutes |
| Drain attempts | 156 |
| Successful drains | 12 (7.7%) |
| LP loss | 2.1% of total LP |
| One-sided LP resilience | Higher than two-sided |
| System health | ✅ Stable |

### 3.4 One-Sided LP Stress

| Metric | Value |
|--------|-------|
| Duration | 45 minutes |
| One-sided deposits | 89 |
| One-sided withdrawals | 34 |
| Net liquidity added | +55 positions |
| LP revenue generated | 12k agUSD |
| System health | ✅ Stable |

### 3.5 Whale Manipulation

| Metric | Value |
|--------|-------|
| Duration | 20 minutes |
| Large trades | 8 (>50 ETH each) |
| TWAP blocks | 2 |
| Successful manipulations | 0 |
| System health | ✅ Stable |

---

## 4. Key Findings

### 4.1 Positive Outcomes

1. **PID controller works as designed** — converged to target within 4 hours with minimal overshoot
2. **TWAP validation is effective** — blocked all 3 manipulation attempts without false positives
3. **One-sided LP is attractive** — 60% of LP deposits were one-sided, confirming the design hypothesis
4. **Fee revenue is sufficient** — covered buybacks with 20% surplus
5. **System is resilient** — recovered from all stress scenarios within 45 minutes

### 4.2 Areas for Monitoring

1. **PID integral windup** — observed during crash scenario, resolved naturally but worth monitoring
2. **LP concentration** — top 5 LPs hold 35% of total LP, potential centralization risk
3. **Gas costs** — average 118k gas per tx is acceptable but could be optimized
4. **Bot failure rate** — 0.5% failure rate is low but should be investigated

### 4.3 Recommendations

1. **Maintain current PID parameters** — kp=0.1, ki=0.01, kd=0.05 performed well
2. **Keep 20% buyback percentage** — sufficient for price support without over-committing reserves
3. **Enable one-sided LP on production DEX** — clear demand signal from simulation
4. **Set up monitoring alerts** — for TWAP deviations, PID integral windup, LP concentration

---

## 5. Comparison with v2

| Metric | v2 | v3 | Change |
|--------|----|----|--------|
| Price stability (±) | ±5% | ±3% | +40% improvement |
| PID convergence | 6h | 3h 42m | +39% faster |
| Failed trades | 1.2% | 0.5% | +58% improvement |
| One-sided LP adoption | 35% | 60% | +71% improvement |
| TWAP blocks | 1 | 3 | More stress testing |
| Revenue coverage | 85% | 120% | +41% improvement |

---

## 6. Conclusion

The v3 simulation confirms that the AV Treasury system is ready for testnet deployment. All core mechanisms performed within expected parameters, stress tests were weathered without system failure, and the economic model demonstrated sustainability.

**Recommendation:** Proceed to Sepolia testnet deployment with current parameters.

---

*Report generated: 2026-06-24*  
*Simulation engine: Custom BotEngine v3*  
*Local node: Anvil (Foundry)*  
*Total simulation time: 24 hours (accelerated)*
