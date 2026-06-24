# AV Treasury — Dual-Contract Architecture Whitepaper

> **Version:** 1.0.0  
> **Date:** 2026-06-25  
> **Status:** Publish-Ready  
> **Authors:** Treasury Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Motivation & Design Philosophy](#2-motivation--design-philosophy)
3. [The Dual-Token Model](#3-the-dual-token-model)
4. [AgToken — The Elastic Governance Token](#4-agtoken--the-elastic-governance-token)
5. [AuToken — The Reserve-Backed Stable Unit](#5-autoken--the-reserve-backed-stable-unit)
6. [Monetary Policy & PID Control](#6-monetary-policy--pid-control)
7. [Reserve Architecture](#7-reserve-architecture)
8. [Staking & Yield System](#8-staking--yield-system)
9. [RSBT — Soulbound Time-Locked Positions](#9-rsbt--soulbound-time-locked-positions)
10. [Acoustic Vaults](#10-acoustic-vaults)
11. [Security Model](#11-security-model)
12. [Formal Properties](#12-formal-properties)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Roadmap](#14-roadmap)
15. [Conclusion](#15-conclusion)

---

## 1. Executive Summary

The AV Treasury introduces a **dual-token architecture** that separates the functions of governance/utility (AgToken) and stable exchange medium (AuToken) into two purpose-built contracts. This separation enables independent optimization of each token for its specific role while maintaining tight economic coupling through shared reserves, PID-controlled emissions, and a soulbound staking receipt system (RSBT).

**Key Innovation:** Unlike single-token stablecoin systems that must balance governance, stability, and yield within one token, our dual-token model allows AgToken to absorb volatility and capture seigniorage while AuToken provides a stable, yield-bearing unit of account. The PID controller algorithmically manages the relationship between the two, creating a self-stabilizing monetary system.

---

## 2. Motivation & Design Philosophy

### 2.1 The Trilemma of Single-Token Systems

Single-token DeFi systems face an inherent trilemma:

```
         Stability
            /\
           /  \
          /    \
         /  ?   \
        /________\
   Governance    Yield
```

- **Stability** requires supply contraction/expansion (elastic supply)
- **Governance** requires transferable, stakeable tokens
- **Yield** requires value accrual mechanisms

A single token serving all three roles creates conflicting incentives. Elastic supply adjustments dilute governance power. Yield mechanisms complicate stability. Governance control introduces centralization risk.

### 2.2 Our Solution: Functional Separation

| Function | Token | Property |
|----------|-------|----------|
| **Stability** | AuToken | Overcollateralized, basket-pegged |
| **Governance** | AgToken | Elastic supply, transferable |
| **Yield** | Both | LP fees + seigniorage + vault yield |

### 2.3 Design Principles

1. **Minimalism** — Each contract does one thing well
2. **Composability** — Contracts interact through well-defined interfaces
3. **Self-Stabilization** — PID control creates negative feedback loops
4. **Overcollateralization** — All Au minted is backed by real assets
5. **Progressive Decentralization** — Governance rights transfer to community over time

---

## 3. The Dual-Token Model

### 3.1 System Diagram

```
                    ┌─────────────────────────────┐
                    │         USERS / LPs          │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      LP Token Deposits       │
                    └──────┬──────────────┬───────┘
                           │              │
              ┌────────────▼──┐    ┌──────▼────────────┐
              │  AVLP Staking │    │   RSBT Minting     │
              │  (Earn Ag)    │    │   (Earn Multiplier)│
              └──────┬────────┘    └──────┬────────────┘
                     │                    │
         ┌───────────▼────────────────────▼───────────┐
         │              TreasuryAMO                     │
         │         (Monetary Policy Engine)             │
         │    ┌─────────────────────────────────┐      │
         │    │     PID Emission Controller      │      │
         │    │  u(t) = Kp·e + Ki·∫e + Kd·de/dt │      │
         │    └─────────────────────────────────┘      │
         └───────────┬────────────────────┬────────────┘
                     │                    │
              ┌──────▼──────┐      ┌──────▼──────┐
              │   AgToken   │      │   AuToken   │
              │  (Silver)   │      │   (Gold)    │
              │  Elastic    │      │  Stable     │
              │  Supply     │      │  Pegged     │
              └──────┬──────┘      └──────┬──────┘
                     │                    │
              ┌──────▼────────────────────▼──────┐
              │         Reserves                  │
              │  ┌─────┐ ┌─────┐ ┌─────┐ ┌────┐ │
              │  │ USDC│ │ ETH │ │ LP  │ │ AV │ │
              │  └─────┘ └─────┘ └─────┘ └────┘ │
              └─────────────────────────────────┘
```

### 3.2 Token Interaction Matrix

| Action | AgToken Effect | AuToken Effect | Reserve Effect |
|--------|---------------|----------------|----------------|
| LP Deposits ↑ | Mint more (if ρ > ρ*) | More backing | Reserves ↑ |
| LP Deposits ↓ | Burn (if ρ < ρ*) | Less backing | Reserves ↓ |
| Au Demand ↑ | — | Supply ↑ | Reserves ↑ |
| Au Demand ↓ | — | Supply ↓ | Reserves ↓ |
| Ag Price ↑ | — | — | Reserves ↑ |
| Ag Price ↓ | — | — | Reserves ↓ |

---

## 4. AgToken — The Elastic Governance Token

### 4.1 Overview

AgToken is the **seigniorage absorber** and **governance token** of the protocol. Its supply is elastic — expanding when reserves exceed targets and contracting when reserves fall below targets.

### 4.2 Token Specification

| Property | Value |
|----------|-------|
| Name | AV AgToken |
| Symbol | Ag |
| Decimals | 18 |
| Standard | ERC-20 + Permit + Votes |
| Initial Supply | 0 (fair launch) |
| Supply Cap | None (elastic, PID-controlled) |
| Transfer Fee | 0% |
| Mint Authority | TreasuryAMO (via PID) |
| Burn Mechanism | Buyback-and-burn + voluntary burn |

### 4.3 Supply Dynamics

```
                    PID Controller
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ρ > ρ*          |ρ-ρ*|< ε        ρ < ρ*
    (above target)   (deadband)       (below target)
         │               │               │
         ▼               ▼               ▼
    Mint Ag          No Action       Burn Ag
    ΔS = +u(t)       ΔS = 0          ΔS = -u(t)
```

**Supply Equation:**
```
S(t+1) = S(t) + max(0, u(t)) - max(0, -u(t)) - B(t)

Where:
  S(t) = total supply at time t
  u(t) = PID control output
  B(t) = voluntary burns (buybacks)
```

### 4.4 Governance Rights

| Privilege | Requirement | Description |
|-----------|------------|-------------|
| Proposal Creation | ≥ 0.5% of total supply | Submit governance proposals |
| Voting Power | ≥ 1 Ag (delegated) | Vote on active proposals |
| Parameter Changes | Majority + quorum | Change protocol parameters |
| Emergency Actions | Multi-sig + timelock | Trigger emergency procedures |

### 4.5 Value Accrual

AgToken captures value through:

1. **Seigniorage**: When reserves exceed target, new Ag is minted and distributed to stakers — effectively monetizing reserve growth
2. **Governance Premium**: Control over protocol parameters and treasury allocation
3. **Fee Share**: Staked Ag earns a portion of protocol revenue
4. **Buyback**: Excess reserves used to buy and burn Ag, creating buy pressure

---

## 5. AuToken — The Reserve-Backed Stable Unit

### 5.1 Overview

AuToken is the **stable, yield-bearing unit of account** — designed to maintain value stability against a basket of diversified assets. It is not pegged to a single currency but rather to a weighted basket, providing natural diversification and resilience.

### 5.2 Token Specification

| Property | Value |
|----------|-------|
| Name | AV AuToken |
| Symbol | Au |
| Decimals | 18 |
| Standard | ERC-20 + Permit + Votes + ReentrancyGuard |
| Initial Supply | 0 (100% collateralized mint) |
| Peg Mechanism | Basket-of-assets |
| Default Collateral Ratio | 110% (overcollateralized) |
| Redemption Fee | 0.5% (governed) |
| Yield Sources | LP fees, vault yield, protocol revenue |

### 5.3 Basket Peg Mechanism

Unlike single-peg stablecoins (e.g., USDC, DAI), AuToken maintains a **basket peg**:

```
Basket Composition (Initial):
  ┌──────────┬────────┬─────────────────────┐
  │ Asset    │ Weight │ Role                │
  ├──────────┼────────┼─────────────────────┤
  │ USDC     │ 30%    │ Stability anchor    │
  │ ETH      │ 25%    │ Growth exposure     │
  │ LP Tokens│ 35%    │ Yield generation    │
  │ Acoustic │ 10%    │ Strategy yield      │
  └──────────┴────────┴─────────────────────┘

Basket Price = Σ(weight_i × oraclePrice_i)
```

**Advantages over single-peg:**
- **Diversification**: No single asset failure can break the peg
- **Yield Generation**: LP and acoustic vault components earn yield
- **Resilience**: If one asset depegs, others maintain value
- **Growth Exposure**: ETH component captures upside

### 5.4 Minting & Redemption

```
MINTING:
  User → Deposit Collateral → Verify Value ≥ Au × 1.1 → Mint Au
  
  Example: To mint 100 Au at basket price $1.00
    Required: 100 × 1.00 × 1.10 = $110 of collateral
    Accepted: USDC, ETH, LP tokens (at oracle prices)

REDEMPTION:
  User → Burn Au → Calculate Collateral Value → Deduct 0.5% Fee → Return Collateral
  
  Example: Redeem 100 Au at basket price $1.00
    Value: 100 × 1.00 = $100
    Fee: $100 × 0.005 = $0.50
    Received: $99.50 of collateral
```

### 5.5 Yield Distribution

AuToken holders earn yield through staking:

```
Yield Per Au Token (Estimated):
  ┌─────────────────────┬───────────┬──────────┐
  │ Source              │ APY Range │ Share    │
  ├─────────────────────┼───────────┼──────────┤
  │ LP Trading Fees     │ 3–8%      │ 40%      │
  │ Acoustic Vault Yield│ 2–5%      │ 25%      │
  │ Protocol Revenue    │ 1–3%      │ 20%      │
  │ Seigniorage Flow    │ 0–2%      │ 10%      │
  │ RSBT Multiplier     │ 0–5%      │ 5%       │
  ├─────────────────────┼───────────┼──────────┤
  │ Total Estimated APY │ 6–23%     │ 100%     │
  └─────────────────────┴───────────┴──────────┘
```

### 5.6 Peg Stability Mechanisms

| Mechanism | Trigger | Effect |
|-----------|---------|--------|
| **Arbitrage** | Au trades above basket price | Users mint Au cheaply, sell at premium → price ↓ |
| **Arbitrage** | Au trades below basket price | Users buy cheap, redeem for full value → price ↑ |
| **PID Adjustment** | Reserve ratio deviates | Adjusts Ag emission to influence reserve levels |
| **Collateral Ratio** | Volatility spike | Increase required collateralization |
| **Redemption Fee** | Large redemptions | Fee increases to slow outflows |

---

## 6. Monetary Policy & PID Control

### 6.1 The PID Controller

The protocol employs a **Proportional-Integral-Derivative (PID) controller** — a control loop mechanism used in industrial systems — to algorithmically manage AgToken supply.

### 6.2 Control Law

```
u(t) = Kp · e(t) + Ki · ∫₀ᵗ e(τ)dτ + Kd · (e(t) - e(t-1)) / Δt

Where:
  e(t) = ρ_measured(t) - ρ_target
       = (ReserveValue / (AgSupply × AgPrice)) - 1.20

  u(t) > 0 → Mint Ag (reserves exceed target)
  u(t) < 0 → Burn Ag (reserves below target)
  u(t) = 0 → No action (within deadband)
```

### 6.3 Parameter Tuning

| Parameter | Value | Effect |
|-----------|-------|--------|
| `Kp` (Proportional) | 1×10¹⁵ | Immediate response to deviation |
| `Ki` (Integral) | 1×10¹² | Corrects persistent drift over time |
| `Kd` (Derivative) | 5×10¹⁴ | Dampens oscillation, predicts trend |
| `ρ_target` | 120% | Target reserve ratio |
| `ε` (Deadband) | 0.1% | Ignore tiny deviations |
| `Max Mint/Epoch` | 5% of supply | Safety bound |
| `Max Burn/Epoch` | 3% of supply | Safety bound |

### 6.4 Anti-Windup Protection

Integral windup — where the integral term accumulates excessively during prolonged deviations — is prevented through:

1. **Clamping**: `integral ∈ [-maxIntegral, maxIntegral]`
2. **Conditional Integration**: Only integrate when `|u(t)| < maxOutput`
3. **Reset on Equilibrium**: Reset integral when `|e(t)| < ε` for > 1 epoch

### 6.5 Monetary Policy Transmission

```
PID Output → TreasuryAMO → Mint/Burn Ag → Ag Supply Change
                                              │
                                              ▼
                                    Ag Price Change
                                              │
                                              ▼
                                    Reserve Ratio Change
                                              │
                                              ▼
                                    Feedback to PID (next epoch)
```

**Transmission Lag:** ~1 day (epoch length). The system is designed to be **critically damped** — reaching equilibrium without oscillation.

---

## 7. Reserve Architecture

### 7.1 Reserve Composition

```
Target Reserve Allocation:
  ┌─────────────────────────────────────────────┐
  │ USDC (30%)  ████████████████████            │
  │ ETH  (25%)  █████████████████               │
  │ LP     (35%)██████████████████████████      │
  │ AV     (10%) ███████                        │
  └─────────────────────────────────────────────┘
```

### 7.2 Reserve Management

| Function | Contract | Description |
|----------|----------|-------------|
| **Deposit** | TreasuryAMO | Add assets to reserves |
| **Withdraw** | TreasuryAMO | Remove assets (governed) |
| **Rebalance** | TreasuryAMO | Adjust allocation weights |
| **Yield** | Acoustic Vaults | Generate yield on reserves |
| **Audit** | On-chain | Real-time reserve verification |

### 7.3 Reserve Ratio States

```
                    Reserve Ratio Spectrum
                    
  ◄─────────────────────────────────────────────────►
  50%    80%    100%   110%   120%   130%   150%   200%
  │      │       │      │      │      │      │      │
  │      │       │      │      │      │      │      │
  ▼      ▼       ▼      ▼      ▼      ▼      ▼      ▼
 CRIT   DANGER  MIN    SAFE   TARGET GROWTH MAX   EXCESS
  │      │       │      │      │      │      │      │
  │      │       │      │      │      │      │      │
  ▼      ▼       ▼      ▼      ▼      ▼      ▼      ▼
 EMERG  SLOW    NORMAL NORMAL HOLD   MINT   MINT   BUY
         BURN                    AG     AG     BACK
```

---

## 8. Staking & Yield System

### 8.1 LP Staking

Liquidity providers deposit LP tokens into `AVLPStaking` to earn AgToken emissions.

```
Staking Flow:
  LP Provider
      │
      ├──► Provides liquidity → Receives LP tokens
      │
      ├──► Approves LP on AVLPStaking
      │
      ├──► Calls stake(tokenId, amount)
      │         │
      │         ├── LP tokens held by staking contract
      │         ├── accRewardPerShare updated
      │         └── User's rewardDebt recorded
      │
      ├──► Accumulates Ag rewards per block
      │
      ├──► Calls claimRewards() → Receives Ag
      │
      └──► Calls unstake(tokenId) → Receives LP back
```

### 8.2 Reward Calculation

```
Reward = (userStake × (globalAccRewardPerShare - userAccRewardPerShare)) / 1e18

Where:
  globalAccRewardPerShare += rewardAmount / totalStake
  userAccRewardPerShare[staker] updated on stake/unstake/claim
```

### 8.3 Effective Stake with RSBT

```
effectiveStake = baseStake × (1 + RSBTMultiplier)

Where:
  RSBTMultiplier = min(agBalance / agThreshold, 1.5)
  agThreshold = totalAgSupply × 0.01
```

---

## 9. RSBT — Soulbound Time-Locked Positions

### 9.1 Overview

RSBT (Reissuable Soulbound Token) is a **non-transferable ERC-721 receipt** that represents a time-locked LP position. It serves three purposes:

1. **Yield Boost**: RSBT holders receive a multiplier on their staking yield
2. **Commitment Signal**: The 7-day cooldown signals long-term alignment
3. **Soulbound**: Non-transferable, preventing speculative trading of positions

### 9.2 Lifecycle

```
                    RSBT Lifecycle
                    
  ┌─────────┐    ┌──────────┐    ┌──────────────┐    ┌────────┐
  │  STAKE  │───►│  ACTIVE  │───►│  REDEMPTION  │───►│ REDEEM │
  │         │    │          │    │  INITIATED   │    │        │
  │ LP NFT  │    │ Position │    │              │    │ Burn   │
  │ + Au    │    │ earns    │    │ 7-day        │    │ RSBT   │
  │ → RSBT  │    │ yield +  │    │ cooldown     │    │ Return │
  │         │    │ multi-   │    │ timer        │    │ LP NFT │
  │         │    │ plier    │    │              │    │        │
  └─────────┘    └──────────┘    └──────────────┘    └────────┘
```

### 9.3 Multiplier Mechanics

```
Multiplier = 10000 + min((userAgBalance / agThreshold) × 5000, 15000)

  Minimum: 10000 (1.0x) — no Ag balance
  Maximum: 25000 (2.5x) — Ag balance ≥ agThreshold × 3

  agThreshold = totalAgSupply × 0.01 (1% of total supply)
```

### 9.4 Cooldown Enforcement

```
require(
    block.timestamp ≥ position.redemptionInitiated + COOLDOWN_PERIOD,
    "CooldownNotExpired"
)

COOLDOWN_PERIOD = 7 days (immutable, governance cannot change)
```

### 9.5 Soulbound Implementation

```solidity
function _beforeTokenTransfer(address from, address to, uint256) internal override {
    // Only allow mint (from == address(0)) and burn (to == address(0))
    require(from == address(0) || to == address(0), "Soulbound: non-transferable");
}
```

---

## 10. Acoustic Vaults

### 10.1 Overview

Acoustic Vaults are **yield-generating reserve pools** that deploy protocol reserves into diversified yield strategies. They are the primary mechanism for generating sustainable, non-inflationary yield.

### 10.2 Vault Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Acoustic Vault                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Deposits ──► Strategy Allocation ──► Yield Generation  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Strategies:                                      │  │
│  │   • Stablecoin LP (low risk, 2-4% APY)          │  │
│  │   • ETH LP (medium risk, 5-10% APY)             │  │
│  │   • Lending (Aave/Compound, 3-6% APY)           │  │
│  │   • Delta-Neutral (market-neutral, 8-15% APY)   │  │
│  │   • Cross-Protocol (diversified, 6-12% APY)     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Yield ──► Accumulator ──► Distribution to Au Stakers  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 10.3 Risk Management

| Strategy | Max Allocation | Risk Level | Target APY |
|----------|---------------|------------|------------|
| Stablecoin LP | 40% | Low | 2–4% |
| ETH LP | 25% | Medium | 5–10% |
| Lending | 15% | Low | 3–6% |
| Delta-Neutral | 10% | Medium-High | 8–15% |
| Cross-Protocol | 10% | Medium | 6–12% |

---

## 11. Security Model

### 11.1 Threat Model

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Reentrancy | External calls in mint/burn | ReentrancyGuard on all state-changing functions |
| Oracle Manipulation | Stale/corrupt price data | Multi-oracle (Chainlink + TWAP), deviation checks |
| Flash Loan Attack | Price manipulation in single tx | TWAP oracles, minimum block delay |
| Governance Capture | Malicious proposal | Timelock (48h), quorum, veto mechanism |
| Integer Overflow | Arithmetic edge cases | Solidity 0.8+ built-in overflow checks |
| Access Control | Unauthorized minting | Role-based access, multi-sig ownership |

### 11.2 Access Control Architecture

```
┌─────────────────────────────────────────────┐
│              Governance (Timelock)           │
│              ┌──────────────┐               │
│              │  Proposals   │               │
│              │  Parameters  │               │
│              └──────┬───────┘               │
│                     │                       │
│         ┌───────────┼───────────┐           │
│         │           │           │           │
│    ┌────▼────┐ ┌────▼────┐ ┌───▼────┐     │
│    │ Owner   │ │ Policy  │ │Guardian│     │
│    │ (multi) │ │  (PID)  │ │ (multi)│     │
│    └────┬────┘ └────┬────┘ └───┬────┘     │
│         │           │          │           │
│    Config      Execute      Emergency     │
│    Changes     Policy       Pause         │
└─────────────────────────────────────────────┘
```

### 11.3 Emergency Procedures

| Condition | Action | Who |
|-----------|--------|-----|
| Unusual activity detected | Pause contracts | Guardian |
| Reserve ratio < 90% | Halt Au minting | Guardian |
| Reserve ratio < 80% | Emergency shutdown | Guardian |
| Oracle failure | Switch to fallback oracle | Owner |
| Critical bug found | Pause + prepare migration | Guardian + Owner |

---

## 12. Formal Properties

### 12.1 Safety Properties

| ID | Property | Formalization |
|----|----------|--------------|
| S1 | No unauthorized minting | `∀t: mint(t) → msg.sender ∈ AuthorizedMinters` |
| S2 | Overcollateralization | `∀t: ReserveValue(t) ≥ AuSupply(t) × Price(t) × CollateralRatio` |
| S3 | Soulbound enforcement | `∀t: transfer(rsbtId) → revert` |
| S4 | Cooldown enforcement | `∀t: redeem(t) → block.timestamp ≥ stakeTime + 7 days` |
| S5 | PID output bounded | `∀t: |u(t)| ≤ maxOutput` |

### 12.2 Liveness Properties

| ID | Property | Formalization |
|----|----------|--------------|
| L1 | Eventually mintable | `∃t: canMint(user, amount) → mint(user, amount)` |
| L2 | Eventually redeemable | `∃t: canRedeem(user, rsbtId) → redeem(user, rsbtId)` |
| L3 | PID converges | `lim(t→∞) |ρ(t) - ρ*| < ε` |
| L4 | Yield distributes | `∀t: pendingYield(user) > 0 → claimable(user)` |

---

## 13. Deployment Architecture

### 13.1 Deployment Order

```
Phase 1: Foundation
  1. Deploy AgToken (no dependencies)
  2. Deploy AuToken (no dependencies)
  3. Deploy PID_Emission_Controller_v2

Phase 2: Policy
  4. Deploy TreasuryAMO (depends on Ag, Au, PID)
  5. Configure TreasuryAMO as AgToken owner
  6. Configure TreasuryAMO as AuToken minter

Phase 3: Staking
  7. Deploy AVLPStaking_v2 (depends on AgToken)
  8. Deploy RSBT (depends on AuToken, AgToken, LP NFT)

Phase 4: Reserves
  9. Deploy Acoustic Vaults
  10. Fund vaults with initial reserves
  11. Set basket weights and oracle configuration

Phase 5: Governance
  2. Deploy Timelock
  13. Transfer ownership to Timelock
  14. Configure governance parameters
```

### 13.2 Network Configuration

| Parameter | Ethereum Mainnet | Testnet (Sepolia) |
|-----------|-----------------|-------------------|
| Chain ID | 1 | 11155111 |
| Oracle | Chainlink | Chainlink Sepolia |
| Uniswap V3 | 0x... | 0x... |
| Gas Strategy | Standard | Fast |

---

## 14. Roadmap

### Phase 1: Bootstrap (Q3 2026)
- [x] Contract development and testing
- [x] Formal verification (Halmos)
- [ ] Internal audit
- [ ] Testnet deployment

### Phase 2: Growth (Q4 2026)
- [ ] External audit (2 firms)
- [ ] Bug bounty program
- [ ] Mainnet deployment
- [ ] Initial liquidity seeding

### Phase 3: Maturity (Q1 2027)
- [ ] Governance launch
- [ ] Community parameter voting
- [ ] Protocol expansion (new vault strategies)
- [ ] Cross-chain evaluation

### Phase 4: Ecosystem (Q2 2027+)
- [ ] Developer grants
- [ ] Integration partnerships
- [ ] Advanced monetary policy tools
- [ ] Decentralized oracle expansion

---

## 15. Conclusion

The AV Treasury dual-token architecture represents a principled approach to decentralized monetary policy. By separating the stability function (AuToken) from the governance/utility function (AgToken), each token can be optimized for its specific role while maintaining economic coupling through shared reserves and algorithmic control.

The PID controller provides **automated, non-discretionary monetary policy** that responds to market conditions in real-time. The RSBT system creates **long-term alignment** through soulbound positions with yield multipliers. The acoustic vaults generate **sustainable, non-inflationary yield** from real economic activity.

Together, these components form a **self-stabilizing monetary system** that can maintain value stability while providing attractive yields — a combination that has eluded most DeFi protocols.

---

> **Document Hash:** `TBD`  
> **Last Updated:** 2026-06-25  
> **Review Status:** Pending peer review
