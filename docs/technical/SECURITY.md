# AV Treasury — Security Documentation

> **Protocol:** AV Treasury (Decentralized Central Banking on Base)  
> **Network:** Base (Ethereum L2, Chain ID 8453)  
> **Last Updated:** 2026-06-28  
> **Classification:** Public — Critical Infrastructure Documentation  

---

## Table of Contents

1. [Security Overview](#1-security-overview)
2. [Access Control Matrix](#2-access-control-matrix)
3. [Timelock Architecture](#3-timelock-architecture)
4. [Circuit Breakers](#4-circuit-breakers)
5. [Oracle Security](#5-oracle-security)
6. [Governance Security](#6-governance-security)
7. [AMO Security](#7-amo-security)
8. [Economic Attack Vectors](#8-economic-attack-vectors)
9. [Upgradeability Security](#9-upgradeability-security)
10. [Emergency Procedures](#10-emergency-procedures)
11. [Audit Status](#11-audit-status)
12. [Bug Bounty](#12-bug-bounty)
13. [Risk Matrix](#13-risk-matrix)

---

## 1. Security Overview

AV Treasury is a decentralized central banking protocol that manages algorithmic monetary policy on Base L2. The system issues two primary assets:

- **AgToken** — A seigniorage-stable asset managed through PID-controlled emissions
- **AuToken** — A reserve-backed store of value

The security model follows a **defense-in-depth** strategy with five concentric layers:

```
┌─────────────────────────────────────────────────────┐
│  Layer 5: Economic Incentives (game-theoretic)      │
│  Layer 4: Timelock Delays (48hr/24hr barriers)      │
│  Layer 3: Access Control (role-based permissions)    │
│  Layer 2: Circuit Breakers (pause + deviation)      │
│  Layer 1: Oracle Integrity (multi-source + TWAP)    │
└─────────────────────────────────────────────────────┘
```

### Core Security Principles

| Principle | Implementation |
|-----------|---------------|
| **Least Privilege** | Each role has minimal permissions for its function |
| **Time as a Security Primitive** | All state-changing governance actions pass through timelock |
| **Defense in Depth** | No single point of failure; multiple independent checks |
| **Fail-Safe Defaults** | Systems default to paused/restricted on anomaly detection |
| **Transparency** | All parameters, roles, and contract addresses are public |

### Deployed Contract Addresses

| Contract | Address | Purpose |
|----------|---------|---------|
| GovernorContract | `0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03` | Governance voting & proposal execution |
| ArtifactTimelock | `0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77` | 48hr timelock for governance actions |
| Treasury Safe | `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e` | Multi-sig execution layer |
| TreasuryAMO | `0xF096cD4D24811B0F824c929907196bCB796bca88` | Automated market operations |
| OracleWrapper | `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB` | Oracle deviation & staleness checks |
| OracleFlashBuy | `0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc` | Automated buyback execution |
| PID Emission Controller | `0xB8F240870DBc1cD5F9262F8180350A29ea404268` | AgToken minting via PID controller |
| AVLPStaking | `0x8F638B6C2EBD61A638561B6993930CF25D53ACB9` | Staking with Ag multiplier |

---

## 2. Access Control Matrix

### Role Definitions

| Role | Description | Trust Level |
|------|-------------|-------------|
| **GOVERNANCE** | GovernorContract — holds ultimate authority after timelock | Highest (but delayed) |
| **TIMELOCK** | ArtifactTimelock — queued operations awaiting execution | Automated (time-gated) |
| **GUARDIAN** | Emergency multi-sig — can pause, cannot unpause or extract | High (limited scope) |
| **AMO** | TreasuryAMO — automated market operations within bounds | Medium (parameter-gated) |
| **KEEPER** | Off-chain bots — trigger maintenance functions | Low (no state mutation) |

### Permission Matrix

| Function | GOVERNANCE | TIMELOCK | GUARDIAN | AMO | KEEPER | Public |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Proposal Creation** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅* |
| **Vote Casting** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅** |
| **Queue Timelock** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Execute Timelock** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Cancel Timelock** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Pause Protocol** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Unpause Protocol** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Emergency Shutdown** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Set Oracle Params** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Set AMO Bounds** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Execute Market Op** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Trigger Buyback** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Adjust PID Params** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Mint AgToken** | ❌ | ❌ | ❌ | ✅*** | ❌ | ❌ |
| **Upgrade Proxy** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Transfer Guardianship** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Withdraw Reserves** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> *Proposal creation requires minimum proposal threshold (governance tokens)  
> **Voting requires governance token balance at snapshot block  
> ***Only via PID controller within emission bounds

### Role Hierarchy

```
GOVERNANCE (GovernorContract)
  └── Can do everything, but ALL actions go through TIMELOCK first
  └── Cannot bypass timelock under any circumstances

TIMELOCK (ArtifactTimelock)
  └── Executes queued operations after delay expires
  └── Cannot initiate new operations
  └── Cannot cancel its own executions

GUARDIAN (Emergency Multi-sig)
  └── Can PAUSE everything immediately
  └── Can CANCEL pending timelock operations
  └── Can trigger EMERGENCY SHUTDOWN
  └── CANNOT unpause, withdraw funds, or change parameters

AMO (TreasuryAMO)
  └── Can execute market operations within set bounds
  └── Can mint AgToken via PID controller
  └── Cannot change its own bounds or permissions

KEEPER (Off-chain Bots)
  └── Can trigger buyback execution
  └── Can call view-only maintenance functions
  └── Cannot mutate protocol state directly
```

---

## 3. Timelock Architecture

### Overview

The timelock is the **primary security barrier** between governance intent and state mutation. It ensures that all governance actions are publicly visible for a minimum period before execution, giving users time to exit if they disagree with a proposal.

### Timelock Tiers

| Tier | Delay | Applies To | Rationale |
|------|-------|-----------|-----------|
| **Critical** | 48 hours | Parameter changes, upgrades, withdrawals | Maximum scrutiny for high-impact changes |
| **Standard** | 24 hours | Routine operations, bound adjustments | Balance between security and responsiveness |
| **Emergency** | 0 hours | Pause operations only | Guardian can halt immediately |

### Timelock Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Proposal │────▶│  Voting  │────▶│  Queued  │────▶│ Executed │
│ Created  │     │  Period  │     │ (48hr)   │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                      │
                                      ▼
                               ┌──────────┐
                               │ CANCELLED│
                               │(Governance│
                               │/Guardian) │
                               └──────────┘
```

### Timelock Guarantees

1. **No Instant Execution**: Even if governance is compromised, the attacker must wait 48 hours
2. **Public Visibility**: All queued operations are visible on-chain before execution
3. **Cancellability**: Guardian or governance can cancel malicious queued operations
4. **Atomicity**: Operations either fully succeed or fully revert
5. **Ordering**: Operations execute in queue order; front-running is impossible

### Timelock Edge Cases

| Scenario | Behavior |
|----------|----------|
| Operation expires (past grace period) | Must be re-queued; no stale execution |
| Multiple operations queued for same target | Each has independent delay timer |
| Operation fails at execution | Reverts; must be re-queued with fix |
| Guardian cancels during delay | Operation removed; no execution possible |
| Governance changes timelock delay | Only affects new queues, not existing |

---

## 4. Circuit Breakers

### Pause Mechanisms

The protocol implements a **hierarchical pause system** allowing granular response to threats:

| Pause Level | Scope | Who Can Trigger | Who Can Lift |
|-------------|-------|-----------------|--------------|
| **Global Pause** | All state-changing functions | GUARNANCE, GUARDIAN | GOVERNANCE (via timelock) |
| **AMO Pause** | TreasuryAMO operations only | GOVERNANCE, GUARDIAN | GOVERNANCE (via timelock) |
| **Buyback Pause** | OracleFlashBuy only | GOVERNANCE, GUARDIAN | GOVERNANCE (via timelock) |
| **Minting Pause** | PID emission controller | GOVERNANCE, GUARDIAN | GOVERNANCE (via timelock) |
| **Staking Pause** | AVLPStaking deposits/claims | GOVERNANCE, GUARDIAN | GOVERNANCE (via timelock) |

### Deviation Bounds

| Parameter | Upper Bound | Lower Bound | Action on Breach |
|-----------|-------------|-------------|------------------|
| Oracle price deviation | +5% from TWAP | -5% from TWAP | Revert operation |
| AMO daily volume | Configurable per pool | 0 | Pause AMO |
| Emission rate (PID) | Max mint per epoch | 0 | Clamp to bound |
| Slippage on market ops | 2% | N/A | Revert if exceeded |
| Reserve ratio | N/A | Minimum threshold | Halt minting |

### Rate Limits

| Operation | Rate Limit | Window | Purpose |
|-----------|-----------|--------|---------|
| AgToken minting | Max per block | 1 block | Prevent infinite mint exploits |
| Buyback execution | Max per epoch | 1 hour | Prevent drain via repeated buys |
| AMO operations | Max per day | 24 hours | Limit exposure to faulty AMO |
| Oracle updates | Min interval | 15 minutes | Prevent update spam |
| Guardian actions | 1 per type | 1 hour | Prevent guardian key compromise drain |

### Automatic Pause Triggers

The following conditions trigger **automatic pauses** without human intervention:

1. **Oracle deviation exceeds 10%** — OracleWrapper detects manipulation
2. **Reserve ratio drops below critical threshold** — Insolvency protection
3. **Unusual minting velocity** — PID controller detects runaway emissions
4. **Re-entrancy detected** — Re-entrancy guards on all external calls
5. **Block timestamp anomaly** — Timestamp manipulation beyond tolerance

---

## 5. Oracle Security

### Oracle Architecture

The protocol uses a **multi-layered oracle system** resistant to manipulation:

```
┌─────────────────────────────────────────────────────────────┐
│                    OracleFlashBuy                            │
│                   (Consumer Layer)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    OracleWrapper                             │
│              (Deviation + Staleness Checks)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Chainlink │ │  TWAP    │ │  Custom  │
    │  Price    │ │  Oracle  │ │  Source  │
    │  Feeds    │ │          │ │          │
    └──────────┘ └──────────┘ └──────────┘
```

### TWAP Manipulation Resistance

| Protection | Mechanism | Parameter |
|------------|-----------|-----------|
| **TWAP Window** | Time-weighted average over extended period | 30 minutes minimum |
| **Spot vs TWAP Deviation** | Reject if spot deviates beyond threshold | ±5% |
| **Liquidity Threshold** | Require minimum liquidity for price validity | Configurable per pair |
| **Block-Level Protection** | No single-block price reliance | Multi-block observation |

### Deviation Thresholds

| Check | Threshold | Action |
|-------|-----------|--------|
| Spot vs TWAP | > 5% deviation | Revert; flag for review |
| TWAP vs TWAP (different windows) | > 3% deviation | Use more conservative price |
| Sequential price change | > 2% per update | Rate-limit updates |
| Cross-source deviation | > 4% between sources | Pause and alert |

### Staleness Checks

| Source | Max Staleness | Fallback Behavior |
|--------|---------------|-------------------|
| Chainlink | 1 hour | Use TWAP if Chainlink stale |
| TWAP | 2 hours | Pause operations if TWAP stale |
| Custom oracle | 30 minutes | Fall back to Chainlink |

### Chainlink Fallback

When primary oracle sources fail or deviate:

1. **Primary**: Chainlink price feeds (if fresh and within deviation bounds)
2. **Secondary**: TWAP from on-chain DEX liquidity
3. **Tertiary**: Cross-reference with multiple DEX spot prices
4. **Last Resort**: Pause operations; require manual governance intervention

### Oracle Manipulation Cost Analysis

| Attack Type | Estimated Cost | Mitigation |
|-------------|---------------|------------|
| Single-block flash loan manipulation | High (must overcome TWAP) | TWAP window makes single-block attacks ineffective |
| Multi-block sustained manipulation | Very High | Deviation checks catch sustained drift |
| Oracle feed compromise | Critical | Multi-source aggregation; no single feed is authoritative |
| Liquidity manipulation | High | Liquidity threshold checks; low-liquidity prices rejected |

---

## 6. Governance Security

### Flash Loan Protection

Flash loans are **explicitly mitigated** through multiple mechanisms:

| Mechanism | Implementation | Effectiveness |
|-----------|---------------|-------------|
| **Snapshot-based voting** | Voting power determined at proposal creation block | Flash-loaned tokens cannot be used to vote |
| **Timelock delay** | 48-hour minimum before execution | Flash loan must be held for 48 hours (impossible) |
| **No instant governance** | No functions execute immediately | Even passed proposals are delayed |
| **Vote delegation lock** | Delegation changes have cooldown | Prevents last-minute vote buying via flash loan |

### Voting Power Manipulation Resistance

| Attack Vector | Mitigation |
|---------------|-----------|
| Flash loan voting | Snapshot block prevents borrowed token voting |
| Vote buying | Opaque on-chain; timelock gives targets time to exit |
| Sybil attacks | Minimum proposal threshold; delegation requirements |
| Governance token concentration | No single entity can pass proposals alone (quorum) |
| Re-entrancy in voting | Re-entrancy guards on all voting functions |

### Quorum Requirements

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Proposal Threshold** | Minimum tokens to create proposal | Prevents spam |
| **Quorum** | Minimum votes for proposal validity | Ensures sufficient participation |
| **Voting Period** | Configurable duration | Time for community to evaluate |
| **Execution Delay** | 48 hours post-passage | Time for response to malicious proposals |

### Timelock as Governance Barrier

The timelock is the **ultimate governance security guarantee**:

```
Compromised Governance Key
         │
         ▼
   Can create proposals
         │
         ▼
   Can vote (if has tokens)
         │
         ▼
   Can queue in timelock ◄── Operation is now PUBLIC
         │
         ▼
   48-hour delay begins ◄── Community can EXIT
         │
         ▼
   Guardian can CANCEL ◄── Emergency brake
         │
         ▼
   Execution (if not cancelled)
```

**Key insight**: Even with 100% of governance keys compromised, an attacker cannot:
- Execute operations instantly
- Prevent cancellation by Guardian
- Hide their intentions (all queued ops are public)
- Bypass the 48-hour delay

---

## 7. AMO Security

### Price Band Protections

The TreasuryAMO operates within **strict price bands** to prevent adverse operations:

| Parameter | Description | Bound |
|-----------|-------------|-------|
| **Upper Price Band** | Maximum price at which AMO will buy | Configurable per asset |
| **Lower Price Band** | Minimum price at which AMO will sell | Configurable per asset |
| **Mid-Relative Band** | Deviation from reference price | ±3% default |
| **Daily Volume Cap** | Maximum AMO volume per day | Configurable |

### Slippage Checks

| Operation | Max Slippage | Enforcement |
|-----------|-------------|-------------|
| Buy AgToken | 1% | Revert if slippage exceeded |
| Sell AgToken | 1% | Revert if slippage exceeded |
| Rebalancing | 0.5% | Revert if slippage exceeded |
| Reserve deposit | 0.1% | Revert if slippage exceeded |

### Reserve Limits

| Limit | Description | Action on Breach |
|-------|-------------|------------------|
| **Minimum Reserve Ratio** | Protocol must maintain minimum backing | Halt minting; trigger recapitalization |
| **Maximum AMO Exposure** | AMO cannot exceed % of total reserves | Pause AMO operations |
| **Per-Pool Limit** | Maximum liquidity in single pool | Redirect to other pools |
| **Daily Outflow Limit** | Maximum reserves moved per day | Queue excess for next day |

### AMO Operational Constraints

1. **No direct reserve withdrawal** — AMO can only operate within approved pools
2. **No arbitrary token transfers** — AMO can only interact with whitelisted tokens
3. **No self-approval** — AMO cannot increase its own limits
4. **No bypass of timelock** — All parameter changes go through governance
5. **Bounded emissions** — PID controller limits minting regardless of AMO requests

---

## 8. Economic Attack Vectors

### 8.1 Oracle Manipulation

| Attack | Description | Likelihood | Impact | Mitigation |
|--------|-------------|:---:|:---:|------------|
| **Spot price manipulation** | Manipulate DEX spot price to trigger false operations | Medium | High | TWAP averaging; deviation checks |
| **Flash loan price attack** | Use flash loan to manipulate price within single block | Low | High | TWAP window exceeds block duration |
| **Oracle feed delay** | Exploit staleness in price feeds | Low | Medium | Multi-source; staleness checks |
| **Liquidity drain** | Drain liquidity to make price unreliable | Medium | Medium | Liquidity threshold checks |

### 8.2 Flash Loan Attacks

| Attack | Description | Likelihood | Impact | Mitigation |
|--------|-------------|:---:|:---:|------------|
| **Governance flash loan** | Borrow tokens to pass malicious proposal | Very Low | Critical | Snapshot-based voting; timelock |
| **Arbitrage flash loan** | Exploit price differences across protocols | Medium | Low | Slippage checks; price bands |
| **Re-entrancy via flash loan** | Use flash loan callback for re-entrancy | Very Low | High | Re-entrancy guards on all functions |
| **Collateral manipulation** | Manipulate collateral value for borrowing | Low | Medium | Conservative LTV; oracle checks |

### 8.3 Sandwich Attacks

| Attack | Description | Likelihood | Impact | Mitigation |
|--------|-------------|:---:|:---:|------------|
| **AMO operation sandwich** | Front-run and back-run AMO trades | Medium | Medium | Slippage bounds; private mempool option |
| **Buyback sandwich** | Front-run OracleFlashBuy operations | Medium | Low | Slippage checks; deviation limits |
| **Governance action sandwich** | Trade ahead of known governance outcomes | Low | Low | Timelock reduces predictability |

### 8.4 Governance Attacks

| Attack | Description | Likelihood | Impact | Mitigation |
|--------|-------------|:---:|:---:|------------|
| **51% governance takeover** | Acquire majority of voting tokens | Low | Critical | Timelock; Guardian cancellation |
| **Proposal spam** | Flood governance with proposals | Medium | Low | Proposal threshold; quorum |
| **Malicious parameter change** | Pass proposal to set harmful parameters | Low | High | 48hr timelock; community review |
| **Timelock bypass** | Find way to execute without timelock | Very Low | Critical | No bypass paths exist in architecture |

### 8.5 Economic Exploits

| Attack | Description | Likelihood | Impact | Mitigation |
|--------|-------------|:---:|:---:|------------|
| **PID controller gaming** | Manipulate emissions via price oracle | Low | High | PID bounds; emission rate limits |
| **Reserve drain** | Extract reserves through repeated operations | Very Low | Critical | Reserve limits; daily caps |
| **Staking reward manipulation** | Game the Ag multiplier system | Low | Medium | Multiplier bounds; time-weighted |
| **Seigniorage extraction** | Capture seigniorage unfairly | Low | Medium | PID controller; reserve requirements |

---

## 9. Upgradeability Security

### Proxy Pattern

The protocol uses **UUPS (Universal Upgradeable Proxy Standard)** for upgradeable contracts:

| Contract | Proxy Type | Upgrade Authority |
|----------|-----------|-------------------|
| AgToken | UUPS Proxy | Governance (via timelock) |
| AuToken | UUPS Proxy | Governance (via timelock) |
| AVLPStaking | UUPS Proxy | Governance (via timelock) |

### Upgrade Security Measures

| Measure | Implementation | Purpose |
|---------|---------------|---------|
| **Timelock-gated upgrades** | All upgrades pass through 48hr timelock | Community visibility |
| **Implementation verification** | New implementation verified on explorer before upgrade | Transparency |
| **Storage layout checks** | Storage compatibility verified before upgrade | Prevent corruption |
| **Upgrade simulation** | Testnet simulation before mainnet upgrade | Catch bugs |
| **Guardian veto** | Guardian can cancel upgrade if malicious | Emergency brake |

### Proxy Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Implementation self-destruct** | Critical | Implementation cannot self-destruct; only proxy admin can upgrade |
| **Storage collision** | High | Strict storage layout validation; use of established patterns |
| **Initialization front-running** | Medium | Initialize in same transaction as deployment |
| **Admin key compromise** | Critical | Admin is timelock; 48hr delay on all upgrades |
| **Logic contract bug** | Medium | Audits; gradual rollout; pause capability |

### Upgrade Process

```
1. Deploy new implementation contract
2. Verify implementation on BaseScan
3. Simulate upgrade on testnet
4. Create governance proposal for upgrade
5. Community reviews for voting period
6. If passed, queue in timelock (48hr)
7. Guardian monitors during delay
8. Execute upgrade after timelock expires
9. Verify post-upgrade state
```

---

## 10. Emergency Procedures

### Pause Triggers

The following conditions warrant **immediate pause**:

| Trigger | Severity | Automatic? | Who Can Pause |
|---------|----------|:---:|---------------|
| Oracle deviation > 10% | Critical | Yes | Automatic |
| Re-entrancy detected | Critical | Yes | Automatic |
| Unusual mint velocity | High | Yes | Automatic |
| Suspected governance compromise | High | No | Guardian |
| Critical bug discovered | Critical | No | Guardian |
| Reserve ratio below minimum | Critical | Yes | Automatic |
| L2 sequencer downtime | Medium | No | Guardian |

### Emergency Shutdown

In extreme circumstances, the protocol can be **fully shut down**:

| Phase | Action | Who |
|-------|--------|-----|
| **1. Pause** | All state-changing functions paused | Guardian (instant) |
| **2. Freeze** | No new deposits, mints, or operations | Guardian |
| **3. Settle** | Allow withdrawals at current state | Governance (timelock) |
| **4. Recover** | Fund recovery process initiated | Governance + Guardian |

### Fund Recovery

| Scenario | Recovery Process |
|----------|-----------------|
| **Paused protocol** | Users can withdraw their share of reserves |
| **Stuck funds** | Governance can initiate recovery after timelock |
| **Incorrect state** | Upgrade to fix; migrate state |
| **Hacked funds** | If recoverable, governance can redirect (via timelock) |

### Guardian Emergency Powers

The Guardian role has **limited but critical** emergency powers:

| Power | Scope | Limitation |
|-------|-------|------------|
| Pause protocol | All or specific subsystems | Cannot unpause |
| Cancel timelock operations | Any pending operation | Cannot execute new ops |
| Trigger emergency shutdown | Full protocol halt | Cannot restart |
| Rate-limit operations | Reduce limits | Cannot increase limits |

> **Design principle**: Guardian can only **restrict**, never **expand**. This prevents a compromised Guardian from extracting funds.

---

## 11. Audit Status

### Completed Audits

| Audit | Scope | Status | Report |
|-------|-------|--------|--------|
| Core Treasury | TreasuryAMO, PID Controller | ⏳ Pending | — |
| Oracle System | OracleWrapper, OracleFlashBuy | ⏳ Pending | — |
| Governance | GovernorContract, ArtifactTimelock | ⏳ Pending | — |
| Token Contracts | AgToken, AuToken (proxies) | ⏳ Pending | — |
| Staking | AVLPStaking | ⏳ Pending | — |

### Audit Roadmap

| Phase | Target | Scope |
|-------|--------|-------|
| **Phase 1** | Pre-launch | Core contracts, access control, timelock |
| **Phase 2** | Post-launch (Month 1) | Oracle system, AMO, PID controller |
| **Phase 3** | Post-launch (Month 3) | Full protocol integration, edge cases |
| **Ongoing** | Quarterly | New features, parameter changes |

### Known Issues and Limitations

| Issue | Severity | Status | Mitigation |
|-------|----------|--------|-----------|
| L2 sequencer dependency | Medium | Acknowledged | Monitor sequencer status; pause if needed |
| Gas price volatility | Low | Acknowledged | Rate limits prevent gas-based attacks |
| Governance token concentration | Medium | Monitoring | Encourage delegation; monitor whale activity |
| Cross-chain bridge risk | Medium | Acknowledged | Minimize bridge dependencies |
| PID controller edge cases | Low | Testing | Conservative bounds; pause capability |
| Oracle source centralization | Medium | In Progress | Adding additional oracle sources |

### Security Assumptions

The protocol security relies on the following assumptions:

1. **Base L2 is operational** — Protocol cannot function during L2 downtime
2. **At least one oracle source is honest** — Multi-source aggregation requires majority honesty
3. **Guardian keys are secure** — Guardian compromise allows pause but not fund extraction
4. **Timelock cannot be bypassed** — Architectural guarantee, not economic
5. **Governance token distribution** — Sufficiently decentralized to prevent unilateral control

---

## 12. Bug Bounty

### Program Scope

| In Scope | Out of Scope |
|----------|-------------|
| Core protocol contracts | Third-party integrations |
| Oracle system | Front-end applications |
| Governance contracts | Social engineering attacks |
| AMO logic | Base L2 infrastructure |
| Staking contracts | Already known issues |

### Reward Tiers

| Severity | Description | Reward Range |
|----------|-------------|:------------:|
| **Critical** | Direct fund loss, infinite mint, governance takeover | $50,000 — $500,000 |
| **High** | Temporary fund freeze, significant economic damage | $10,000 — $50,000 |
| **Medium** | Partial functionality disruption, minor economic impact | $2,500 — $10,000 |
| **Low** | Non-critical issues, gas optimizations, code quality | $500 — $2,500 |

### Submission Guidelines

1. **Do not exploit** — Demonstrating impact on mainnet disqualifies the submission
2. **Private disclosure** — Submit via secure channel; do not disclose publicly
3. **Detailed report** — Include reproduction steps, impact assessment, and suggested fix
4. **One issue per report** — Separate reports for separate vulnerabilities

### Contact

| Channel | Details |
|---------|---------|
| **Email** | security@avtreasury.xyz (PGP key available) |
| **Immunefi** | [Program link — TBD] |
| **Discord** | #-security channel (core team only) |
| **On-chain** | Emergency contact via contract events |

### Safe Harbor

The AV Treasury team commits to:

- **No legal action** against good-faith security researchers
- **No retaliation** for responsible disclosure
- **Timely response** — Initial response within 48 hours
- **Fair compensation** — Rewards paid promptly upon confirmed vulnerability

---

## 13. Risk Matrix

### Comprehensive Risk Assessment

| # | Risk | Category | Likelihood | Impact | Mitigation | Residual Risk |
|---|------|----------|:---:|:---:|------------|:---:|
| 1 | Oracle manipulation (spot) | Oracle | Medium | High | TWAP + deviation checks | Low |
| 2 | Oracle feed compromise | Oracle | Low | Critical | Multi-source aggregation | Low |
| 3 | Flash loan governance attack | Governance | Very Low | Critical | Snapshot voting + timelock | Very Low |
| 4 | Governance key compromise | Governance | Low | Critical | Timelock + Guardian cancel | Very Low |
| 5 | Timelock bypass | Architecture | Very Low | Critical | No bypass paths exist | Very Low |
| 6 | AMO parameter exploitation | AMO | Low | High | Bounds + rate limits + pause | Low |
| 7 | PID controller gaming | Economic | Low | High | Emission bounds + rate limits | Low |
| 8 | Reserve drain via operations | Economic | Very Low | Critical | Reserve limits + daily caps | Very Low |
| 9 | Proxy implementation bug | Upgrade | Low | High | Audits + timelock upgrades | Low |
| 10 | Implementation self-destruct | Upgrade | Very Low | Critical | No self-destruct in logic | Very Low |
| 11 | Storage collision on upgrade | Upgrade | Low | High | Layout validation + testing | Very Low |
| 12 | Sandwich attack on AMO | MEV | Medium | Medium | Slippage bounds + private mempool | Low |
| 13 | Re-entrancy exploit | Technical | Very Low | High | Re-entrancy guards on all functions | Very Low |
| 14 | L2 sequencer failure | Infrastructure | Low | High | Pause + manual intervention | Medium |
| 15 | Guardian key compromise | Access | Low | Medium | Guardian can only restrict, not extract | Low |
| 16 | Cross-chain bridge exploit | External | Medium | High | Minimize bridge dependencies | Medium |
| 17 | Governance token concentration | Governance | Medium | High | Delegation incentives + monitoring | Medium |
| 18 | Smart contract compiler bug | Technical | Very Low | High | Use stable compiler + audits | Low |
| 19 | Economic model failure | Economic | Low | High | Conservative parameters + pause | Medium |
| 20 | Regulatory action | External | Medium | Medium | Decentralized design + legal review | Medium |

### Risk Heat Map

```
         Impact →
         Low    Medium    High    Critical
Likelihood ↓
High    │        │   12    │         │        │
Medium  │        │  1,16   │  17,19  │        │
Low     │   11   │   15    │ 6,7,9   │   4    │
Very Low│        │         │  13,18  │ 3,5,8  │
        └────────┴─────────┴─────────┴────────┘
```

### Risk Trend

| Period | New Risks | Mitigated Risks | Net Risk |
|--------|-----------|-----------------|----------|
| Pre-launch | 20 (initial assessment) | 0 | 20 |
| Post-audit (est.) | — | 5-8 | 12-15 |
| Mature protocol (est.) | — | 10-12 | 8-10 |

---

## Appendix A: Contract Dependency Graph

```
                    GovernorContract
                          │
                          ▼
                   ArtifactTimelock
                     │    │    │
          ┌─────────┘    │    └─────────┐
          ▼              ▼              ▼
    Treasury Safe   TreasuryAMO    Proxy Admin
          │              │
          │         ┌────┴────┐
          │         ▼         ▼
          │   OracleWrapper  PID Controller
          │         │
          │         ▼
          │   OracleFlashBuy
          │
    ┌─────┴─────┬───────────┐
    ▼           ▼           ▼
 AgToken     AuToken    AVLPStaking
 (proxy)     (proxy)     (proxy)
```

## Appendix B: Key Security Parameters

| Parameter | Value | Contract |
|-----------|-------|----------|
| Timelock delay (critical) | 48 hours | ArtifactTimelock |
| Timelock delay (standard) | 24 hours | ArtifactTimelock |
| Oracle deviation threshold | 5% | OracleWrapper |
| TWAP window | 30 minutes | OracleWrapper |
| Max slippage (AMO) | 2% | TreasuryAMO |
| Max slippage (buyback) | 1% | OracleFlashBuy |
| Max daily AMO volume | Configurable | TreasuryAMO |
| Min reserve ratio | Configurable | TreasuryAMO |
| Guardian action cooldown | 1 hour | GovernorContract |
|