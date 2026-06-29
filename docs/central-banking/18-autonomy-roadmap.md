---
title: 18 — Path to Total Autonomy — Roadmap and Milestones
date: 2026-06-29
status: draft
description: Phase 4 — The complete roadmap from current state to a fully autonomous DAE. Covers milestones, success criteria, voting requirements, and what total autonomy means in practice.
category: central-banking
related: [16-dae-architecture.md, 17-sub-dao-pilots.md, 09-governance-framework.md, INDEX.md]
---

# 18 — Path to Total Autonomy

## 18.1 Vision

A treasury that operates continuously, adjusts to market conditions in
real-time, manages its own liquidity, executes its own monetary policy,
and only escalates to humans for constitutional decisions.

**Not a protocol that humans operate. A protocol that operates itself.**

## 18.2 Current State Assessment

| Component | Current Status | Autonomy Level |
|-----------|---------------|----------------|
| PID Controller | Live, algorithmic | Level 3 (autonomous) |
| Oracle (AvOracle v5) | Live, automated | Level 3 (autonomous) |
| FlashBuy | Live, trigger-based | Level 3 (autonomous) |
| TreasuryAMO | Live, manual rebalance | Level 1 (assisted) |
| Slipstream LP | Live, manual management | Level 1 (assisted) |
| Governance | Live, human voting | Level 0 (fully human) |
| Keeper bots | Source only, not deployed | Level 0 (nonexistent) |
| Sub-DAOs | Designed, not deployed | Level 0 (nonexistent) |

**Overall: Level 1.5** — core monetary policy is autonomous, everything else is manual.

## 18.3 Roadmap

### Milestone 1: Keeper Deployment (Weeks 1–4)

**Goal:** Deploy and test keeper infrastructure.

| Task | Contract/Script | Status |
|------|----------------|--------|
| Deploy Oracle Keeper | `scripts/oracle_keeper.js` | Source ready |
| Deploy Rebalance Keeper | New | Planned |
| Deploy Fee Compound Keeper | New | Planned |
| Keeper incentive contract | New | Planned |
| Keeper monitoring dashboard | New | Planned |

**Success Criteria:**
- Keepers run for 30 days without incident
- Rebalance triggers correctly on threshold
- Gas costs within budget
- No missed epochs

### Milestone 2: Sub-DAO Activation (Weeks 5–10)

**Goal:** Activate all three pilot sub-DAOs.

| Sub-DAO | Activation | Governance Vote |
|---------|-----------|-----------------|
| MPC | Week 5 | Standard proposal |
| TRO | Week 7 | Standard proposal |
| LQO | Week 9 | Standard proposal |

**Success Criteria:**
- All sub-DAOs operational for 30 days
- Performance metrics within targets
- On-chain reports published every epoch
- No emergency interventions needed

### Milestone 3: Governance Optimization (Weeks 8–12)

**Goal:** Reduce human governance to constitutional matters only.

| Change | Current | Target | Tier |
|--------|---------|--------|------|
| PID parameter adjustment | Governance vote | MPC autonomous | Standard |
| Rebalance execution | Manual | TRO autonomous | Standard |
| LP range adjustment | Manual | LQO autonomous | Standard |
| FlashBuy parameters | Governance vote | TRO within bounds | Standard |
| Keeper management | None | Automated + governance | Standard |
| Sub-DAO budgets | N/A | Algorithmic allocation | Constitutional |

**Success Criteria:**
- Zero routine governance proposals for 60 days
- All operations handled by sub-DAOs + keepers
- Governance only invoked for constitutional matters
- Emergency powers unused

### Milestone 4: Full Autonomy (Weeks 11–16)

**Goal:** Achieve Level 3 autonomy across all components.

**Success Criteria:**
- 90 days of autonomous operation
- TVL within 15% of PID target
- NAV stable (σ < 5% monthly)
- Zero human-initiated transactions (except governance)
- All sub-DAO metrics green
- Keeper uptime >99%

## 18.4 Voting Requirements

### 18.4.1 Current Governor Parameters

| Parameter | Value |
|-----------|-------|
| Voting delay | 1 day (1 block on Base, post-decay) |
| Voting period | 216,000 blocks (~3 days) |
| Proposal threshold | 100,000 Ag |
| Quorum | 4% of total supply |

### 18.4.2 Phase 4 Governance Votes Required

| # | Proposal | Tier | Threshold | Quorum |
|---|----------|------|-----------|--------|
| 1 | Activate keeper network | Standard | 100K Ag | 4% |
| 2 | Authorize MPC sub-DAO | Standard | 100K Ag | 4% |
| 3 | Authorize TRO sub-DAO | Standard | 100K Ag | 4% |
| 4 | Authorize LQO sub-DAO | Standard | 100K Ag | 4% |
| 5 | Set sub-DAO budgets | Standard | 100K Ag | 4% |
| 6 | Set keeper incentive parameters | Standard | 100K Ag | 4% |
| 7 | Transfer routine governance to sub-DAOs | Constitutional | 500K Ag | 10% |
| 8 | Set emergency powers scope | Constitutional | 500K Ag | 10% |

### 18.4.3 Voting Power Distribution

```
voting_power = Ag_balance_at_checkpoint
```

Voting power is **1:1 with Ag balance** at the proposal creation block
(checkpointed via `ERC20VotesUpgradeable`). There is **no veAg boost** or
lock-weighted multiplier in the current AgToken implementation.

Holders can **delegate** voting power to other addresses without transferring tokens.

### 18.4.4 Quorum Analysis

| Scenario | Participation | Result |
|----------|--------------|--------|
| Bull market, high engagement | 8–15% | Easily meets 4% |
| Bear market, low engagement | 2–5% | May fail 4% quorum |
| Constitutional proposal | 10–20% | Easily meets 10% |

**Risk:** Bear market quorum failure. Mitigation options:
- Lower quorum via governance (currently 4%)
- Delegation incentives to active governance participants
- Sub-DAO operational autonomy reduces need for frequent governance votes

## 18.5 What "Total Autonomy" Means

### 18.5.1 The DAE Will Autonomously:

1. **Adjust monetary policy** — PID gains, emission rates, epoch timing
2. **Manage reserves** — Asset allocation, rebalancing, yield generation
3. **Provide liquidity** — LP position management, range adjustment
4. **Execute buybacks** — FlashBuy when Au trades below NAV
5. **Compound returns** — Fee harvesting, reward reinvestment
6. **Monitor health** — Oracle validation, deviation detection, reporting
7. **Manage keepers** — Incentive adjustment, performance monitoring
8. **Allocate budgets** — Inter-sub-DAO capital allocation

### 18.5.2 The DAE Will NOT:

1. **Change its own governance** — requires human vote
2. **Add new collateral types** — requires human vote
3. **Deploy to new chains** — requires human vote
4. **Attack other protocols** — hardcoded prohibition
5. **Mint without PID computation** — impossible by design
6. **Withdraw to arbitrary addresses** — impossible by design
7. **Modify its own code** — requires timelock + governance
8. **Exceed risk bounds** — enforced by smart contracts

### 18.5.3 Emergency Override

The Treasury Safe (3-of-5 multisig) can:
- Pause any contract
- Cancel any timelock transaction
- Emergency withdraw to Safe
- Revoke keeper status

The Treasury Safe **cannot**:
- Mint Au or Ag
- Change PID parameters
- Execute FlashBuy
- Modify governance

This separation ensures the Safe can **stop** the DAE but cannot **operate** it.

## 18.6 Monitoring and Reporting

### 18.6.1 Real-Time Dashboard

The docs-site will display:
- Current TVL vs PID target
- Au price vs NAV
- PID emission rate
- Sub-DAO performance metrics
- Keeper health status
- Next epoch countdown

### 18.6.2 On-Chain Reports

Each sub-DAO publishes per-epoch:
- Actions taken (hashes)
- Performance vs targets
- Budget utilization
- Risk events
- Recommendations

### 18.6.3 Governance Digest

Monthly summary for governance participants:
- System health overview
- Sub-DAO performance
- Upcoming votes (if any)
- Risk assessment
- Parameter change recommendations

## 18.7 Risk Mitigation

| Risk | Phase 4 Mitigation |
|------|-------------------|
| Keeper failure | Redundant keepers, governance fallback |
| Sub-DAO underperformance | Automatic dissolution after 3 missed epochs |
| Oracle manipulation | Three-layer stack, deviation checks |
| Governance quorum failure | Delegation incentives, lower quorum via governance |
| Smart contract exploit | Audits, formal verification, emergency pause |
| Economic attack | FlashBuy, emission floor, reserve ratio |
| Regulatory uncertainty | Decentralized governance, no single point of control |

## 18.8 Success Metrics (6-Month Targets)

| Metric | Current | Target |
|--------|---------|--------|
| Autonomy level | 1.5 | 3.0 |
| TVL | Growing | Within 15% of PID target |
| Au price stability | Moderate | σ < 5% monthly |
| NAV premium/discount | Variable | <2% average |
| Keeper uptime | N/A | >99% |
| Governance proposals/month | Variable | <2 (constitutional only) |
| Sub-DAO performance | N/A | All metrics green |
| Emergency interventions | N/A | 0 |
