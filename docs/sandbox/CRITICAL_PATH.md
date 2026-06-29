---
title: Critical Path & Timeline
date: 2026-06-29
status: canonical
description: Full critical path from current state to mainnet deployment, including milestones and dependencies.
category: sandbox
related: [sandbox/CONTRACT_INVENTORY.md, sandbox/DEPLOYMENT_READINESS.md, sandbox/DEPENDENCY_GRAPH.md]
---

# AV TREASURY — Critical Path & Timeline

**Date:** 2026-06-24  
**Scope:** Full path from current state to mainnet live  
**Current State:** All 14 contracts written, sandbox deployed locally, 90/100 readiness  
**Target:** Mainnet launch with full formal verification and professional audit  

---

## 1. Critical Path Overview

```
Current State (June 24, 2026)
    │
    ▼
Phase 0: Tooling Setup ──────────────────────────── 1-2 days
    │
    ▼
Phase 1: Free Verification ──────────────────────── 3-5 days (parallel with Phase 2)
    │
    ▼
Phase 2: Testnet Deployment ─────────────────────── 2-4 weeks
    │
    ▼
Phase 3: Professional Audit (Certora) ───────────── 4-8 weeks
    │
    ▼
Phase 4: Mainnet Preparation ─────────────────────── 1-2 weeks
    │
    ▼
Phase 5: Mainnet Launch ─────────────────────────── 1 day
    │
    ▼
Phase 6: Post-Launch Monitoring ─────────────────── Ongoing

TOTAL ESTIMATED TIME: 2-4 months
```

---

## 2. Phase 0 — Tooling Setup (1-2 days)

### 2.1 Tasks

| Task | Duration | Dependencies | Owner |
|------|----------|-------------|-------|
| Enable Solidity SMTChecker | 2 hours | Hardhat config | Dev |
| Install Halmos | 1 hour | pip, Python 3.11 | Dev |
| Install Contender | 1 hour | npm, Node 22 | Dev |
| Install Mythril | 2 hours | pip, Docker | Dev |
| Write PID invariant tests | 4 hours | Contender installed | Dev |
| Write AgToken invariant tests | 2 hours | Contender installed | Dev |
| Write AuToken invariant tests | 2 hours | Contender installed | Dev |
| Write TreasuryAMO invariant tests | 3 hours | Contender installed | Dev |

### 2.2 Deliverables

- [ ] hardhat.config.js with SMTChecker enabled
- [ ] Halmos, Contender, Mythril installed and verified
- [ ] test/pid-invariants.t.sol
- [ ] test/agtoken-invariants.t.sol
- [ ] test/autoken-invariants.t.sol
- [ ] test/treasuryamo-invariants.t.sol

### 2.3 Gate Criteria

- All tools compile and run
- At least 10 invariants written per contract
- All invariants pass on current code

---

## 3. Phase 1 — Free Verification (3-5 days)

### 3.1 Tasks

| Task | Duration | Tool | Output |
|------|----------|------|--------|
| SMTChecker on all 8 contracts | 4 hours | solc built-in | smtchecker-report/ |
| Halmos on AgToken | 2 hours | Halmos | halmos-report-agtoken.md |
| Halmos on AuToken | 2 hours | Halmos | halmos-report-autoken.md |
| Halmos on TreasuryAMO | 2 hours | Halmos | halmos-report-treasuryamo.md |
| Halmos on PID | 3 hours | Halmos | halmos-report-pid.md |
| Contender invariant tests | 4 hours | Contender | contender-report.md |
| Mythril security scan | 3 hours | Mythril | mythril-report.md |
| Fix CRITICAL/HIGH findings | 1-3 days | — | git commits |
| Re-run verification | 2 hours | All tools | Updated reports |

### 3.2 Deliverables

- [ ] All SMTChecker reports (no assertion violations)
- [ ] Halmos reports for 4 key contracts
- [ ] Contender invariant test report (all pass)
- [ ] Mythril report (no HIGH/CRITICAL findings)
- [ ] Fix commits for any findings
- [ ] Updated verification reports

### 3.3 Gate Criteria

- Zero CRITICAL findings in any tool
- Zero HIGH findings in any tool
- All invariants pass
- All known issues documented and tracked

---

## 4. Phase 2 — Testnet Deployment (2-4 weeks)

### 4.1 Week 1: Preparation & Deploy

| Task | Duration | Dependencies |
|------|----------|-------------|
| Finalize RealLPNFT implementation | 3 days | — |
| Deploy to Arbitrum Sepolia | 1 day | RealLPNFT ready |
| Initialize all contracts | 0.5 day | Deployed |
| Fund treasury with test USDC | 0.5 day | Initialized |
| Verify all contracts on Sepolia Basescan | 1 day | Deployed |
| Run 100K Monte Carlo simulation | 1 day | — |

### 4.2 Week 2: Testing & Bot Simulation

| Task | Duration | Dependencies |
|------|----------|-------------|
| 30-day bot simulation on testnet | 5 days | Contracts deployed |
| Test buyback execution | 1 day | Treasury funded |
| Test PID emission distribution | 1 day | Stakers active |
| Test staking/unstaking flow | 1 day | Users active |
| Test governance proposals | 1 day | Governor deployed |
| Test emergency pause/unpause | 1 day | — |

### 4.3 Week 3-4: Fix & Iterate

| Task | Duration | Dependencies |
|------|----------|-------------|
| Fix testnet issues | 3-5 days | Issues identified |
| Re-deploy fixed contracts | 1 day | Fixes ready |
| Re-run bot simulation | 2 days | Re-deployed |
| Final testnet report | 1 day | All tests pass |

### 4.4 Deliverables

- [ ] RealLPNFT deployed and verified
- [ ] All 8 production contracts deployed to Arbitrum Sepolia
- [ ] All contracts verified on Sepolia Basescan
- [ ] 30-day bot simulation report
- [ ] Testnet issue log (resolved)
- [ ] Testnet deployment manifest

### 4.5 Gate Criteria

- All contracts deployed and verified
- 30-day simulation shows stable economics
- No CRITICAL/HIGH issues discovered
- All testnet issues resolved
- Au stability > 0.45 in simulation

---

## 5. Phase 3 — Professional Audit (4-8 weeks)

### 5.1 Certora Formal Verification (4-6 weeks)

| Task | Duration | Dependencies |
|------|----------|-------------|
| Engage Certora | 1 week | Contract signed |
| Write CVL specifications | 2 weeks | Certora engaged |
| Run Certora verification | 1 week | Specs written |
| Fix Certora findings | 1-2 weeks | Findings identified |
| Re-run until clean | 1 week | Fixes applied |

### 5.2 External Audit Firm (optional, 2-4 weeks)

| Task | Duration | Dependencies |
|------|----------|-------------|
| Select audit firm | 1 week | — |
| Share codebase | 0.5 day | Selected |
| Audit period | 2-3 weeks | Code shared |
| Fix audit findings | 1 week | Issues identified |
| Final report | 0.5 day | All fixed |

### 5.3 CVL Specification Plan

| Contract | Properties to Verify |
|----------|---------------------|
| AgToken | Supply cap, no unauthorized mint, upgrade safety |
| AuToken | Supply cap, deflation, fee correctness |
| Staking | Reward solvency, min stake, rate change timelock |
| PID | Emission bounds, TWATVL correctness, emergency stop |
| TreasuryAMO | Runway maintained, epoch cap, slippage |
| Governor | Quorum, timelink, proposal lifecycle |

### 5.4 Deliverables

- [ ] Certora engagement contract
- [ ] CVL specifications for all contracts
- [ ] Certora verification report (clean)
- [ ] External audit report (if engaged)
- [ ] Fix commits for all findings
- [ ] Final clean verification report

### 5.5 Gate Criteria

- Certora: all specifications pass
- External audit: zero CRITICAL, zero HIGH
- All findings resolved
- Re-verification confirms fixes

---

## 6. Phase 4 — Mainnet Preparation (1-2 weeks)

### 6.1 Tasks

| Task | Duration | Dependencies |
|------|----------|-------------|
| Deploy RealLPNFT to mainnet | 1 day | Audit complete |
| Deploy all contracts to mainnet | 1 day | LP NFT deployed |
| Initialize with production params | 0.5 day | Deployed |
| Transfer ownership to Timelock | 0.5 day | Initialized |
| Revoke deployer permissions | 0.5 day | Ownership transferred |
| Set up keeper bot infrastructure | 2 days | Contracts deployed |
| Set up monitoring (Grafana/Dune) | 2 days | Contracts live |
| Set up alerts (Discord/PagerDuty) | 1 day | Monitoring ready |
| Set up Gnosis Safe multisig | 1 day | — |
| Prepare emergency response playbook | 1 day | — |
| Prepare token listing strategy | 1 day | — |

### 6.2 Production Parameters

```javascript
// Base Mainnet Configuration
const PRODUCTION_CONFIG = {
  // Governance
  TIMELOCK_DELAY: 2 * 24 * 3600,  // 48 hours

  // Token
  AG_NAME: "ARTIFACT",
  AG_SYMBOL: "ART",
  AU_NAME: "Artifact Utility",
  AU_SYMBOL: "AU",

  // PID
  PID_TVL_TARGET: parseEther("10000000"),  // $10M
  PID_KP: parseEther("0.0001"),
  PID_KI: parseEther("0.00001"),
  PID_KD: parseEther("0.00005"),

  // Staking
  AG_THRESHOLD: parseEther("1000"),

  // Treasury
  RESERVE_TOKEN_ADDRESS: "0x833589cCDB0a6e3bc84827a6bD4c6b4a7a2eb3e",  // USDC Base
  AERODROME_ROUTER_ADDRESS: "0x4752bA5Db23f44F6821471A762f7D6f2d65F10B9",
  BUYBACK_PCT: 12,
  MIN_BUYBACK_USD: 500,
  MAX_BUYBACK_EPOCH_BPS: 500,
};
```

### 6.3 Deliverables

- [ ] RealLPNFT deployed to mainnet
- [ ] All 8 contracts deployed to Base mainnet
- [ ] All contracts verified on Basescan
- [ ] Ownership transferred to Timelock
- [ ] Deployer permissions revoked
- [ ] Keeper bot operational
- [ ] Monitoring dashboards live
- [ ] Alerts configured
- [ ] Multisig configured
- [ ] Emergency playbook written
- [ ] Token listing strategy ready

### 6.4 Gate Criteria

- All contracts deployed and verified
- Ownership transferred to Timelock
- Keeper bot tested on testnet
- Monitoring shows all systems green
- Emergency playbook reviewed by team

---

## 7. Phase 5 — Mainnet Launch (1 day)

### 7.1 Launch Sequence

```
T-24h: Final verification
  ├── All contracts verified on Basescan
  ├── Monitoring dashboards green
  ├── Keeper bot funded with ETH
  └── Multisig funded with ETH

T-12h: Pre-launch checks
  ├── Emergency pause tested
  ├── All roles correctly configured
  ├── Treasury funded with USDC
  └── Team on standby

T-0: LAUNCH
  ├── Fund initial treasury (USDC)
  ├── Enable PID controller (start emissions)
  ├── Enable TreasuryAMO buybacks
  ├── Enable staking (open NFT staking)
  └── Verify all systems operational

T+1h: First hour monitoring
  ├── First PID emission confirmed
  ├── First staking entry confirmed
  ├── No unexpected reverts
  └── Gas costs within expected range

T+24h: First day monitoring
  ├── TVL growing
  ├── Au price stable
  ├── Ag emission as expected
  └── All events firing correctly

T+7d: First week monitoring
  ├── First buyback executed
  ├── First governance proposal (if any)
  ├── TVL on track with simulation
  └── No security incidents

T+30d: First month review
  ├── Parameter review (governance proposal if needed)
  ├── Treasury health check
  ├── Security review
  └── Community feedback
```

### 7.2 Launch Day Checklist

- [ ] Treasury funded with USDC
- [ ] PID controller enabled
- [ ] TreasuryAMO enabled
- [ ] Staking open
- [ ] AuToken fees enabled
- [ ] Monitoring active
- [ ] Team on standby
- [ ] Emergency contacts ready

### 7.3 Deliverables

- [ ] Launch transaction hashes
- [ ] Deployment manifest (mainnet.json)
- [ ] First-day monitoring report
- [ ] First-week monitoring report
- [ ] First-month monitoring report

---

## 8. Phase 6 — Post-Launch (Ongoing)

### 8.1 Weekly Reports (First 3 Months)

| Report | Contents | Audience |
|--------|----------|----------|
| TVL & Growth | TVL trajectory, staking participation | Team, Community |
| Token Prices | Au/Ag price, stability metrics | Team, Community |
| Treasury Health | Balance, runway, buyback capacity | Team |
| Security | Events, anomalies, incidents | Team |
| Governance | Proposals, votes, executions | Community |

### 8.2 Monthly Parameter Review

| Parameter | Review Criteria | Action |
|-----------|----------------|--------|
| PID target TVL | TVL on track? | Adjust if off by >20% |
| PID kp/ki | Oscillation? | Tune if needed |
| Buyback % | Treasury healthy? | Adjust if needed |
| Staking rates | APY competitive? | Adjust if needed |
| Max multiplier | Centralization? | Adjust if needed |

### 8.3 Quarterly Security Review

| Review | Scope | Output |
|--------|-------|--------|
| Code review | New changes since audit | Report |
| Access control | Role holders, transfers | Report |
| Economic invariants | All caps, floors, limits | Report |
| Incident review | Any incidents since launch | Report |

---

## 9. Risk Register

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Certora finds critical vulnerability | Medium | High | Phase 1 catches most issues first | Security |
| Testnet shows unexpected behavior | Medium | Medium | 30-day testnet simulation | Dev |
| RealLPNFT delays | Low | High | Start development early | Dev |
| Gas costs higher than simulated | Medium | Medium | Buffer in treasury allocation | Dev |
| Au price decline exceeds 60% | Low | High | Emergency buyback via governance | DAO |
| Oracle-free TVL manipulation | Low | Medium | TWATVL smoothing, 30-day windows | Security |
| Governance attack | Low | Critical | Timelock + multisig + monitoring | Security |
| Audit firm unavailable | Low | Medium | Have backup firm identified | PM |
| Team member loss | Low | High | Documentation, cross-training | PM |

---

## 10. Resource Requirements

### 10.1 Team

| Role | Count | Responsibilities |
|------|-------|-----------------|
| Lead Dev | 1 | Architecture, code review, deployment |
| Solidity Dev | 1 | Contract development, testing |
| Security Engineer | 1 | Verification, audit coordination |
| DevOps | 1 | Infrastructure, monitoring, keeper bot |
| QA | 1 | Testnet simulation, test coverage |
| PM | 1 | Coordination, timeline management |

### 10.2 Infrastructure

| Resource | Purpose | Cost (monthly) |
|----------|---------|---------------|
| Base RPC (Alchemy/Infura) | On-chain access | $100-500 |
| Grafana Cloud | Monitoring | $50-100 |
| PagerDuty | Alerts | $20-50 |
| Server (keeper bot) | Bot operation | $50-100 |
| Gnosis Safe | Multisig | Free |

### 10.3 Budget

| Item | Cost | Notes |
|------|------|-------|
| Certora engagement | $30K-80K | 4-6 weeks |
| External audit (optional) | $50K-150K | 2-4 weeks |
| Infrastructure (6 months) | $1K-3K | RPC, monitoring, server |
| Bug bounty (optional) | $10K-50K | Immunefi |
| **TOTAL** | **$91K-283K** | Range depending on options |

---

## 11. Milestone Summary

| Milestone | Target Date | Criteria | Status |
|-----------|------------|----------|--------|
| Tooling Setup Complete | Week 1 | All tools installed, invariants written | ⬜ |
| Verification Complete | Week 2 | All tools pass, no CRITICAL/HIGH | ⬜ |
| Testnet Deployed | Week 4 | All contracts on Sepolia, verified | ⬜ |
| Testnet Simulation | Week 6 | 30-day bot sim, stable economics | ⬜ |
| Audit Complete | Week 12 | Certora clean, external audit clean | ⬜ |
| Mainnet Deployed | Week 14 | All contracts on Base, verified | ⬜ |
| Mainnet Launched | Week 15 | All systems operational | ⬜ |
| 30-Day Post-Launch | Week 19 | Stable, all metrics nominal | ⬜ |

---

## 12. Decision Gates

### Gate 1: Proceed to Testnet

**Criteria:**
- All CRITICAL/HIGH pentest findings resolved ✅
- SMTChecker passes on all contracts
- Halmos passes on 4 key contracts
- Contender invariants all pass
- RealLPNFT implemented and tested
- 100K Monte Carlo shows stable economics

### Gate 2: Proceed to Audit

**Criteria:**
- Testnet deployed for 2+ weeks
- 30-day bot simulation successful
- No CRITICAL/HIGH testnet issues
- All testnet issues resolved
- Testnet economics match simulation

### Gate 3: Proceed to Mainnet

**Criteria:**
- Certora verification clean
- External audit clean (if engaged)
- All audit findings resolved
- RealLPNFT deployed to mainnet
- Infrastructure ready (keeper, monitoring)
- Emergency playbook written
- Team ready for launch

---

## 13. Contingency Plans

### 13.1 If Certora Finds Critical Issue

1. Pause testnet deployment
2. Fix issue (estimate: 1-5 days)
3. Re-run Certora
4. If fix introduces new issues, iterate
5. Only proceed when clean

### 13.2 If Testnet Shows Instability

1. Identify root cause (parameters? code bug?)
2. If parameters: adjust and re-test
3. If code bug: fix, re-deploy, re-test
4. Extend testnet period if needed
5. Do not proceed to audit until stable

### 13.3 If Au Price Crashes During Launch

1. Emergency pause PID (stop Ag emission)
2. Emergency buyback (use full treasury)
3. Governance proposal: adjust parameters
4. Communicate with community
5. Resume when stabilized

### 13.4 If Audit Firm Unavailable

1. Engage backup firm
2. Extend timeline by 2-4 weeks
3. Increase Certora scope to compensate
4. Consider launching with only Certora (lower risk tolerance)

---

*Document: CRITICAL_PATH.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
