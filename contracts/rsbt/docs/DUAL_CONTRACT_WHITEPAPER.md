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
4. [AgToken — Artifact Governance (Ag)](#4-agtoken--artifact-governance-ag)
5. [AuToken — Artifact Utility (Au)](#5-autoken--artifact-utility-au)
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

The AV Treasury introduces a **dual-token architecture** that separates the functions of **governance** (AgToken) and **utility** (AuToken) into two purpose-built contracts. This separation enables independent optimization of each token for its specific role while maintaining tight economic coupling through shared reserves, PID-controlled emissions, and a soulbound staking receipt system (RSBT).

**Key Innovation:** Unlike single-token systems that must balance governance, utility, and yield within one token, our dual-token model allows AgToken to serve as the elastic governance and seigniorage token while AuToken provides a fixed-supply, deflationary utility medium with built-in compliance features. The PID controller algorithmically manages AgToken supply, creating a self-stabilizing monetary system.

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
| **Governance** | AgToken (Artifact Governance) | Elastic supply, PID-controlled, Governor-compatible |
| **Utility** | AuToken (Artifact Utility) | Fixed supply, deflationary, compliance-ready |
| **Yield** | Both | LP fees + seigniorage + vault yield |

### 2.3 Design Principles

1. **Minimalism** — Each contract does one thing well
2. **Composability** — Contracts interact through well-defined interfaces
3. **Self-Stabilization** — PID control creates negative feedback loops
4. **Fixed Supply Utility** — AuToken has a hard cap; value accrues via fee redistribution, not inflation
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
              │  (Artifact  │      │  (Artifact  │
              │  Governance)│      │  Utility)   │
              │  Elastic    │      │  Fixed      │
              │  Supply     │      │  Supply     │
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
| LP Deposits ↑ | Mint more (if ρ > ρ*) | More staking demand | Reserves ↑ |
| LP Deposits ↓ | Burn (if ρ < ρ*) | Less staking demand | Reserves ↓ |
| Au Demand ↑ | — | Fee redistribution ↑ | — |
| Au Demand ↓ | — | Fee redistribution ↓ | — |
| Ag Price ↑ | — | — | Reserves ↑ |
| Ag Price ↓ | — | — | Reserves ↓ |

---

## 4. AgToken — Artifact Governance (Ag)

### 4.1 Overview

AgToken is the **governance and seigniorage token** of the protocol. Its supply is elastic — expanding when reserves exceed targets and contracting when reserves fall below targets. It is the primary token for governance participation, protocol revenue sharing, and monetary policy.

### 4.2 Token Specification

| Property | Value |
|----------|-------|
| Name | Artifact Governance |
| Symbol | Ag |
| Decimals | 18 |
| Standard | ERC-20 + Permit + Votes + UUPS Upgradeable |
| Initial Supply | 0 (fair launch, minted via PID) |
| Supply Cap | 100,000,000 (100M, governed by PID) |
| Transfer Fee | 0% |
| Mint Authority | TreasuryAMO (via PID) / MINTER role |
| Burn Mechanism | Buyback-and-burn + voluntary burn |
| Governance | OpenZeppelin Governor compatible (IVotes) |

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

## 5. AuToken — Artifact Utility (Au)

### 5.1 Overview

AuToken is the **utility token** of the protocol — a fixed-supply, deflationary medium of exchange with built-in transfer fees, blocklist enforcement, and cooldown mechanics. It serves as the primary unit of account within the ecosystem and is required for RSBT minting.

### 5.2 Token Specification

| Property | Value |
|----------|-------|
| Name | Artifact Utility |
| Symbol | Au |
| Decimals | 18 |
| Standard | ERC-20 + Permit + Votes + ReentrancyGuard |
| Initial Supply | 1,000,000,000 (1B, fixed — no further minting) |
| Transfer Fee | Enabled (governed, default 0.5%) |
| Blocklist | Enabled (compliance module) |
| Cooldowns | Enabled (anti-whale, configurable per-account) |
| Transferability | Fully transferable (subject to fees/restrictions) |

### 5.3 Fixed Supply Model

AuToken has a **hard-capped supply of 1 billion tokens**. No further minting is possible. Value accrues to holders through:

```
Supply Mechanics:
  Total Supply:    1,000,000,000 Au (fixed forever)
  Circulating:     Total Supply - Blocked - Locked
  Deflation:       Transfer fees burned → supply decreases over time
  
Value Accrual:
  Fee Redistribution: Transfer fees redistributed to Au stakers
  Utility Demand:    Required for RSBT minting → constant demand sink
  Governance:        Au holders participate in protocol governance
```

### 5.4 Compliance Features

AuToken includes built-in compliance mechanisms for institutional-grade utility:

```
Transfer Fee:
  fee = amount × feeRate (default 0.5%)
  feeRecipient → Staking pool (redistributed to stakers)
  
Blocklist:
  blockedAddresses: mapping(address → bool)
  Transfers to/from blocked addresses revert
  Managed by governance (compliance officer role)

Cooldown:
  cooldownDuration: mapping(address → uint256)
  Minimum time between large transfers per account
  Configurable per-address by governance
```

### 5.5 Yield Distribution

AuToken holders earn yield through staking:

```
Yield Per Au Token (Estimated):
  ┌─────────────────────┬───────────┬──────────┐
  │ Source              │ APY Range │ Share    │
  ├─────────────────────┼───────────┼──────────┤
  │ Transfer Fee Share  │ 2–4%      │ 35%      │
  │ Acoustic Vault Yield│ 2–5%      │ 25%      │
  │ Protocol Revenue    │ 1–3%      │ 20%      │
  │ RSBT Multiplier     │ 0–5%      │ 10%      │
  │ Seigniorage Flow    │ 0–2%      │ 10%      │
  ├─────────────────────┼───────────┼──────────┤
  │ Total Estimated APY │ 5–19%     │ 100%     │
  └─────────────────────┴───────────┴──────────┘
```

### 5.6 Demand Drivers

| Mechanism | Description |
|-----------|-------------|
| **RSBT Minting** | Au is required to mint RSBT positions — constant demand from LP stakers |
| **Governance** | Au holders govern protocol parameters and treasury allocation |
| **Fee Sink** | Transfer fees are redistributed to stakers, incentivizing holding |
| **Medium of Exchange** | Primary unit of account for all ecosystem transactions |
| **Staking Yield** | Staked Au earns protocol revenue, incentivizing long-term holding |

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

Acoustic Vaults are **yield-generating reserve pools** that deploy protocol reserves into diversified yield strategies. They are the primary mechanism for generating sustainable, non-inflationary yield for AuToken stakers.

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
| Reserve ratio < 90% | Halt Ag minting | Guardian |
| Reserve ratio < 80% | Emergency shutdown | Guardian |
| Oracle failure | Switch to fallback oracle | Owner |
| Critical bug found | Pause + prepare migration | Guardian + Owner |

---

## 12. Formal Properties

### 12.1 Safety Properties

| ID | Property | Formalization |
|----|----------|--------------|
| S1 | No unauthorized minting | `∀t: mint(t) → msg.sender ∈ AuthorizedMinters` |
| S2 | Ag supply cap enforced | `∀t: totalSupply(t) ≤ MAX_SUPPLY` |
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
  6. Configure AuToken fee parameters

Phase 3: Staking
  7. Deploy AVLPStaking_v2 (depends on AgToken)
  8. Deploy RSBT (depends on AuToken, AgToken, LP NFT)

Phase 4: Reserves
  9. Deploy Acoustic Vaults
  10. Fund vaults with initial reserves
  11. Set vault strategies and yield oracles

Phase 5: Governance
  12. Deploy Timelock
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

The AV Treasury dual-token architecture represents a principled approach to decentralized monetary policy. By separating the governance function (AgToken) from the utility function (AuToken), each token can be optimized for its specific role while maintaining economic coupling through shared reserves and algorithmic control.

AgToken provides **algorithmic monetary policy** through PID-controlled elastic supply, enabling the protocol to self-stabilize around a target reserve ratio. AuToken provides a **fixed-supply, compliance-ready utility medium** with deflationary mechanics and built-in fee redistribution. The RSBT system creates **long-term alignment** through soulbound positions with yield multipliers. The acoustic vaults generate **sustainable, non-inflationary yield** from real economic activity.

Together, these components form a **self-stabilizing monetary system** that can maintain value stability while providing attractive yields — a combination that has eluded most DeFi protocols.

---

> **Document Hash:** `TBD`  
> **Last Updated:** 2026-06-25  
> **Review Status:** Pending peer review
