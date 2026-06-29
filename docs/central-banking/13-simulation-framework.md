---
title: 13 — Long-Term Simulation Framework
date: 2026-06-29
status: draft
description: The Python-based economic simulator. Covers methodology, parameter space, and results for 50-year, 500-year, and 5000-year simulation runs.
category: central-banking
related: [11-pid-mathematics.md, 12-stability-analysis.md, 02-monetary-policy-engine.md, INDEX.md]
---

# 13 — Long-Term Simulation Framework

## 13.1 Overview

The AV Treasury simulator (`simulator/simulate.py`) models the economic
dynamics of the system over arbitrary time horizons. It implements the
PID controller, TVL dynamics, price discovery, and emission distribution
as a discrete-time simulation.

## 13.2 Simulator Architecture

```
simulator/
  simulate.py              — Main simulation engine
  simulation_report.md     — Results from previous runs
  simulation_results/      — Output data (CSV, JSON)
```

### 13.2.1 Core Loop

```python
for day in range(TOTAL_DAYS):
    # 1. Read oracle prices (with noise model)
    prices = oracle_model.get_prices(day)

    # 2. Compute TVL
    tvl = compute_tvl(prices, positions)

    # 3. Update PID (per epoch)
    if day % EPOCH_DAYS == 0:
        emission = pid.update(target_tvl, tvl)

    # 4. Distribute emissions
    distribute_rewards(emission, stakers)

    # 5. Model user behavior (deposits, withdrawals)
    tvl += user_model.get_net_flow(day, prices, apy)

    # 6. Update Au price (AMM pricing)
    au_price = amm_model.get_price(tvl, au_supply)

    # 7. Record state
    record_state(day, tvl, au_price, emission)
```

## 13.3 Current Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max simulation length | 36 months | Currently limited by `SIMULATION_MONTHS` |
| Epoch duration | 5 days | Matches on-chain |
| PID gains | Kp=0.5, Ki=0.1, Kd=0.2 | Current governance settings |
| Target TVL | $500K → $5M ramp | 12-month bootstrap |
| Initial liquidity | $500K | Starting condition |
| Noise model | Geometric Brownian Market | σ = 30% annualized |

## 13.4 Required Extensions

### 13.4.1 Time Horizon Extension

The simulator must be extended to support:

| Horizon | Days | Epochs | Purpose |
|---------|------|--------|---------|
| 50 years | 18,250 | 3,650 | Long-term sustainability analysis |
| 500 years | 182,500 | 36,500 | Multi-century stability proof |
| 5000 years | 1,825,000 | 365,000 | Extreme boundary testing |

### 13.4.2 Required Code Changes

```python
# Current (hardcoded 36 months):
SIMULATION_MONTHS = 36
TOTAL_DAYS = SIMULATION_MONTHS * DAYS_PER_MONTH

# Required (configurable):
SIMULATION_YEARS = int(os.environ.get('SIM_YEARS', 36 // 12))
TOTAL_DAYS = SIMULATION_YEARS * 365
```

### 13.4.3 Performance Considerations

| Horizon | Estimated Runtime | Memory | Storage |
|---------|------------------|--------|---------|
| 50 years | ~30 seconds | ~50 MB | ~5 MB CSV |
| 500 years | ~5 minutes | ~500 MB | ~50 MB CSV |
| 5000 years | ~60 minutes | ~5 GB | ~500 MB CSV |

For 5000-year runs:
- Use logarithmic recording (not every day — every 30 days after year 100)
- Stream output to disk (don't hold in memory)
- Consider parallel execution for Monte Carlo variants

## 13.5 Simulation Scenarios

### 13.5.1 Baseline (Expected Case)
- Market grows at 30% annually
- No black swan events
- PID parameters remain at current values
- Target TVL follows governance ramp

### 13.5.2 Bear Market (Stress Test)
- Market declines 80% over 2 years
- Prolonged low TVL
- Tests emission floor effectiveness

### 13.5.3 Hypergrowth (Boom)
- TVL reaches 10× target within 1 year
- Tests PID's ability to reduce emissions gracefully
- Tests emission cap

### 13.5.4 Oracle Failure
- Oracle reports stale/manipulated data for 30 days
- Tests PID's response to bad data
- Tests emergency mechanisms

### 13.5.5 Governance Attack
- Malicious parameter change mid-simulation
- Tests timelock and cancellation mechanisms

### 13.5.6 Regime Change
- Market structure shifts (new L2, new DEX)
- Tests system adaptability

## 13.6 Key Metrics to Track

| Metric | Description | Healthy Range |
|--------|-------------|---------------|
| TVL / Target | Ratio of actual to target | 0.8 – 1.2 |
| Ag inflation rate | Annual Ag supply growth | 0 – 50% |
| Au price / NAV | Premium/discount to NAV | 0.95 – 1.05 |
| Staking APY | Effective yield for stakers | 5 – 100% |
| Reserve ratio | Backing per Au | > 60% |
| Emission stability | Variance in epoch emissions | Low variance |
| Convergence time | Epochs to reach 90% of target | < 20 epochs |

## 13.7 Monte Carlo Analysis

For statistical robustness, each scenario should be run 100+ times with
randomized parameters:

```python
for trial in range(N_TRIALS):
    # Randomize within bounds
    kp = random.uniform(0.3, 0.7)
    ki = random.uniform(0.05, 0.15)
    kd = random.uniform(0.1, 0.3)
    market_vol = random.uniform(0.2, 0.5)
    alpha = random.uniform(0.1, 0.5)

    results = run_simulation(kp, ki, kd, market_vol, alpha)
    record_trial(trial, results)
```

## 13.8 Status

- [x] 36-month baseline simulation completed
- [ ] 50-year simulation (needs code extension)
- [ ] 500-year simulation (needs code extension)
- [ ] 5000-year simulation (needs code extension)
- [ ] Monte Carlo analysis (100 trials × 6 scenarios)
- [ ] Bear market stress test
- [ ] Hypergrowth test
- [ ] Oracle failure test
- [ ] Governance attack test
- [ ] Regime change test

## 13.9 Running the Simulator

```bash
# Standard run (36 months)
python3 simulator/simulate.py

# Extended run (50 years)
SIM_YEARS=50 python3 simulator/simulate.py

# Custom parameters
SIM_YEARS=500 KP=0.5 KI=0.1 KD=0.2 python3 simulator/simulate.py
```

## 13.10 Sandbox Testing

The `sandbox/` directory contains deployment scripts for testing the system
in isolation. Sandbox deployments use:
- Mock ETH and stablecoins
- Simulated oracle data
- Fast-block mode (1 block per second)

Sandbox results complement the simulator — the simulator tests economic
dynamics, while sandbox tests contract interactions.
