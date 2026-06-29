---
title: Simulation Results — 36-Month Run
date: 2026-06-29
status: canonical
description: 36-month economic simulation results with PID stability analysis, treasury health, and staking dynamics.
category: sim
related: [index.md, ../central-banking/02-monetary-policy-engine.md, ../central-banking/04-flywheel-mechanics.md]
---

# Simulation Results — 36-Month Run

## Executive Summary

| Metric | Month 0 | Month 36 | Change |
|--------|---------|----------|--------|
| Au Price | $0.0100 | $0.0049 | -51.1% |
| Ag Price | $0.0992 | $5.5965 | +5544.1% |
| TVL | $497,623 | $4,303,430 | +764.8% |
| Ag Supply | 108 | 11,685,872 | +11,685,764 |
| Treasury | $7,034 | $10,254 | +45.8% |

## Key Metrics

### Token Performance
- **Au Price (Month 36):** $0.0049
- **Ag Price (Month 36):** $5.5965
- **Ag Total Minted:** 11,685,872 / 100,000,000 cap
- **Ag Utilization:** 11.7%

### Treasury Health
- **Total Fees Accumulated:** $18,546.75
- **Total Burned:** $18,546.75
- **Total Buybacks:** $15,292.28
- **Treasury Reserves:** $10,254.47

### Staking
- **Final Multiplier:** 2.50x (Ag-balance-weighted)
- **Staked LP Value:** $386,647.01

### PID Controller
- **TVL Target:** $5,000,000
- **Final TWATVL:** $3,541,994
- **Final TVL:** $4,303,430
- **Tracking Error:** 13.9%

## Long-Duration Results

For extended simulation results (50/500/5000 years), see [index.md](index.md).

## Security Status

- ✅ AuToken: nonReentrant on _update, blocklist, cooldown, max-tx/wallet
- ✅ PID: TWATVL EMA (99/10 smoothing), division-by-zero guard
- ✅ TreasuryAMO: forceApprove, balanceBefore, TWAP validation (5% max, 1h min)
- ✅ AVLPStaking: 1-day minimum stake duration
- ✅ Governor: DAO-controlled governance
