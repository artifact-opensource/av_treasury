---
title: PID/Treasury Economic Simulator
date: 2026-06-29
status: final
description: Documentation for the AV Treasury economic simulator — PID controller, treasury flywheel, and long-range projections.
category: technical
related: [results.md, ../whitepaper/whitepaper.md, ../reports/formal_verification.md]
---

# PID/Treasury Economic Simulator

## Overview

The AV Treasury simulator models the protocol's economic flywheel over time:

1. **PID Controller** adjusts Au emission rates based on TVL deviation from target
2. **Treasury Flywheel**: Fees → Buybacks → PID → Emissions → TVL → Fees
3. **Staking Dynamics**: Ag-balance-weighted QuasiCrystal multipliers affect LP behavior
4. **Ag Supply**: Governance token emissions with hard cap

## Usage

```bash
# Default 36-month simulation
python3 docs/sim/simulate.py

# Extended timeframes
python3 docs/sim/simulate.py --months 600      # 50 years
python3 docs/sim/simulate.py --months 6000     # 500 years
python3 docs/sim/simulate.py --months 60000    # 5000 years (max)

# Skip chart generation for very long runs (faster)
python3 docs/sim/simulate.py --months 60000 --no-charts
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SIMULATION_MONTHS` | 36 | Default simulation duration (overridable via `--months`) |
| Max months | 60,000 | Maximum supported (5,000 years) |
| AG_MAX_SUPPLY | Hard cap | Governance token supply ceiling |
| PID Kp, Ki, Kd | Tuned | Controller gains for emission rate |

## Output

- **Charts**: Token prices, Ag supply, TVL, treasury buybacks, staking metrics
- **CSV Data**: Full time-series data for analysis
- **Report**: Markdown summary of key metrics and security dashboard

## Long-Range Projections

| Timeframe | Months | Status |
|-----------|--------|--------|
| Default | 36 | ✅ Completed (see [results.md](results.md)) |
| 50-year | 600 | Needs to be run |
| 500-year | 6,000 | Needs to be run |
| 5,000-year | 60,000 | Needs to be run |

> **Note:** Very long simulations (>10,000 months) may require significant runtime. Use `--no-charts` to speed up computation. The simulator supports up to 60,000 months (5,000 years).

## Theory

The simulator implements the protocol described in [whitepaper.md](../whitepaper/whitepaper.md):

- **PID Controller**: Adjusts Au emission rate proportionally to TVL error, integral of historical error, and derivative (rate of change)
- **Flywheel Effect**: Positive feedback loop where protocol growth generates fees that drive buybacks, reducing Au supply and increasing TVL attractiveness
- **QuasiCrystal Multiplier**: Ag-balance-weighted staking boost (1.0x–2.5x) based on current Ag balance (not a lock)
