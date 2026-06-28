# AV Treasury Governance Specification

**Document Version:** 1.0.0  
**Date:** 2026-06-28  
**Status:** Formal Specification  
**Governor Contract:** `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` (Base Mainnet)  
**Classification:** Technical Reference — Authorized Contributors

---

## Table of Contents

1. [Preamble](#1-preamble)
2. [System Overview](#2-system-overview)
3. [Token Architecture](#3-token-architecture)
4. [Governor Architecture](#4-governor-architecture)
5. [Parameter Catalog](#5-parameter-catalog)
6. [Proposal Templates](#6-proposal-templates)
7. [Security Model](#7-security-model)
8. [Decentralization Roadmap](#8-decentralization-roadmap)
9. [Operational Procedures](#9-operational-procedures)
10. [Emergency Procedures](#10-emergency-procedures)
11. [Appendices](#11-appendices)

---

## 1. Preamble

### 1.1 Purpose

This document constitutes the formal governance specification for the AV Treasury system ("the Protocol"). It defines the rules, processes, mechanisms, and parameters by which the Protocol is administered, upgraded, and evolved through decentralized governance.

This specification serves as the authoritative reference for:
- Governance participants (voters, proposers, delegates)
- Smart contract developers implementing governance logic
- Security auditors evaluating governance correctness
- Emergency responders executing protocol actions
- Researchers analyzing protocol behavior

### 1.2 Scope

This specification covers all governance-relevant components of the AV Treasury system, including:

- The GovernorContract and its extensions
- The AgToken (governance token) and its voting power mechanics
- The AuToken (utility token) and its relationship to governance
- The veAg (vote-escrowed Ag) time-weighted voting system
- The TimelockController and its operational constraints
- The TreasuryAMO (Automated Market Operations) contract
- The OracleGuardian and its governance-relevant functions
- The PID Emission Controller and its configurable parameters
- All cross-contract governance pathways

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| **Ag** | The AV Treasury governance token (AgToken). Grants voting power proportional to balance and lock duration. |
| **Au** | The AV Treasury utility token (AuToken). Used for protocol operations, fees, and economic coordination. |
| **veAg** | Vote-escrowed Ag. Time-weighted voting power obtained by locking Ag for a specified duration. |
| **Governor** | The GovernorContract and its associated TimelockController, collectively forming the governance system. |
| **Proposal** | A structured set of on-chain actions to be executed by the governance system, subject to voting and timelock. |
| **Quorum** | The minimum number of voting power that must participate in a vote for the result to be valid. |
| **Supermajority** | A threshold exceeding a simple majority (e.g., 2/3 or 3/4 of votes cast) required for certain proposal types. |
| **Timelock** | A mandatory delay between proposal approval and execution, allowing participants to review and respond. |
| **AMO** | Automated Market Operations — algorithmic market interventions executed by the Treasury. |
| **PID** | Proportional-Integral-Derivative — the control mechanism used for emission rate adjustments. |
| **FlashBuy** | A mechanism allowing the Treasury to acquire assets via flash loan arbitrage. |
| **Guardian** | A privileged role with specific safety functions (pause, shutdown, fund recovery). |
| **Deployer** | The initial administrative address with elevated privileges during Phase 1. |
| **DAO** | Decentralized Autonomous Organization — the end-state governance structure where all control is community-driven. |

### 1.4 Conventions

- All addresses are Ethereum-style 20-byte addresses (42 characters including `0x` prefix).
- All monetary values are expressed in the protocol's native token units (wei for on-chain, whole tokens for specification).
- Time is measured in Unix timestamps (seconds since epoch) unless otherwise specified.
- "Shall" indicates a mandatory requirement; "may" indicates an optional capability.
- Contract references use their deployed addresses on Base Mainnet unless otherwise noted.

### 1.5 Governance Invariant

The following invariant shall be maintained at all times:

> **No single entity — whether through direct holdings, flash loan acquisition, vote buying, or delegation manipulation — shall be able to unilaterally pass and execute a proposal without meaningful community participation.**

---

## 2. System Overview

### 2.1 The AV Treasury as a Central Banking System

The AV Treasury operates as a decentralized central banking system for the Ag/Au ecosystem. Its core functions include:

1. **Monetary Policy**: Controlling the supply, distribution, and velocity of Ag and Au tokens through algorithmic mechanisms.
2. **Reserve Management**: Maintaining and deploying protocol-owned liquidity and treasury reserves.
3. **Price Stability**: Executing AMO operations to maintain target economic conditions.
4. **Protocol Ownership**: Governing the parameters, logic, and evolution of all protocol contracts.

The Treasury is not a passive vault. It is an active economic agent that can:
- Buy and sell assets on open markets
- Provide and remove liquidity
- Adjust emission rates
- Execute flash loan arbitrage (FlashBuy)
- Interact with external DeFi protocols

### 2.2 Role of Governance

Governance serves as the brain of the AV Treasury. It determines:

- **What parameters** can be changed (emission rates, fees, thresholds, targets)
- **How quickly** changes take effect (timelock durations, voting periods)
- **Who can propose** changes (proposal threshold requirements)
- **What consensus** is required (quorum, supermajority thresholds)
- **When to intervene** in emergencies (pause, shutdown, recovery)

Governance is the only mechanism by which:
- Contract logic can be upgraded
- Critical parameters can be modified beyond their automated ranges
- Emergency actions can be initiated or reversed
- The decentralization roadmap can advance

### 2.3 Contract Map

```
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNOR CONTRACT                         │
│  0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385                │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │ Proposal     │ │ Voting       │ │ Timelock          │   │
│  │ Management   │ │ Power Calc   │ │ Controller        │   │
│  └──────┬──────┘ └──────┬───────┘ └────────┬──────────┘   │
└─────────┼───────────────┼──────────────────┼───────────────┘
          │               │                  │
          ▼               ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   AgToken    │  │    veAg      │  │  ArtifactTimelock │
│  (Governance)│  │ (Vote-Escrow)│  │  (Delay Engine)  │
└──────────────┘  └──────────────┘  └────────┬─────────┘
                                             │
          ┌──────────────────────────────────┼──────────────┐
          ▼                  ▼               ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ┌──────────┐
│  TreasuryAMO │  │ OracleGuard  │  │  PID_Emission│  │ FlashBuy │
│  (Reserves)  │  │ (Safety)     │  │  Controller  │  │ (Arb)    │
└──────────────┘  └──────────────┘  └──────────────┘ └──────────┘
          │
          ▼
┌──────────────┐
│   AuToken    │
│  (Utility)   │
└──────────────┘
```

### 2.4 Governance Flow (End-to-End)

```
Proposer ──submit──► Governor ──delay──► Voting Period ──quorum──► Succeeded
                                                                        │
                                                                      queue
                                                                        ▼
                                                                  Timelock
                                                                        │
                                                                    execute
                                                                        ▼
                                                                  Target Contracts
```

---

## 3. Token Architecture

### 3.1 AgToken (Governance Token)

**Contract:** `AgToken.sol`  
**Role:** Governance power, proposal submission, voting

#### 3.1.1 Token Properties

| Property | Value |
|----------|-------|
| Name | Ag |
| Type | ERC-20 with permit (EIP-2612) |
| Decimals | 18 |
| Initial Supply | As defined at deployment |
| Mintability | Controlled by governance (via PID Emission Controller) |
| Burnability | Permitted for specific protocol operations |

#### 3.1.2 Core Functions

- `transfer(to, amount)` — Standard transfer; reduces voting power of sender, increases receiver (after lock consideration).
- `approve(spender, amount)` — Standard approval.
- `permit(owner, spender, value, deadline, v, r, s)` — Gasless approval via EIP-2612.
- `getCurrentVotes(account)` — Returns current voting power at the current block.
- `getPriorVotes(account, blockNumber)` — Returns voting power at a specific historical block.
- `delegate(delegatee)` — Delegates voting power to another address.
- `balanceOf(account)` — Returns raw token balance (not adjusted for locks).

#### 3.1.3 Voting Power Calculation

Voting power for an address is determined by:

```
votingPower(account) = Ag.balanceOf(account) + veAg.lockedPower(account)
```

Where `veAg.lockedPower` is calculated based on lock duration (see Section 3.3).

### 3.2 AuToken (Utility Token)

**Contract:** `AuToken.sol`  
**Role:** Protocol utility, fee payment, economic coordination

#### 3.2.1 Token Properties

| Property | Value |
|----------|-------|
| Name | Au |
| Type | ERC-20 with permit (EIP-2612) |
| Decimals | 18 |
| Mintability | Controlled by TreasuryAMO and PID Emission Controller |
| Burnability | Permitted for fee burning mechanisms |

#### 3.2.2 Core Functions

- Standard ERC-20 functions (`transfer`, `approve`, `transferFrom`, `permit`)
- `mint(to, amount)` — Restricted to authorized minters (TreasuryAMO, PID Controller)
- `burn(from, amount)` — Permitted for specific protocol operations
- `burnFrom(from, amount)` — Allowance-based burning
- `addMinter(account)` / `removeMinter(account)` — Governance-controlled minter management

#### 3.2.3 Relationship to Governance

AuToken holders do **not** have direct governance power. However:
- AuToken parameters (fees, burn rates, minter set) are governable
- AuToken economic policy is set through governance-controlled AMO operations
- AuToken value accrual affects the broader ecosystem that governance manages

### 3.3 veAg (Vote-Escrowed Ag)

**Mechanism:** Time-weighted voting power obtained by locking Ag tokens.

#### 3.3.1 Lock Tiers

| Lock Duration | Multiplier | Effective Power |
|--------------|-----------|-----------------|
| 1 month (30 days) | 1.0x | `locked_amount × 1.0` |
| 3 months (90 days) | 1.5x | `locked_amount × 1.5` |
| 6 months (180 days) | 2.0x | `locked_amount × 2.0` |
| 12 months (365 days) | 2.5x | `locked_amount × 2.5` |

#### 3.3.2 veAg Properties

- **Non-transferable:** veAg positions cannot be transferred or traded.
- **Linear decay:** Voting power decreases linearly from lock start to unlock time.
- **One position per address:** Each address may have one active veAg lock at a time.
- **Early withdrawal:** Not permitted before lock expiry (no early exit).
- **Renewal:** Upon expiry, the lock may be renewed; the multiplier resets based on new duration.

#### 3.3.3 veAg Power Calculation

```
veAgPower(lockedAmount, remainingDuration, maxDuration) = lockedAmount × (remainingDuration / maxDuration) × tierMultiplier
```

Where:
- `remainingDuration` = unlockTime - currentTimestamp
- `maxDuration` = total lock duration
- `tierMultiplier` = the multiplier for the chosen lock tier

#### 3.3.4 Rationale

The veAg mechanism serves three purposes:
1. **Long-term alignment:** Incentivizes holders to commit to the protocol's long-term success.
2. **Vote buying resistance:** Makes it expensive to temporarily acquire voting power.
3. **Governance quality:** Ensures voters have demonstrated commitment to the protocol.

---

## 4. Governor Architecture

### 4.1 GovernorContract Specification

**Contract:** `GovernorContract.sol`  
**Address:** `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385`  
**Chain:** Base Mainnet (Chain ID: 8453)

The GovernorContract is the central governance contract. It manages the proposal lifecycle, voting mechanics, and coordinates with the TimelockController for execution.

#### 4.1.1 Inheritance & Extensions

The GovernorContract inherits from OpenZeppelin's Governor framework with the following extensions:

- **GovernorVotes** — Voting power calculation from AgToken + veAg
- **GovernorTimelockControl** — Timelock integration for proposal execution
- **GovernorCountingSimple** — Vote counting (For, Against, Abstain)
- **GovernorVotesQuorumFraction** — Quorum as fraction of total supply

### 4.2 Proposal Lifecycle

#### 4.2.1 State Machine

```
                    ┌──────────┐
                    │  Pending  │ ◄── submit()
                    └────┬─────┘
                         │ votingDelay expires
                         ▼
                    ┌──────────┐
                    │  Active   │ ◄── voting period open
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ Succeeded │ │Defeated│ │ Canceled │
        └────┬─────┘ └────────┘ └──────────┘
             │
             │ queue()
             ▼
        ┌──────────┐
        │  Queued   │ ◄── timelock period
        └────┬─────┘
             │
             │ execute()
             ▼
        ┌──────────┐
        │ Executed  │
        └──────────┘
             │
             │ (if not executed within expiry)
             ▼
        ┌──────────┐
        │ Expired   │
        └──────────┘
```

#### 4.2.2 State Descriptions

| State | Description | Entry Condition | Exit Condition |
|-------|-------------|----------------|----------------|
| **Pending** | Submitted, waiting for voting delay | `proposal.state == ProposalState.Pending` | `block.timestamp >= proposal.voteStart` |
| **Active** | Voting open | `voteStart <= block.timestamp <= voteEnd` | `block.timestamp > voteEnd` |
| **Succeeded** | Voting passed (quorum met, majority yes) | `proposal.state == ProposalState.Succeeded` | `queue()` called |
| **Queued** | In timelock, awaiting execution | `proposal.state == ProposalState.Queued` | `execute()` called or expiry |
| **Executed** | Successfully executed on-chain | `proposal.state == ProposalState.Executed` | Terminal state |
| **Defeated** | Voting failed (quorum not met or majority no) | `proposal.state == ProposalState.Defeated` | Terminal state |
| **Canceled** | Canceled before execution | `proposal.state == ProposalState.Canceled` | Terminal state |
| **Expired** | Not executed within grace period | `block.timestamp > proposal.expiresAt` (while Queued) | Terminal state |

#### 4.2.3 State Transitions

```
Pending ──[votingDelay expires]──► Active
Active ──[quorum met, majority For]──► Succeeded
Active ──[quorum not met OR majority Against]──► Defeated
Active ──[cancel()]──► Canceled
Succeeded ──[queue()]──► Queued
Queued ──[execute()]──► Executed
Queued ──[expiry]──► Expired
Queued ──[cancel()]──► Canceled
```

### 4.3 Proposal Types

The Governor supports three proposal types, each with distinct parameters and requirements:

#### 4.3.1 Standard Proposal

**Purpose:** Any parameter change, contract upgrade, or operational action within the protocol.

| Parameter | Value |
|-----------|-------|
| Voting Delay | 1 block (immediate start) |
| Voting Period | 3 days (259,200 blocks at 12s/block) |
| Quorum | 4% of total Ag supply (including veAg) |
| Approval Threshold | Simple majority (>50% of votes cast) |
| Proposal Threshold | 1,000 Ag (minimum to submit) |
| Timelock Duration | 2 days |
| Cancellable | Yes (by proposer before queued) |

#### 4.3.2 Emergency Proposal

**Purpose:** Time-sensitive parameter changes requiring rapid response to market conditions or security concerns.

| Parameter | Value |
|-----------|-------|
| Voting Delay | 1 block |
| Voting Period | 1 day (86,400 blocks at 12s/block) |
| Quorum | 2% of total Ag supply |
| Approval Threshold | 2/3 supermajority (≥66.67% of votes cast) |
| Proposal Threshold | 5,000 Ag (higher to prevent spam) |
| Timelock Duration | 12 hours |
| Cancellable | No (once submitted, must complete voting) |
| Special Requirements | Must include justification string; emits `EmergencyProposalCreated` event |

#### 4.3.3 Constitutional Amendment

**Purpose:** Changes to the governance system itself (Governor parameters, timelock duration, quorum requirements, proposal types).

| Parameter | Value |
|-----------|-------|
| Voting Delay | 1 block |
| Voting Period | 7 days (604,800 blocks at 12s/block) |
| Quorum | 10% of total Ag supply |
| Approval Threshold | 3/4 supermajority (≥75% of votes cast) |
| Proposal Threshold | 10,000 Ag |
| Timelock Duration | 7 days |
| Cancellable | No |
| Special Requirements | Must reference the specific governance parameter being changed; subject to a 7-day community review period before voting begins |

#### 4.3.4 Proposal Type Comparison

| Attribute | Standard | Emergency | Constitutional |
|-----------|----------|-----------|---------------|
| Voting Period | 3 days | 1 day | 7 days |
| Quorum | 4% | 2% | 10% |
| Approval | >50% | ≥66.67% | ≥75% |
| Timelock | 2 days | 12 hours | 7 days |
| Threshold | 1,000 Ag | 5,000 Ag | 10,000 Ag |
| Cancellable | Yes | No | No |
| Review Period | None | None | 7 days |

### 4.4 Voting Mechanics

#### 4.4.1 Vote Types

| Vote | Value | Description |
|------|-------|-------------|
| Against | 0 | Votes against the proposal |
| For | 1 | Votes in favor of the proposal |
| Abstain | 2 | Participates for quorum but expresses no preference |

#### 4.4.2 Vote Power Calculation

```
votePower = Ag.balanceOf(voter) + veAg.lockedPower(voter)
```

The vote power is snapshotted at the proposal's `voteStart` block to prevent manipulation during the voting period.

#### 4.4.3 Vote Casting

- **On-chain voting:** Call `castVote(proposalId, support)` on the Governor.
- **Signature voting:** Call `castVoteBySig(proposalId, support, v, r, s)` for gasless voting.
- **Relay voting:** Call `castVoteWithReason(proposalId, support, reason)` to include a human-readable justification.
- **One vote per address per proposal:** Votes cannot be changed after casting.

#### 4.4.4 Quorum Calculation

```
quorumRequired = (totalSupply * quorumNumerator) / quorumDenominator
```

Where `quorumNumerator` and `quorumDenominator` are set per proposal type. The quorum is calculated against the **total Ag supply** (including locked veAg), not just circulating supply.

### 4.5 Proposal Threshold

The minimum voting power required to submit a proposal:

| Proposal Type | Minimum Ag |
|---------------|-----------|
| Standard | 1,000 Ag |
| Emergency | 5,000 Ag |
| Constitutional | 10,000 Ag |

This threshold prevents spam proposals while ensuring meaningful participation. The threshold is itself a governable parameter (via Constitutional Amendment).

### 4.6 Timelock Controller

**Contract:** `ArtifactTimelock.sol`  
**Role:** Enforces mandatory delay between proposal approval and execution.

#### 4.6.1 Timelock Stages

```
Succeeded ──[queue()]──► Queued ──[minDelay expires]──► Ready ──[execute()]──► Executed
```

| Stage | Description |
|-------|-------------|
| **Queued** | Proposal is in the timelock queue; `block.timestamp >= eta` must pass before execution. |
| **Ready** | Minimum delay has passed; execution is permitted. |
| **Executed** | Proposal has been executed; terminal state. |

#### 4.6.2 Timelock Durations

| Proposal Type | Min Delay |
|---------------|-----------|
| Standard | 2 days (172,800 seconds) |
| Emergency | 12 hours (43,200 seconds) |
| Constitutional | 7 days (604,800 seconds) |

#### 4.6.3 Timelock Operations

- `queue(proposalId, targets, values, calldatas, descriptionHash)` — Schedules execution after delay.
- `execute(proposalId, targets, values, calldatas, descriptionHash)` — Executes after delay expires.
- `cancel(proposalId)` — Cancels a queued proposal (governance only).
- `getMinDelay()` — Returns the current minimum delay.

#### 4.6.4 Execution Expiry

A queued proposal must be executed within **14 days** of being queued. After this period, the proposal expires and cannot be re-queued without resubmitting.

### 4.7 Cancellation and Veto Mechanisms

#### 4.7.1 Self-Cancellation

- **Who:** The original proposer (or any address with sufficient voting power).
- **When:** Before the proposal is queued (i.e., while Pending, Active, or Succeeded).
- **Effect:** Proposal state becomes `Canceled`; no execution possible.
- **Use case:** Proposer discovers an error in the proposal; community signals opposition.

#### 4.7.2 Guardian Veto

- **Who:** The Guardian address (set in OracleGuardian).
- **When:** At any point before execution.
- **Effect:** Proposal is canceled; emits `GuardianVeto` event.
- **Use case:** Security concern identified after proposal passes; malicious proposal detected.
- **Constraint:** Guardian veto can be overridden by a Constitutional Amendment.

#### 4.7.3 Timelock Cancellation

- **Who:** Governance itself (via a subsequent proposal).
- **When:** While proposal is Queued.
- **Effect:** Proposal is removed from the timelock queue.
- **Use case:** Circumstances change between approval and execution.

---

## 5. Parameter Catalog

### 5.1 Governor Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `votingDelay` | 1 block | 1 – 10,000 blocks | Constitutional | Delay before voting begins |
| `votingPeriod` (Standard) | 3 days | 1 – 14 days | Constitutional | Duration of voting |
| `votingPeriod` (Emergency) | 1 day | 4 hours – 3 days | Constitutional | Duration of emergency voting |
| `votingPeriod` (Constitutional) | 7 days | 3 – 30 days | Constitutional | Duration of constitutional voting |
| `quorumNumerator` (Standard) | 4 | 1 – 20 | Constitutional | Quorum as % of supply |
| `quorumNumerator` (Emergency) | 2 | 1 – 10 | Constitutional | Emergency quorum % |
| `quorumNumerator` (Constitutional) | 10 | 5 – 25 | Constitutional | Constitutional quorum % |
| `proposalThreshold` (Standard) | 1,000 Ag | 100 – 100,000 Ag | Constitutional | Min Ag to submit |
| `proposalThreshold` (Emergency) | 5,000 Ag | 1,000 – 100,000 Ag | Constitutional | Min Ag for emergency |
| `proposalThreshold` (Constitutional) | 10,000 Ag | 1,000 – 500,000 Ag | Constitutional | Min Ag for constitutional |
| `timelockMinDelay` (Standard) | 2 days | 1 hour – 14 days | Constitutional | Min execution delay |
| `timelockMinDelay` (Emergency) | 12 hours | 15 min – 3 days | Constitutional | Emergency min delay |
| `timelockMinDelay` (Constitutional) | 7 days | 3 days – 30 days | Constitutional | Constitutional min delay |

### 5.2 AgToken Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `name` | "Ag" | Immutable | Constitutional | Token name |
| `symbol` | "Ag" | Immutable | Constitutional | Token symbol |
| `initialSupply` | As deployed | Immutable | N/A | Initial token supply |
| `maxSupply` | As configured | > current supply | Standard | Maximum token supply |
| `emissionRate` | Per PID config | 0 – max per block | Standard | Tokens emitted per block |
| `minterSet` | Governance + PID | Set management | Standard | Authorized minter addresses |

### 5.3 AuToken Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `name` | "Au" | Immutable | Constitutional | Token name |
| `symbol` | "Au" | Immutable | Constitutional | Token symbol |
| `mintFee` | As configured | 0 – 5% | Standard | Fee on Au minting |
| `burnFee` | As configured | 0 – 5% | Standard | Fee on Au burning |
| `feeRecipient` | Treasury | Valid address | Standard | Where fees are sent |
| `minterSet` | TreasuryAMO + PID | Set management | Standard | Authorized minter addresses |
| `maxMintPerBlock` | As configured | > 0 | Standard | Cap on per-block minting |

### 5.4 TreasuryAMO Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `amoFee` | As configured | 0 – 10% | Standard | AMO operation fee |
| `maxSlippage` | As configured | 0.1 – 10% | Standard | Max slippage on swaps |
| `targetPrice` | As configured | > 0 | Standard | Target Au price |
| `pidKp` | As configured | > 0 | Standard | PID proportional gain |
| `pidKi` | As configured | > 0 | Standard | PID integral gain |
| `pidKd` | As configured | > 0 | Standard | PID derivative gain |
| `pidIntegralWindup` | As configured | > 0 | Standard | Max integral accumulation |
| `pidOutputMin` | As configured | ≥ 0 | Standard | Min PID output |
| `pidOutputMax` | As configured | > pidOutputMin | Standard | Max PID output |
| `pidPeriod` | As configured | 1 hour – 1 week | Standard | PID recalculation period |
| `pidActive` | True | Boolean | Standard | Whether PID is active |
| `maxReservesDeploy` | As configured | 0 – 100% | Standard | Max % of reserves per operation |
| `flashBuyEnabled` | As configured | Boolean | Standard | Whether FlashBuy is active |
| `flashBuyFee` | As configured | 0 – 5% | Standard | Fee on FlashBuy profits |
| `treasuryGuardian` | As configured | Valid address | Standard | Guardian address for Treasury |

### 5.5 PID Emission Controller Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `emissionRate` | As configured | 0 – max | Standard | Base emission rate |
| `minEmissionRate` | As configured | ≥ 0 | Standard | Floor emission rate |
| `maxEmissionRate` | As configured | > minEmissionRate | Standard | Ceiling emission rate |
| `decayFactor` | As configured | 0 – 1 | Standard | Emission decay per period |
| `boostFactor` | As configured | 1 – 10 | Standard | Emission boost multiplier |
| `stakingShare` | As configured | 0 – 100% | Standard | % of emissions to staking |
| `treasuryShare` | As configured | 0 – 100% | Standard | % of emissions to treasury |
| `adjustmentCooldown` | As configured | 1 hour – 1 week | Standard | Min time between adjustments |

### 5.6 OracleGuardian Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `guardian` | As configured | Valid address | Standard | Guardian address |
| `pauseAuthority` | As configured | Valid address | Standard | Who can pause |
| `shutdownAuthority` | As configured | Valid address | Standard | Who can shutdown |
| `priceDeviationThreshold` | As configured | 1 – 50% | Standard | Max price deviation before action |
| `heartbeat` | As configured | 1 min – 1 hour | Standard | Max time between oracle updates |
| `gracePeriod` | As configured | 10 min – 24 hours | Standard | Time before stale data triggers action |

### 5.7 AVLP Staking Parameters

| Parameter | Current Value | Valid Range | Proposal Type | Description |
|-----------|--------------|-------------|---------------|-------------|
| `stakingFee` | As configured | 0 – 10% | Standard | Fee on staking |
| `unstakingFee` | As configured | 0 – 10% | Standard | Fee on unstaking |
| `rewardRate` | As configured | ≥ 0 | Standard | Reward distribution rate |
| `minStakeDuration` | As configured | 0 – 365 days | Standard | Minimum lock time |
| `maxStakeDuration` | As configured | > minStakeDuration | Standard | Maximum lock time |
| `earlyUnstakePenalty` | As configured | 0 – 50% | Standard | Penalty for early exit |

---

## 6. Proposal Templates

### 6.1 Standard Parameter Change

**Purpose:** Modify a single parameter in a target contract.

```solidity
// Template: Set PID Kp
// Target: TreasuryAMO
// Function: setPidKp(uint256)
// Calldata construction:
bytes memory calldata = abi.encodeWithSignature("setPidKp(uint256)", newValue);

// Full proposal structure:
address[] memory targets = new address[](1);
targets[0] = address(treasuryAMO);

uint256[] memory values = new uint256[](1);
values[0] = 0; // No ETH value

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("setPidKp(uint256)", newValue);

string memory description = "# Set PID Proportional Gain\n\nSet kp to [newValue] for faster/slower emission adjustments.\n\n**Rationale:** [explanation]\n\n**Risk Assessment:** [analysis]";
```

### 6.2 Multi-Call Proposal

**Purpose:** Execute multiple operations atomically.

```solidity
// Template: Batch parameter updates
address[] memory targets = new address[](3);
targets[0] = address(treasuryAMO);
targets[1] = address(auToken);
targets[2] = address(pidController);

uint256[] memory values = new uint256[](3);
values[0] = values[1] = values[2] = 0;

bytes[] memory calldatas = new bytes[](3);
calldatas[0] = abi.encodeWithSignature("setPidKp(uint256)", newKp);
calldatas[1] = abi.encodeWithSignature("setMintFee(uint256)", newFee);
calldatas[2] = abi.encodeWithSignature("setMaxEmissionRate(uint256)", newMaxRate);

string memory description = "# Batch Parameter Update\n\n1. Set PID Kp to [newKp]\n2. Set Au mint fee to [newFee]\n3. Set max emission rate to [newMaxRate]\n\n**Rationale:** [explanation]";
```

### 6.3 Contract Upgrade

**Purpose:** Replace a contract implementation.

```solidity
// Template: Upgrade TreasuryAMO implementation
// Target: TreasuryAMO proxy
address[] memory targets = new address[](1);
targets[0] = address(treasuryAMO);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("upgradeTo(address)", newImplementation);

string memory description = "# Upgrade TreasuryAMO\n\nUpgrade to implementation [newImplementation].\n\n**Changes:** [list of changes]\n\n**Audit:** [audit reference]\n\n**Migration:** [migration plan if applicable]";
```

### 6.4 Emergency Pause

**Purpose:** Immediately pause protocol operations.

```solidity
// Template: Emergency pause
address[] memory targets = new address[](1);
targets[0] = address(oracleGuardian);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("pause()");

string memory description = "# EMERGENCY: Protocol Pause\n\nImmediately pause all protocol operations.\n\n**Reason:** [specific threat or issue]\n\n**Expected Duration:** [estimated time to resolution]\n\n**Next Steps:** [plan]";
```

### 6.5 Add/Remove Minter

**Purpose:** Manage the AuToken minter set.

```solidity
// Template: Add minter
address[] memory targets = new address[](1);
targets[0] = address(auToken);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("addMinter(address)", newMinter);

string memory description = "# Add Minter\n\nGrant minting authority to [newMinter].\n\n**Entity:** [description of minter]\n\n**Mint Cap:** [maximum mint authority]\n\n**Rationale:** [explanation]";
```

### 6.6 Grant Guardian Role

**Purpose:** Assign or modify the Guardian role.

```solidity
// Template: Set guardian
address[] memory targets = new address[](1);
targets[0] = address(oracleGuardian);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("setGuardian(address)", newGuardian);

string memory description = "# Update Guardian Role\n\nTransfer guardian role to [newGuardian].\n\n**Previous Guardian:** [current guardian]\n\n**New Guardian:** [new guardian]\n\n**Rationale:** [explanation]";
```

### 6.7 Execute FlashBuy

**Purpose:** Trigger a flash loan arbitrage operation.

```solidity
// Template: Execute FlashBuy
address[] memory targets = new address[](1);
targets[0] = address(treasuryFlashBuy);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeWithSignature("executeBuy(address,uint256,bytes)", token, minReturn, params);

string memory description = "# FlashBuy Execution\n\nExecute flash buy of [token] with min return [minReturn].\n\n**Expected Profit:** [estimate]\n\n**Market Conditions:** [description]\n\n**Risk:** [analysis]";
```

---

## 7. Security Model

### 7.1 Attack Vectors and Mitigations

#### 7.1.1 Flash Loan Voting

**Attack:** An attacker borrows a large amount of Ag via flash loan, votes on a proposal, and returns the tokens within the same transaction.

**Mitigations:**
- **Vote power snapshotting:** Voting power is recorded at the proposal's `voteStart` block, not at the time of voting. A flash loan acquired during the voting period cannot influence the vote.
- **Minimum lock duration:** veAg requires locking tokens for a minimum of 30 days, making flash loan acquisition of veAg impossible.
- **Historical balance tracking:** `getPriorVotes` uses checkpointed balances, preventing manipulation within a single block.

#### 7.1.2 Vote Buying / Bribery

**Attack:** An attacker offers payments to voters in exchange for their votes.

**Mitigations:**
- **veAg time-weighting:** Long-term locked voters have economic incentive alignment that makes short-term bribes insufficient.
- **Secret voting (future):** Integration with MACI (Minimal Anti-Collusion Infrastructure) to make votes non-verifiable, eliminating the mechanism for bribes.
- **Quorum requirements:** Requiring meaningful participation reduces the effectiveness of bribing a small number of voters.
- **Community social cost:** Voters with reputation in the ecosystem face informal consequences for accepting bribes.

#### 7.1.3 Governance Takeover via Token Accumulation

**Attack:** An attacker accumulates >50% of Ag supply to pass arbitrary proposals.

**Mitigations:**
- **veAg multiplier:** Long-term holders have disproportionate voting power relative to their token balance, requiring an attacker to acquire more than 50% of tokens AND outvote long-term lockers.
- **Timelock delay:** Even if a malicious proposal passes, the 2-day minimum timelock provides time for the community to detect and respond (e.g., via Guardian veto).
- **Constitutional Amendment threshold:** Changes to governance itself require 75% supermajority, making takeover of the governance mechanism itself extremely expensive.
- **Emergency proposal resistance:** Emergency proposals require 2/3 supermajority, preventing rapid malicious changes.

#### 7.1.4 Proposal Spam

**Attack:** An attacker submits numerous low-quality proposals to overwhelm governance.

**Mitigations:**
- **Proposal threshold:** Minimum 1,000 Ag required to submit a standard proposal.
- **Higher thresholds for critical actions:** Emergency (5,000 Ag) and Constitutional (10,000 Ag) proposals have higher barriers.
- **Cancellation mechanism:** The community can cancel spam proposals.
- **Economic cost:** Submitting proposals requires holding significant Ag, which has opportunity cost.

#### 7.1.5 Timelock Bypass

**Attack:** An attacker attempts to execute proposals without going through the timelock.

**Mitigations:**
- **Mandatory timelock:** All governance proposals must pass through the TimelockController; there is no bypass mechanism.
- **Immutable timelock duration:** The minimum delay can only be changed via Constitutional Amendment (7-day timelock, 75% supermajority).
- **Execution expiry:** Proposals that are not executed within 14 days expire, preventing stale malicious proposals from executing unexpectedly.

#### 7.1.6 Malicious Upgrade

**Attack:** An attacker passes a proposal to upgrade a contract to a malicious implementation.

**Mitigations:**
- **Timelock visibility:** The community sees the new implementation address during the timelock period and can veto.
- **Guardian veto:** The Guardian can cancel malicious proposals during the timelock.
- **Constitutional threshold for governance changes:** Changing the upgrade mechanism itself requires 75% supermajority.
- **Audit requirement (social):** The community expects all implementations to be audited before submission.

#### 7.1.7 Oracle Manipulation

**Attack:** An attacker manipulates price oracles to trigger incorrect AMO behavior.

**Mitigations:**
- **OracleGuardian:** Monitors price deviations and can pause operations if manipulation is detected.
- **Heartbeat check:** Stale oracle data triggers a pause.
- **PID bounds:** Min/max PID output limits prevent extreme responses to manipulated inputs.
- **Multi-oracle aggregation (future):** Multiple oracle sources reduce single-point-of-failure.

### 7.2 Defense-in-Depth Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Economic Security                              │
│ - Proposal threshold (cost to participate)              │
│ - veAg time-weighting (cost to acquire voting power)     │
│ - Supermajority requirements (cost to pass)             │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Temporal Security                              │
│ - Voting delay (time to detect malicious proposals)     │
│ - Voting period (time for community to respond)         │
│ - Timelock delay (time to veto before execution)        │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Consensus Security                             │
│ - Quorum requirements (minimum participation)           │
│ - Supermajority for critical actions                    │
│ - Constitutional Amendment threshold (75%)             │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Emergency Security                             │
│ - Guardian veto (cancel malicious proposals)            │
│ - Emergency pause (stop all operations)                 │
│ - Emergency shutdown (orderly wind-down)                │
├─────────────────────────────────────────────────────────┤
│ Layer 5: Oracle Security                                │
│ - Price deviation detection                             │
│ - Heartbeat monitoring                                  │
│ - PID output bounds                                     │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Governance Attack Cost Analysis

| Attack Scenario | Estimated Cost | Feasibility |
|----------------|---------------|-------------|
| Pass Standard Proposal | ~51% of Ag supply value | High cost, 2-day timelock to detect |
| Pass Emergency Proposal | ~67% of Ag supply value | Very high cost, fast execution |
| Pass Constitutional Amendment | ~75% of Ag supply value | Extremely high cost |
| Flash Loan Attack | Ineffective (snapshotting) | Blocked by design |
| Vote Buying | Variable (depends on veAg distribution) | Mitigated by secret voting (future) |
| Oracle Manipulation | Depends on oracle design | Mitigated by OracleGuardian |

---

## 8. Decentralization Roadmap

### 8.1 Phase 1: Deployer-Controlled (Current)

**Status:** Active  
**Duration:** From deployment until veAg activation

#### 8.1.1 Characteristics

- The deployer address has elevated privileges (Guardian role, parameter control).
- Governance parameters can be adjusted by the deployer without voting.
- The deployer can pause/unpause the protocol.
- The deployer can execute emergency shutdown.
- Governance proposals can be submitted but are advisory (deployer retains veto).

#### 8.1.2 Deployer Responsibilities

- Set initial governance parameters.
- Ensure protocol stability during bootstrapping.
- Coordinate with the community on governance transition.
- Maintain emergency response capability.

#### 8.1.3 Phase 1 Exit Criteria

- Protocol has demonstrated stability for ≥30 days.
- Ag token distribution is sufficiently broad (≥100 unique holders with >100 Ag each).
- Community governance forum is active with ≥50 participants.
- Security audit of governance contracts is complete.

### 8.2 Phase 2: veAg Activation

**Status:** Pending  
**Trigger:** Governance proposal + deployer approval

#### 8.2.1 Characteristics

- veAg locking mechanism is activated.
- Time-weighted voting power is enabled.
- Governance proposals become binding (deployer veto is removed for standard proposals).
- Emergency Guardian role is retained by deployer.

#### 8.2.2 veAg Launch Process

1. Deploy veAg contract (or activate existing staking contract for voting power).
2. Governance proposal to set veAg parameters (lock tiers, multipliers).
3. Community lock-up period (30 days) to establish veAg baseline.
4. Governance becomes binding after lock-up period.

#### 8.2.3 Phase 2 Exit Criteria

- ≥20% of Ag supply is locked in veAg.
- ≥5 unique addresses have locked Ag for ≥3 months.
- Governance has successfully passed ≥3 standard proposals.
- No security incidents in Phase 2.

### 8.3 Phase 3: Governance Handoff

**Status:** Pending  
**Trigger:** Constitutional Amendment

#### 8.3.1 Characteristics

- Deployer transfers Guardian role to a governance-controlled address (e.g., a multi-sig controlled by elected guardians).
- All governance powers are exercised exclusively through proposals.
- Deployer retains no special privileges.
- Guardian role is governed by a 3-of-5 multi-sig of community-elected guardians.

#### 8.3.2 Guardian Multi-Sig Setup

- 5 guardians elected by the community.
- 3-of-5 threshold for emergency actions.
- Guardians serve 6-month terms with staggered rotation.
- Guardian actions are time-locked (except emergency pause).

#### 8.3.3 Phase 3 Exit Criteria

- Guardian multi-sig is operational.
- Deployer has transferred all privileged roles.
- ≥10 governance proposals have been successfully executed.
- Community governance participation rate ≥5% of supply.

### 8.4 Phase 4: Full DAO

**Status:** Pending  
**Trigger:** Constitutional Amendment

#### 8.4.1 Characteristics

- All protocol parameters are controlled exclusively by governance.
- Guardian multi-sig is replaced by a governance-controlled Guardian election mechanism.
- All contracts are fully upgradeable via governance (no proxy admin privileges retained).
- The protocol is fully autonomous with no privileged addresses.

#### 8.4.2 Final Architecture

```
┌─────────────────────────────────────────┐
│           FULL DAO GOVERNANCE           │
│                                         │
│  Ag Holders ──vote──► Governor          │
│       ▲                     │           │
│       │                     ▼           │
│  veAg Lock ◄─── Timelock ──► Execution  │
│       │                     │           │
│       ▼                     ▼           │
│  Time-Weighted    All Protocol Contracts │
│  Voting Power     (Fully Governed)      │
└─────────────────────────────────────────┘
```

#### 8.4.3 Phase 4 Exit Criteria

- No privileged addresses remain in the system.
- All contracts are governed exclusively by the Governor.
- Guardian election is conducted via governance vote.
- The protocol has operated under full DAO control for ≥90 days without incident.

### 8.5 Phase Transition Governance

Each phase transition requires:

1. **Community Discussion:** Minimum 14-day discussion period on governance forum.
2. **Phase Transition Proposal:** A Constitutional Amendment specifying the transition.
3. **Supermajority Approval:** 75% of votes cast must support the transition.
4. **Timelock:** 7-day timelock before transition takes effect.
5. **Verification:** Community verification that transition conditions are met.

---

## 9. Operational Procedures

### 9.1 How to Submit a Proposal

#### 9.1.1 Pre-Submission Checklist

- [ ] Verify you have sufficient Ag balance (≥ threshold for proposal type).
- [ ] Ensure your Ag is not locked in a conflicting veAg position.
- [ ] Draft the proposal description with clear rationale.
- [ ] Verify all target addresses are correct (check against deployed addresses).
- [ ] Verify all calldata is correctly encoded (test on fork first).
- [ ] Consider security implications and potential attack vectors.
- [ ] Discuss on governance forum before submission.

#### 9.1.2 Submission Steps

1. **Encode the proposal:**
   ```solidity
   address[] memory targets = [...];
   uint256[] memory values = [...];
   bytes[] memory calldatas = [...];
   string memory description = "...";
   ```

2. **Call the Governor:**
   ```solidity
   governor.propose(targets, values, calldatas, description);
   ```

3. **Record the proposal ID** from the emitted `ProposalCreated` event.

4. **Announce the proposal** on the governance forum with:
   - Proposal ID
   - Description and rationale
   - Target contracts and functions
   - Expected outcomes
   - Risk assessment

#### 9.1.3 Proposal Description Format

```markdown
# [Proposal Title]

**Type:** Standard / Emergency / Constitutional
**Author:** [Your name/address]
**Summary:** One-paragraph summary

## Motivation
Why is this change needed?

## Specification
What exactly will happen?

## Technical Details
- Target: [address]
- Function: [signature]
- Parameters: [values]

## Risk Assessment
What could go wrong?

## Timeline
When should this take effect?

## References
Links to relevant discussions, audits, or prior art.
```

### 9.2 How to Vote

#### 9.2.1 Pre-Voting Checklist

- [ ] Verify you have sufficient voting power (Ag balance + veAg).
- [ ] Read the proposal description and understand the changes.
- [ ] Review the security implications.
- [ ] Check that the proposal is in Active state.
- [ ] Verify the proposal ID is correct.

#### 9.2.2 Voting Steps

1. **On-chain voting:**
   ```solidity
   // Vote FOR
   governor.castVote(proposalId, 1);
   
   // Vote AGAINST
   governor.castVote(proposalId, 0);
   
   // Vote ABSTAIN
   governor.castVote(proposalId, 2);
   ```

2. **Gasless voting (via signature):**
   ```solidity
   // Sign a vote signature off-chain, then submit
   governor.castVoteBySig(proposalId, support, v, r, s);
   ```

3. **Voting with reason:**
   ```solidity
   governor.castVoteWithReason(proposalId, support, "I support this because...");
   ```

#### 9.2.3 Voting Best Practices

- Vote based on analysis, not emotion.
- Consider the long-term health of the protocol.
- Engage with the community discussion.
- If you lack expertise on a topic, consider delegating to a knowledgeable delegate.
- Do not sell your vote.

### 9.3 How to Queue a Proposal

#### 9.3.1 Conditions

- Proposal must be in `Succeeded` state.
- Caller must have sufficient gas to execute the queue transaction.
- No special permission required (any address can queue).

#### 9.3.2 Queue Steps

```solidity
// Queue the proposal for execution
governor.queue(proposalId);
```

This sets the proposal's `eta` (execution time) to `block.timestamp + minDelay`.

#### 9.3.3 Post-Queue Actions

- Monitor the timelock period.
- Ensure the proposal is executed before expiry (14 days).
- If circumstances change, consider submitting a cancellation proposal.

### 9.4 How to Execute a Proposal

#### 9.4.1 Conditions

- Proposal must be in `Queued` state.
- The minimum timelock delay must have passed (`block.timestamp >= eta`).
- The proposal must not have expired (`block.timestamp <= eta + 14 days`).

#### 9.4.2 Execution Steps

```solidity
// Execute the proposal
governor.execute(proposalId);
```

#### 9.4.3 Post-Execution Verification

- Verify the expected state changes occurred.
- Check for any unexpected side effects.
- Monitor contract events for confirmation.
- Update protocol documentation if parameters changed.

### 9.5 Delegation

#### 9.5.1 How to Delegate

```solidity
// Delegate voting power to another address
agToken.delegate(delegatee);
```

#### 9.5.2 Delegation Best Practices

- Delegate to addresses you trust to vote in the protocol's best interest.
- Verify the delegate's voting history and positions.
- Delegation does not transfer token ownership; tokens remain in your wallet.
- You can change or revoke delegation at any time.

---

## 10. Emergency Procedures

### 10.1 Emergency Pause

#### 10.1.1 Purpose

Temporarily halt all protocol operations in response to a detected threat, vulnerability, or market anomaly.

#### 10.1.2 Who Can Pause

| Role | Can Pause | Conditions |
|------|-----------|------------|
| Guardian | Yes | Unilateral |
| Deployer (Phase 1-2) | Yes | Unilateral |
| Governance | Yes | Via Emergency Proposal |
| Any other | No | — |

#### 10.1.3 Pause Scope

When paused, the following operations are blocked:
- AuToken minting and burning
- TreasuryAMO operations
- FlashBuy execution
- Staking reward distribution
- Parameter changes (except unpause)

#### 10.1.4 Unpause Procedure

- **Guardian unpause:** Immediate, unilateral.
- **Governance unpause:** Standard proposal (3-day voting, 2-day timelock).
- **Deployer unpause (Phase 1-2):** Immediate, unilateral.

### 10.2 Emergency Shutdown

#### 10.2.1 Purpose

Orderly wind-down of protocol operations in response to an existential threat or critical vulnerability that cannot be patched.

#### 10.2.2 Who Can Shutdown

| Role | Can Shutdown | Conditions |
|------|-------------|------------|
| Guardian | Yes | With 2/3 guardian multi-sig (Phase 3+) |
| Deployer (Phase 1-2) | Yes | Unilateral |
| Governance | Yes | Via Constitutional Amendment |

#### 10.2.3 Shutdown Sequence

1. **Pause all operations** (emergency pause).
2. **Set AMO to withdrawal mode** (no new positions).
3. **Allow Au redemption** at current reserve ratio.
4. **Halt all new staking** and emissions.
5. **Enable fund recovery** mode.

#### 10.2.4 Post-Shutdown State

- All contracts are paused.
- Users can redeem Au against treasury reserves.
- Staked positions can be withdrawn (minus penalties).
- Governance can still operate to manage the wind-down.

### 10.3 Fund Recovery

#### 10.3.1 Purpose

Recover funds from protocol contracts in the event of a hack, bug, or unintended state.

#### 10.3.2 Recovery Mechanisms

| Mechanism | Access | Description |
|-----------|--------|-------------|
| **Guardian withdrawal** | Guardian only | Transfer specific tokens to recovery address |
| **Governance withdrawal** | Governance only | Transfer any tokens via proposal |
| **Emergency exit** | Any user | Redeem Au against reserves at face value |

#### 10.3.3 Recovery Process

1. Identify the affected contract and token.
2. Submit an Emergency Proposal to recover funds.
3. If Guardian is active, Guardian can execute immediate recovery.
4. Recovered funds are sent to a governance-controlled recovery address.
5. Community decides on distribution via governance proposal.

### 10.4 Emergency Communication

#### 10.4.1 Communication Channels

- **Governance Forum:** Primary discussion venue.
- **Discord/Telegram:** Real-time alerts.
- **Twitter/X:** Public announcements.
- **On-chain events:** Programmatic detection.

#### 10.4.2 Emergency Response Timeline

| Time | Action |
|------|--------|
| T+0 | Threat detected |
| T+15min | Guardian assesses and potentially pauses |
| T+1hr | Community notified via all channels |
| T+4hr | Emergency Proposal drafted if needed |
| T+24hr | Emergency vote concludes (if submitted) |
| T+36hr | Execution (if approved) |

### 10.5 Guardian Code of Conduct

Guardians shall:

1. **Act in the best interest of the protocol and its users.**
2. **Exercise emergency powers only when there is a clear and present threat.**
3. **Be transparent about all actions taken.**
4. **Coordinate with other guardians before taking unilateral action when possible.**
5. **Rescind emergency actions as soon as the threat is resolved.**

Guardians shall not:

1. **Use emergency powers for personal gain.**
2. **Pause the protocol to influence governance votes.**
3. **Withdraw funds for any purpose other than protocol recovery.**
4. **Collude with other guardians to centralize control.**

---

## 11. Appendices

### Appendix A: Contract Addresses (Base Mainnet)

| Contract | Address | Description |
|----------|---------|-------------|
| GovernorContract | `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` | Governance core |
| AgToken | `[Deployed Address]` | Governance token |
| AuToken | `[Deployed Address]` | Utility token |
| ArtifactTimelock | `[Deployed Address]` | Timelock controller |
| TreasuryAMO | `[Deployed Address]` | Automated market operations |
| OracleGuardian | `[Deployed Address]` | Oracle monitoring and safety |
| PID_Emission_Controller | `[Deployed Address]` | Emission rate control |
| AVLPStaking | `[Deployed Address]` | LP staking and veAg |
| FlashBuy | `[Deployed Address]` | Flash loan arbitrage |

### Appendix B: Event Reference

| Event | Contract | Description |
|-------|----------|-------------|
| `ProposalCreated` | Governor | New proposal submitted |
| `VoteCast` | Governor | Vote submitted |
| `ProposalQueued` | Governor | Proposal enters timelock |
| `ProposalExecuted` | Governor | Proposal executed |
| `ProposalCanceled` | Governor | Proposal canceled |
| `EmergencyProposalCreated` | Governor | Emergency proposal submitted |
| `GuardianVeto` | Governor | Guardian canceled proposal |
| `TimelockChange` | Governor | Timelock duration changed |
| `Paused` | OracleGuardian | Protocol paused |
| `Unpaused` | OracleGuardian | Protocol unpaused |
| `Shutdown` | OracleGuardian | Protocol shutdown |
| `PriceDeviation` | OracleGuardian | Price deviation detected |
| `EmissionRateChanged` | PID Controller | Emission rate updated |
| `Staked` | AVLPStaking | Tokens staked |
| `Withdrawn` | AVLPStaking | Tokens withdrawn |
| `FlashBuyExecuted` | FlashBuy | Flash buy completed |

### Appendix C: Function Selector Reference

| Function | Selector | Contract |
|----------|----------|----------|
| `propose(address[],uint256[],bytes[],string)` | `0x7d5e81e2` | Governor |
| `castVote(uint256,uint8)` | `0x56781388` | Governor |
| `castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)` | `0x3bccf4fd` | Governor |
| `castVoteWithReason(uint256,uint8,string)` | `0x7f3a8e56` | Governor |
| `queue(uint256)` | `0x19b40908` | Governor |
| `execute(uint256)` | `0xfe0d94c1` | Governor |
| `cancel(uint256)` | `0x40e58ee5` | Governor |
| `getMinDelay()` | `0xf27a0c92` | Timelock |
| `pause()` | `0x8456cb59` | Pausable |
| `unpause()` | `0x3f4ba83a` | Pausable |
| `delegate(address)` | `0x5c19a95c` | AgToken |
| `getCurrentVotes(address)` | `0xb4b5ea57` | GovernorVotes |
| `getPriorVotes(address,uint256)` | `0x8e539e8c` | GovernorVotes |
| `setPidKp(uint256)` | `[4-byte]` | TreasuryAMO |
| `setPidKi(uint256)` | `[4-byte]` | TreasuryAMO |
| `setPidKd(uint256)` | `[4-byte]` | TreasuryAMO |
| `setMaxEmissionRate(uint256)` | `[4-byte]` | PID Controller |
| `setMinEmissionRate(uint256)` | `[4-byte]` | PID Controller |
| `setStakingShare(uint256)` | `[4-byte]` | PID Controller |
| `setTreasuryShare(uint256)` | `[4-byte]` | PID Controller |
| `setGuardian(address)` | `[4-byte]` | OracleGuardian |
| `setHeartbeat(uint256)` | `[4-byte]` | OracleGuardian |
| `setPriceDeviationThreshold(uint256)` | `[4-byte]` | OracleGuardian |
| `stake(uint256,uint256)` | `[4-byte]` | AVLPStaking |
| `withdraw(uint256)` | `[4-byte]` | AVLPStaking |
| `claimRewards()` | `[4-byte]` | AVLPStaking |
| `executeBuy(address,uint256,bytes)` | `[4-byte]` | FlashBuy |

### Appendix D: Glossary of Mathematical Notation

| Symbol | Meaning |
|--------|---------|
| `votingPower(a)` | Total voting power of address `a` |
| `Ag.balanceOf(a)` | Raw Ag token balance of address `a` |
| `veAg.lockedPower(a)` | Time-weighted voting power from veAg for address `a` |
| `quorumRequired` | Minimum voting power needed for a valid vote |
| `proposal.threshold` | Minimum Ag needed to submit a proposal |
| `timelock.minDelay` | Minimum delay before execution |
| `pid.output(t)` | PID controller output at time `t` |
| `pid.error(t)` | Deviation from target at time `t` |
| `pid.integral` | Accumulated error over time |
| `pid.derivative` | Rate of change of error |

### Appendix E: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-28 | AV Treasury Team | Initial formal specification |

---

*This specification is a living document. Changes to the governance system that deviate from this specification require a Constitutional Amendment. All parameters listed as "governable" may be modified through the appropriate proposal type as defined herein.*

*For questions or clarifications, open an issue on the governance forum or contact the core contributors.*
