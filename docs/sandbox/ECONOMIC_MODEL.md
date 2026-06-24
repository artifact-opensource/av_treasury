# AV TREASURY — Economic Model Analysis

**Date:** 2026-06-24  
**Scope:** Complete economic model — Tokenomics, Flywheel, Feedback Loops  
**Simulation:** 36-month, 10,000-run Monte Carlo  

---

## 1. Dual-Token Model Overview

### 1.1 Token Roles

| Token | Ticker | Type | Supply | Purpose |
|-------|--------|------|--------|---------|
| Artifact Utility | Au | ERC20, Deflationary | Fixed 1B | Fee engine, staking reward, value transfer |
| Artifact Governance | Ag | ERC20, Elastic | 0 → 100M (PID-controlled) | Governance power, staking reward, buyback reserve |

### 1.2 Core Economic Principle

> Au is the **demand driver** — every transfer burns Au and feeds the treasury.  
> Ag is the **supply regulator** — PID mints Ag based on TVL relative to target.  
> Together they create a self-stabilizing flywheel:
> more usage → more fees → more buybacks → higher Au price → more staking → more TVL → more Ag emission → more governance power → better parameter tuning → optimal growth.

---

## 2. Au Tokenomics

### 2.1 Fee Mechanics

```
Fee Rate: 9 basis points (0.09%)
Split: 50% burned + 50% to treasury

Example: 10,000 Au transfer
  Fee: 0.9 Au (9bps × 10,000)
  Burned: 0.45 Au (4.5bps × 10,000) → permanently removed from supply
  Treasury: 0.45 Au (4.5bps × 10,000) → accumulated for buybacks
```

### 2.2 Deflationary Pressure

| Daily Transfer Volume | Daily Burn | Annual Burn | % of Supply Burned/yr |
|----------------------|------------|-------------|----------------------|
| 100,000 Au | 4.5 Au | 1,643 Au | 0.00016% |
| 1,000,000 Au | 45 Au | 16,425 Au | 0.0016% |
| 10,000,000 Au | 450 Au | 164,250 Au | 0.016% |
| 100,000,000 Au | 4,500 Au | 1,642,500 Au | 0.16% |
| 1,000,000,000 Au | 45,000 Au | 16,425,000 Au | 1.64% |

**Observation:** Deflation is weak at low usage but becomes significant at scale. At 1B daily transfers (full supply churning daily), 1.64% of supply is burned annually.

### 2.3 Anti-Bot Mechanisms

| Mechanism | Parameter | Purpose |
|-----------|-----------|---------|
| Transfer fee | 9bps | Cost per transaction discourages spam |
| Max transfer | 1% of supply per tx | Prevent whale dumping |
| Max wallet | 1% of supply per wallet | Prevent concentration |
| Blocklist | ANTI_BOT_ROLE | Block malicious addresses |
| Sell cooldown | Configurable, max 7 days | Prevent rapid sell-offs |
| Flash mint cap | 1,000,000 Au | Limit flash loan attacks |

### 2.4 Supply Distribution (Initialization)

```
Initial mint: 1,000,000,000 Au to deployer
  → Deployer: 999,000,000 Au
  → Staking allocation: 300,000 Au (for reward pool seeding)
  → Treasury allocation: 700,000 Au (for initial liquidity/buybacks)
```

---

## 3. Ag Tokenomics

### 3.1 Emission Model

```
PID Controller calculates emission based on TVL error:
  error = targetTVL - effectiveTVL(TWATVL)
  emission = kp * error + ki * integral(error) + kd * derivative(error)

If error > 0 (TVL below target): emit more Ag to incentivize staking
If error < 0 (TVL above target): no emission (don't punish success)
If within deadband (±5%): no emission (stability zone)
```

### 3.2 Emission Caps

| Cap | Value | Trigger |
|-----|-------|---------|
| Single emission cap | 10,000 Ag | Per-tick maximum |
| Base daily cap | 11,000 Ag | Minimum emission ceiling |
| Max daily cap | 50,000 Ag | Maximum emission floor |
| Dynamic scaling | 11K → 50K | Based on 30d TVL growth (capped at 400%) |

### 3.3 Bootstrap Schedule

```
Month 0:   Target TVL = 500,000
Month 10:  Target TVL = 5,000,000
After:     Target TVL = 5,000,000 (fixed)

Linear interpolation:
  currentTarget = 500,000 + (5,000,000 - 500,000) * elapsed / (10 × 30 days)
  At month 5: currentTarget ≈ 2,750,000
```

### 3.4 Annual Emission Projections

| Monthly Growth Rate | Daily Emission | Annual Emission | % of Max Supply |
|--------------------|----------------|-----------------|-----------------|
| 0% (no growth) | 11,000 | 4,015,000 | 4.0% |
| 50% | 16,500 | 6,022,500 | 6.0% |
| 100% (doubling) | 22,000 | 8,030,000 | 8.0% |
| 200% | 33,000 | 12,045,000 | 12.0% |
| 400% (max scaling) | 50,000 | 18,250,000 | 18.3% |

### 3.5 Emission Decay Mechanism

```
If currentTVL < TWATVL × 95% (5% drop):
  emission = emission / 2

This dampens emissions during TVL crashes to prevent inflation.
```

---

## 4. Staking Economics

### 4.1 Reward Structure

```
Dual yield:
  Au reward: rewardRateAu per block per staked weight
  Ag reward: rewardRateAg per block per staked weight

Example (deployment config):
  rewardRateAu = 0.001 Au/block per staked token
  rewardRateAg = 0.002 Ag/block per staked token

At 1,000,000 LP staked:
  Daily Au rewards: 0.001 × 1,000,000 × 7,200 blocks ≈ 7,200,000 Au
  Daily Ag rewards: 0.002 × 1,000,000 × 7,200 blocks ≈ 14,400,000 Ag
```

### 4.2 Ag Multiplier

```
multiplier = 10,000 + (15,000 × agBalance) / agThreshold
Where agThreshold = 5,000 Ag

Examples:
  0 Ag staked:     multiplier = 10,000 (1.0x)
  1,000 Ag staked: multiplier = 10,000 + 3,000 = 13,000 (1.3x)
  2,500 Ag staked: multiplier = 10,000 + 7,500 = 17,500 (1.75x)
  5,000 Ag staked: multiplier = 10,000 + 15,000 = 25,000 (2.5x max)
  10,000 Ag:staked: multiplier = 25,000 (capped)
```

### 4.3 Minimum Stake Duration

```
1 day minimum → prevents flash-loan manipulation of TVL
Rationale: An attacker who stakes and unstakes in the same block
          could spike TVL and extract disproportionate emissions.
```

### 4.4 Rate Change Timelock

```
48 hours between rate changes
Rationale: Prevents sudden yield drops that could cause mass unstaking
          Gives stakeholders time to adjust positions
```

---

## 5. TreasuryAMO Economics

### 5.1 Buyback Capacity

```
Parameters:
  Reserve runway: 12 months
  Buyback allocation: 12% of excess reserves
  Min buyback: $500 equivalent
  Per-epoch cap: 5%
  Cooldown: 24 hours

Flow:
  1. Au transfer fees accumulate in TreasuryAMO
  2. Excess = balance - (runway × monthly_burn_rate)
  3. Available for buyback = excess × 12%
  4. Max per buyback = balance × 5%
```

### 5.2 Buyback Impact

```
Assumptions:
  TreasuryAMO balance: 100,000 Au
  Aerodrome pool: 50,000 Au / 500,000 Ag
  Au price: $1.00
  Ag price: $5.00

Buyback of 5,000 Au:
  → 5,000 Au moved from pool to TreasuryAMO
  → Pool Au reserve: 45,000
  → Pool Ag reserve adjusts (constant product)
  → Au price impact: ~10% (depending on depth)

Buyback with 12% allocation:
  Excess: 100,000 - (12 × 5,000) = 40,000 Au
  Available: 40,000 × 12% = 4,800 Au
  Per-epoch cap: 100,000 × 5% = 5,000 Au
  Actual buyback: 4,800 Au
```

### 5.3 Treasury Sustainability

```
If monthly Au transfer volume = 10,000,000:
  Monthly fee accumulation: 4,500 Au
  12-month runway: 54,000 Au
  If treasury grows beyond 54,000 Au:
    Excess triggers buybacks
  Target equilibrium: ~54,000 Au reserve

If monthly Au transfer volume = 50,000,000:
  Monthly fee accumulation: 22,500 Au
  12-month runway: 270,000 Au
  Much larger buyback capacity
```

---

## 6. PID Controller Economics

### 6.1 Control Theory in Context

The PID controller treats TVL as the controlled variable and Ag emission as the control signal.

```
Setpoint (target): TVL = $5,000,000 (after bootstrap)
Process variable: TWATVL(Time-Weighted Average TVL)
Control output: Ag emission amount

Proportional (kp=0.12):
  Responds to current error magnitude
  Higher kp = faster response, more oscillation risk
  Lower kp = slower response, more stability

Integral (ki=0.03):
  Eliminates steady-state error
  Accumulates persistent error over time
  Decay (99/100) prevents windup
  Max integral: ±1e24

Derivative (kd):
  Responds to rate of change of error
  Dampens oscillation
  Not used in sweep (kd=0 in optimal params)
```

### 6.2 Stability Analysis

```
Characteristic equation depends on:
  - kp (proportional gain)
  - ki (integral gain)
  - TWATVL smoothing (99/100 = very slow)
  - Time delay (emission → staking takes blocks)

Critical stability condition:
  kp × (emission impact on TVL) < 1

If each 1 Ag emitted → $100 TVL increase:
  kp=0.12 × $100 = 12 (UNSTABLE — need lower kp)

If each 1 Ag emitted → $1 TVL increase:
  kp=0.12 × $1 = 0.12 (STABLE)

Conclusion: Stability depends on how much TVL each Ag unit generates.
            The simulation shows kp=0.12 is stable in practice.
```

### 6.3 TWATVL Smoothing

```
TWATVL = (99 × old_TWATVL + 1 × new_TVL) / 100

This is a 100-block EMA:
  New data has 1% weight
  Old data has 99% weight

Purpose: Prevent single-block TVL spikes from causing emission surges.

Example:
  Current TWATVL: $4,000,000
  Flash spike to: $8,000,000 (2x)
  New TWATVL: (99 × 4M + 1 × 8M) / 100 = $4,040,000
  Spike dampened by 99%
```

---

## 7. DEX Economics

### 7.1 DexSimulator Parameters

```
Pair: Ag (tokenA) / Au (tokenB)
Fee: 0.3% per swap
One-sided fee: 0.1% (for single-asset deposits)
Formula: constant product (x × y = k)
TWAP via cumulative price
Anti-bot: 1 block minimum between swaps
```

### 7.2 Price Discovery

```
Initial liquidity: 50,000 Ag + 50,000 Au
Price: 1 Ag = 1 Au (implied)

Price formula:
  priceA_in_B = reserveB / reserveA
  priceB_in_A = reserveA / reserveB

After buying 5,000 Ag from pool:
  reserveA: 45,000 Ag, reserveB: 55,555 Au
  priceA_in_B = 55,555 / 45,000 = 1.23 Au per Ag
  (Ag appreciated 23%)
```

### 7.3 TreasuryAMO Impact on DEX

```
Buyback of 5,000 Ag:
  → Swap 5,000 Au for Ag
  → Pool Au increases, Ag decreases
  → Au price increases (more scarce in pool)
  → Supports Au price
```

---

## 8. Economic Feedback Loops

### 8.1 Positive Feedback Loop (Growth Spiral)

```
1. Users buy/transfer Au → fees accumulate in treasury
2. Treasury grows → more buyback capacity
3. Buybacks buy Au → Au price increases
4. Higher Au price → staking yield value increases
5. More stakers → TVL increases
6. TVL above target → PID emits more Ag (if below target)
7. More Ag minted → staker yield increases
8. More stakers → TVL increases further
9. Loop continues

Risk: Overgrowth → Ag inflation → Ag price drops → staker yield drops
```

### 8.2 Negative Feedback Loop (Stabilization)

```
1. TVL drops below target
2. PID error increases (positive)
3. PID emits more Ag
4. More Ag → higher staking yield
5. Attracts stakers back → TVL recovers
6. TVL recovers → error decreases
7. PID reduces emission
8. Equilibrium restored

Risk: Overshoot → too much Ag emission → inflation → staker dumping
```

### 8.3 Reflexive Loop (Multiplier Effect)

```
1. Ag price increases
2. Stakers hold Ag for multiplier → multiplier value increases
3. Higher multiplier → more yield per staked LP
4. More staking → less Ag in circulation → Ag price increases further
5. Ag price increases → multiplier value increases
6. Loop continues

Risk: Recursive → whale accumulates Ag → excessive governance power
      → sets favorable parameters → extract value from others
```

---

## 9. Simulation Results

### 9.1 36-Month Monte Carlo (10,000 runs)

| Metric | Month 0 | Month 36 | Change | Assessment |
|--------|---------|----------|--------|------------|
| Au Price | $0.0100 | $0.0049 | -51.1% | ⚠️ Below 0.5 stability coefficient |
| Ag Price | $0.0992 | $5.5965 | +5544.1% | ✅ Strong growth |
| TVL | $497,623 | $4,303,430 | +764.8% | ✅ Excellent |
| Ag Supply | 108 | 11,685,872 | +11,685,764 | ✅ 11.7% of cap utilized |
| Treasury | $7,034 | $10,254 | +45.8% | ✅ Growing |
| Staking Mult | — | 2.50x | — | ✅ Max reached |

### 9.2 Optimal Parameters (1152-combination sweep)

| Parameter | Optimal Value | Health Score Contribution |
|-----------|---------------|--------------------------|
| PID_KP | 0.12 | Fast convergence, minimal oscillation |
| PID_KI | 0.03 | Steady-state error correction |
| AG_INITIAL_DAILY_CAP | 11,000 | Conservative, prevents inflation |
| PID_BOOTSTRAP_DURATION | 10 months | Gradual ramp |
| AMO_BUYBACK_PCT | 12% | Sustainable spending |
| STAKING_MAX_MULT | 25,000 (2.5x) | Strong incentive, not excessive |

### 9.3 Health Score Breakdown

```
Composite Health Score: 1.6088

Formula (approximate):
  score = (TVL_growth_weight × TVL_growth) +
          (Au_stability_weight × Au_stability) +
          (Treasury_growth_weight × Treasury_growth) +
          (Ag_sustainability_weight × Ag_sustainability)

TVL Growth: 3.30x → contributes positively
Au Stability: 0.4893 → contributes negatively (below 0.5)
Treasury Growth: 1.46x → contributes moderately
Ag Supply Sustainability: 0.8982 → contributes positively (11.7% of cap)
```

### 9.4 Sensitivity Analysis

| Parameter | -20% | -10% | Optimal | +10% | +20% |
|-----------|------|------|---------|------|------|
| PID_KP | 1.45 | 1.53 | 1.61 | 1.58 | 1.52 |
| PID_KI | 1.55 | 1.58 | 1.61 | 1.59 | 1.54 |
| AMO_PCT | 1.50 | 1.56 | 1.61 | 1.63 | 1.60 |
| STAKING_MULT | 1.48 | 1.54 | 1.61 | 1.65 | 1.62 |

(+10% staking multiplier → highest score, suggesting 2.8x might be better than 2.5x)

---

## 10. Economic Risks

### 10.1 Au Price Decline Risk (Primary)

**Score: 0.4893 (below 0.5 threshold)**

```
Failed Path:
  Au usage declines → fee revenue drops
  → Treasury cannot fund buybacks → Au price pressure
  → Stakers liquidate Au positions → further decline
  → Flywheel reverses

Key Decision: Increase buyback % to 15-20% to provide more support
```

### 10.2 Ag Inflation Risk

```
Risk: TVL stays below target for extended period
  → PID continuously emits Ag at max cap
  → Ag supply increases faster than demand
  → Ag price drops → staker yield value drops
  → Stakers withdraw → TVL drops further
  → PID emits even more Ag (positive feedback spiral)

Mitigation: Dynamic emission cap with demand-based reduction
```

### 10.3 Multiplier Centralization Risk

```
Risk: Whales accumulate Ag early
  → Get 2.5x multiplier → earn disproportionate yield
  → Reinvest yield → accumulate more Ag
  → Governance power centralizes
  → Can set parameters in their favor
  → Extract value from smaller stakers

Mitigation: Progressive multiplier (diminishing returns above 10,000 Ag)
            Or tiered multiplier (1.5x above 10K, 2.0x above 25K, 2.5x above 100K)
```

### 10.4 Treasury Insolvency Risk

```
Risk: Long period of low Au usage
  → Fee revenue cannot cover buyback runway
  → Treasury drops below 12-month runway
  → Buybacks halted → Au loses buyback support
  → Au price drops further

Mitigation: Reserve fund outside of fee revenue (protocol-owned liquidity)
```

---

*Document: ECONOMIC_MODEL.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
