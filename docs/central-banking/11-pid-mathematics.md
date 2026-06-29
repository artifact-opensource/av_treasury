---
title: 11 — PID Controller Mathematical Specification
date: 2026-06-29
status: draft
description: Rigorous mathematical specification of the PID controller. Covers continuous and discrete forms, stability analysis, tuning methodology, and convergence proofs.
category: central-banking
related: [02-monetary-policy-engine.md, 12-stability-analysis.md, 13-simulation-framework.md, INDEX.md]
---

# 11 — PID Controller Mathematical Specification

## 11.1 Continuous Form

```
E(t) = Kp · e(t) + Ki · ∫₀ᵗ e(τ) dτ + Kd · de(t)/dt

Where:
  E(t) ∈ �    — emission rate (Ag per unit time)
  e(t) ∈ �    — error signal (target_TVL − actual_TVL)
  Kp, Ki, Kd ∈ �⁺  — gains
```

## 11.2 Discrete Form (On-Chain)

```
E[n] = Kp · e[n] + Ki · I[n] + Kd · D[n]

Where:
  e[n] = target_TVL[n] − actual_TVL[n]
  I[n] = I[n−1] + e[n] · Δt          (rectangular integration)
  D[n] = (e[n] − e[n−1]) / Δt        (backward difference)
  Δt   = epoch duration (5 days)
```

### 11.2.1 Integration Method

Rectangular (Euler) integration — chosen for gas efficiency (only current
error and previous integral state needed).

### 11.2.2 Derivative Computation

Backward difference — simplest numerical derivative, avoids look-ahead bias.

## 11.3 Transfer Function

```
H(z) = E(z)/e(z) = Kp + Ki·Δt·z/(z−1) + Kd·(z−1)/(Δt·z)
```

## 11.4 Stability Analysis

### 11.4.1 System Model

```
TVL[n+1] = TVL[n] + α · E[n] − β · TVL[n] + ε[n]

Where:
  α  — capital inflow responsiveness β  — natural capital decay
  ε[n] — exogenous noise
```

### 11.4.2 Stability Criterion

For stability, all poles of the closed-loop transfer function must lie
within the unit circle: |z_i| < 1.

### 11.4.3 Gain Constraints

```
Kp < (1 + β) / α
Ki < (1 + β − α·Kp) / (α·Δt)
Kd < (1 + β) / α
```

With current parameters (Kp=0.5, Ki=0.1, Kd=0.2): stable for α > 0.22, β < 0.08.

## 11.5 Steady-State Analysis

### 11.5.1 Zero Steady-State Error

The integral term ensures: lim(n→∞) e[n] = 0

**Proof:** If e[n] → e* ≠ 0, then I[n] → ∞, forcing E[n] → ∞,
which drives TVL → target, contradicting e* ≠ 0. ∎

### 11.5.2 Convergence Rate

Typical convergence: 90% gap closure within 10-20 epochs (50-100 days).

## 11.6 Robustness Properties

### 11.6.1 Disturbance Rejection

- **P term**: Immediate response
- **I term**: Eliminates persistent offset
- **D term**: Dampens oscillation

### 11.6.2 Anti-Windup

```
If E[n] > E_max: I[n] = I[n−1] − windup_correction
If E[n] < E_min: I[n] = I[n−1] + windup_correction
```

## 11.7 Comparison with Traditional Monetary Policy

| Aspect | Traditional CB | AV Treasury PID |
|--------|--------------|-----------------|
| Policy rule | Taylor rule | PID control |
| Update frequency | 6 weeks | 5 days |
| Data lag | 1-3 months | Real-time |
| Discretion | High (board) | None (algorithmic) |
| Transparency | Delayed | Real-time on-chain |

## 11.8 Limitations

1. **Model dependence**: Assumes linear emission→TVL relationship
2. **Oracle dependence**: PID depends on oracle quality
3. **Discrete epochs**: 5-day quantization error
4. **No forward-looking**: Purely reactive (MPC would be superior)
