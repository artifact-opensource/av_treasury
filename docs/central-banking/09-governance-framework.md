---
title: 09 — Governance Framework (Governor + Timelock)
date: 2026-06-29
status: canonical
description: The DAO governance system. Covers proposal lifecycle, voting mechanics, timelock security, governance-controlled parameters, and the path to DAE (Distributed Autonomous Enterprise).
category: central-banking
related: [01-dual-token-architecture.md, 02-monetary-policy-engine.md, 10-quasicrystal-nft.md, 16-dae-architecture.md, 17-sub-dao-pilots.md, 18-autonomy-roadmap.md, INDEX.md]
---

# 09 — Governance Framework

## 9.1 Overview

The governance system consists of two deployed contracts:

| Contract | Address | Source |
|----------|---------|--------|
| **GovernorContract** | `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` | `contracts/av_suite/GovernorContract.sol` |
| **ArtifactTimelock** | `0x662321CC63700865838aB08378061BE499344714` | `contracts/av_suite/ArtifactTimelock.sol` |
| **AgToken** (voting power) | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` | `contracts/av_suite/AgToken.sol` |

Together they form the **central bank council** — a deliberative body that
sets policy but cannot act instantaneously.

## 9.2 Governor Parameters (from source)

| Parameter | Value | Source | Purpose |
|-----------|-------|--------|---------|
| Proposal threshold | 100,000 Ag | `INITIAL_PROPOSAL_THRESHOLD` | Minimum balance to submit |
| Voting delay | 1 block (~2s) | `INITIAL_VOTING_DELAY` | Wait before voting starts |
| Voting period | 216,000 blocks (~5 days) | `INITIAL_VOTING_PERIOD` | Voting window (Base: 2s/block) |
| Quorum | 4% of total Ag supply | `INITIAL_QUORUM` (400/10000 bps) | Minimum participation |
| Voting mode | Simple majority | `GovernorCountingSimple` | For > Against |

> **Note on block time:** Base produces ~2 second blocks. 216,000 blocks ≈ 5 days.
> The address.book comment "~30 days @ 12s/block" assumes Ethereum mainnet block time.
> On Base, the effective voting period is ~5 days.

## 9.3 Voting Power

Voting power comes from **AgToken** (`ERC20VotesUpgradeable`):

```
voting_power = Ag_balance_at_checkpoint
```

Key properties:
- **Checkpointed** — voting power is snapshotted at the proposal creation block
- **Delegatable** — holders can delegate to other addresses via `delegate(delegatee)`
- **No veAg multiplier** — voting power is 1:1 with Ag balance (no lock-weighted multiplier)
- **No soulbound restriction** — Ag is transferable; voting power follows balance

### Delegation

Any Ag holder can delegate voting power:
```solidity
AgToken(delegatee).delegate(delegatee)
```
- Delegation is one-to-one (one delegatee per delegator)
- Delegated power is included in quorum and vote counting
- Delegation does not transfer token ownership

## 9.4 Proposal Lifecycle

```
Draft → Submitted → Pending (1 block) → Active (~5 days) → Succeeded/Defeated
                                      ↓
                                   Cancelled

Succeeded → Queued → Executed
                ↓
             Cancelled
```

### States (from OZ Governor)

| State | Condition |
|-------|-----------|
| `Pending` | Submitted, voting delay not elapsed |
| `Active` | Voting delay elapsed, voting period ongoing |
| `Canceled` | Cancelled by proposer or guardian |
| `Defeated` | Voting ended, quorum not met or against ≥ for |
| `Succeeded` | Voting ended, quorum met and for > against |
| `Queued` | Succeeded, queued for execution |
| `Executed` | Transaction completed |

### Proposal Functions

```solidity
// Submit proposal
function propose(targets[], values[], calldatas[], description) returns (uint256 proposalId)

// Cast vote
function castVote(proposalId, support)  // support: 0=against, 1=for, 2=abstain
function castVoteWithReason(proposalId, support, reason)

// Cancel (proposer only, or if proposer drops below threshold)
function cancel(targets[], values[], calldatas[], descriptionHash)

// Execute
function execute(targets[], values[], calldatas[], descriptionHash)
```

## 9.5 Timelock (ArtifactTimelock)

### Parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| Min delay | 48 hours | `MIN_DELAY` |
| Max delay | 30 days | `MAX_DELAY` |
| Grace period | 14 days | `GRACE_PERIOD` (inherited) |

### Roles

| Role | Holder | Purpose |
|------|--------|---------|
| `PROPOSER` | GovernorContract | Queue proposals after success |
| `EXECUTOR` | GovernorContract + Treasury Safe | Execute queued transactions |
| `CANCELLER` | GovernorContract | Cancel queued transactions |
| `ADMIN_ROLE` | Treasury Safe | Manage roles |

### Execution Flow

1. Governor `execute()` calls Timelock `schedule()` → transaction queued
2. After `MIN_DELAY` (48h), transaction becomes executable
3. Any `EXECUTOR` can call `execute()` after delay expires
4. After `GRACE_PERIOD` (14 days), transaction expires and must be re-queued

> **Note:** The Governor's `_queueOperations()` returns 0 (not the timelock delay).
> This means proposals execute immediately after the Governor's `execute()` call,
> without waiting for the timelock delay. The timelock is configured but the
> Governor bypasses it in the current implementation.

## 9.6 Governance-Controlled Parameters

All parameters are changeable via governance proposal. The Governor has
`DEFAULT_ADMIN_ROLE` on most contracts, allowing it to call admin functions.

### PID Parameters (PIDController)

| Parameter | Current | Range | Contract Function |
|-----------|---------|-------|-------------------|
| Kp | 50 | 0–100 | `setKp(uint256)` |
| Ki | 10 | 0–50 | `setKi(uint256)` |
| Kd | 5 | 0–50 | `setKd(uint256)` |
| Target TVL | 2000 bps | 0–10000 | `setTarget(uint256)` |
| Max mint rate | 100,000 | 0–10M | `setMaxMintRate(uint256)` |
| Epoch duration | 8 hours | 1–720 | `setEpochDuration(uint256)` |

### Treasury Parameters (TreasuryAMO)

| Parameter | Current | Range | Contract Function |
|-----------|---------|-------|-------------------|
| Reserve ratio | 60% | 50–100% | `setReserveRatio(uint256)` |
| Max buyback | 10% | 1–25% | `setMaxBuyback(uint256)` |
| FlashBuy threshold | 2% | 0.5–10% | `setFlashBuyThreshold(uint256)` |

### Token Parameters (AuToken)

| Parameter | Current | Range | Contract Function |
|-----------|---------|-------|-------------------|
| Transfer tax | 9 bps | 0–20 bps | `setTransferTax(uint256)` |
| Tax split | 50:50 | 0:100–100:0 | `setTaxSplit(uint256)` |

### Oracle Parameters (OracleWrapper)

| Parameter | Current | Range | Contract Function |
|-----------|---------|-------|-------------------|
| Heartbeat | 1 hour | 1–24hr | `setHeartbeat(uint256)` |
| Deviation threshold | 500 bps | 100–2000 | `setDeviationThreshold(uint256)` |

## 9.7 Security Properties

### Timelock Protection
- 48-hour minimum delay on all governance actions
- Community has window to review and exit
- Emergency cancellation available

### Quorum Requirements
- 4% of total Ag supply must participate
- Simple majority of participating votes decides
- Abstain votes count toward quorum but not outcome

### Proposal Threshold
- 100,000 Ag required to submit
- Prevents spam proposals
- ~1% of total supply (100M max)

### Cancellation
- Proposer can cancel their own proposal
- Anyone can cancel if proposer drops below threshold
- Timelock cancellers can cancel queued transactions

## 9.8 Emergency Powers

| Power | Mechanism | Duration |
|-------|-----------|----------|
| Pause contracts | Governor → `pause()` | Indefinite (unpause via governance) |
| Emergency withdrawal | Treasury Safe 3-of-5 multisig | One-time |
| Oracle override | Governor → `setManualPrice()` | Until next oracle update |

Emergency powers are limited to:
- **Pause:** Any governance proposal can pause critical functions
- **Multisig:** Treasury Safe can execute without governance (limited to withdrawal)
- **Oracle:** Governor can set manual prices if oracle fails

## 9.9 Path to DAE (Distributed Autonomous Enterprise)

The current governance system is **Phase 3** — human-driven DAO governance.
The path to full autonomy (DAE) is documented in:

- **[16 — DAE Architecture](16-dae-architecture.md)** — The target state
- **[17 — Sub-DAO Pilots](17-sub-dao-pilots.md)** — First autonomous sub-units
- **[18 — Autonomy Roadmap](18-autonomy-roadmap.md)** — Phased transition plan

### Current Limitations

1. **No sub-DAOs** — all governance flows through single Governor
2. **No automated execution** — all actions require human proposal + vote
3. **No conditional logic** — cannot auto-execute based on market conditions
4. **Single-tier proposals** — no emergency/fast-track mechanism
5. **No delegation incentives** — delegation is passive, no rewards

### Phase 4 Targets

1. **Sub-DAO pilots** — autonomous units for specific functions (e.g., liquidity management)
2. **Conditional execution** — auto-execute when conditions are met (e.g., PID-triggered mints)
3. **Multi-tier proposals** — emergency/fast-track for time-sensitive actions
4. **Keeper network** — automated bots for maintenance and monitoring
5. **Full DAE** — treasury operates autonomously within governance-set bounds

## 9.10 Deployment Verification

### On-Chain Verification Checklist

- [ ] Governor deployed at `0x259c...6385`
- [ ] Timelock deployed at `0x6623...4714`
- [ ] Governor set as PROPOSER on Timelock
- [ ] Governor set as EXECUTOR on Timelock
- [ ] Governor set as CANCELLER on Timelock
- [ ] Treasury Safe set as ADMIN on Timelock
- [ ] AgToken `ERC20Votes` interface confirmed
- [ ] Governor `IVotes` integration confirmed (uses AgToken for voting power)
- [ ] All admin roles on managed contracts transferred to Governor/Timelock

### Known Issues

1. **Timelock bypass** — Governor `_queueOperations()` returns 0, bypassing timelock delay
2. **Block time assumption** — voting period calibrated for 12s blocks (ETH), effective ~5 days on Base
3. **No emergency tier** — single proposal type, no fast-track mechanism
