---
title: AV Treasury — Research Log
date: 2026-06-29
status: complete
description: Research log documenting protocol design decisions, mechanism analysis, and comparative studies for the AV Treasury system.
category: report
related: [analyst_report.md, formal_verification_report.md, pentest_report.md, simulation_report.md, v3_REPORT.md, ../whitepaper/whitepaper.md]
---

# AV Treasury — Research Log

This document captures the research and design decisions behind the AV Treasury protocol.

---

## 2026-06-01 — Initial Architecture

### Dual-Token Design Rationale

After analyzing Olympus DAO, Klima DAO, and Temple DAO, we identified a key limitation: single-token systems conflate governance and utility, leading to misaligned incentives.

**Decision:** Separate governance (Ag) and utility (Au) into two tokens with distinct emission/burn mechanics.

### PID Controller Selection

Compared three emission control strategies:

| Strategy | Pros | Cons |
|----------|------|------|
| Fixed rate | Simple | No responsiveness |
| PID controller | Responsive, stable | Tuning complexity |
| ML-based | Adaptive | Opaque, gas-intensive |

**Decision:** PID controller — provides mathematical guarantees on stability while remaining transparent and gas-efficient.

---

## 2026-06-05 — Tokenomics Modeling

### Au Transfer Fee Analysis

Modeled fee rates from 0.1% to 5%:

| Fee Rate | Revenue (1M tx/day) | User Impact |
|----------|---------------------|-------------|
| 0.1% | Low | Minimal friction |
| 0.5% | Moderate | Acceptable |
| 1.0% | High | Noticeable |
| 5.0% | Very high | Prohibitive |

**Decision:** 0.5% default fee — balances revenue generation with user experience.

### Ag Emission Parameters

Initial PID tuning:
- kp = 0.1 (proportional gain)
- ki = 0.01 (integral gain)
- kd = 0.05 (derivative gain)
- Target TVL: $10M
- Daily cap: 100,000 Ag

---

## 2026-06-10 — Security Analysis

### Attack Vectors Identified

1. **Flash loan governance attack** — Mitigated by snapshot-based voting
2. **Price manipulation during buyback** — Mitigated by TWAP validation
3. **PID controller gaming** — Mitigated by daily emission cap
4. **Reentrancy in staking** — Mitigated by checks-effects-interactions pattern

### Audit Preparation

- All contracts documented with NatSpec
- Invariant test suite: 25 properties
- Fuzz testing: 10,000 inputs per invariant

---

## 2026-06-15 — Simulation Results

### Sandbox Performance (100 bots, 24h simulation)

| Metric | Value |
|--------|-------|
| Total trades | ~6,000 |
| Failed trades | <0.5% |
| Price stability | ±3% over 24h |
| PID convergence | Within 4h of target |
| Gas per tx | ~120k average |

### Key Findings

1. PID controller converges to target TVL within 4 hours under normal conditions
2. TWAP validation prevented 3 attempted price manipulations during stress testing
3. One-sided LP mechanism attracted 40% more liquidity than two-sided equivalent
4. Transfer fee revenue covered 120% of buyback costs in simulation

---

## 2026-06-20 — Governance Design

### Voting Mechanism

Compared:
- **Token-weighted voting** — Simple but plutocratic
- **Quadratic voting** — Fairer but gameable
- **Delegated voting** — Efficient but centralized

**Decision:** Token-weighted with delegation — balances simplicity with flexibility.

### Timelock Duration

| Duration | Security | Responsiveness |
|----------|----------|----------------|
| 24h | Low | High |
| 48h | Medium | Medium |
| 72h | High | Low |

**Decision:** 48h timelock — provides sufficient security while allowing reasonable responsiveness.

---

## 2026-06-24 — Pre-Launch Checklist

- [x] All contracts compiled without warnings
- [x] 25/25 invariant tests pass
- [x] Static analysis: 0 critical, 0 high
- [x] Simulation: 24h stable operation
- [x] Documentation complete
- [x] Deployment scripts tested on Sepolia
- [x] Etherscan verification prepared

---

## Open Questions for Post-Launch

1. Should Ag emission target be adjusted based on market conditions?
2. What is the optimal buyback percentage (currently 20%)?
3. Should one-sided LP be extended to production DEX integration?
4. How should governance evolve as the protocol matures?

---

*This log is updated as research continues. Last entry: 2026-06-24.*
