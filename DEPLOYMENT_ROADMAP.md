# Deployment Roadmap — AV Treasury Dual-Token DAO

> **Last Updated:** 2026-06-25  
> **Version:** 4.0 (post-v4 simulation)  
> **Current Phase:** Phase 2 → Phase 3

---

## Phase 1: Research & Design ✅ COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| Tokenomics design | ✅ | `docs/technical/TOKENOMICS.md` v1.1.0 |
| Contract architecture | ✅ | 15 contracts in `contracts/av_suite/` |
| Whitepaper | ✅ | `docs/whitepaper/whitepaper.md` |
| Economic model | ✅ | `docs/sandbox/ECONOMIC_MODEL.md` |
| PID controller design | ✅ | `contracts/av_suite/PID_Emission_Controller_v2.sol` |

---

## Phase 2: Simulation & Validation ✅ COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| v3.1 Hermes simulation (36mo Monte Carlo) | ✅ | Prior simulation_report.md |
| v4 constant-product simulation (100r × 100 bots) | ✅ | 507 trades, 0.5% errors |
| Price stability validation | ✅ | CV 0.134%, drift -0.68% |
| Flash buyback testing | ✅ | 10 events triggered, low impact confirmed |
| Error rate validation | ✅ | 1388 → 5 (99.6% reduction) |
| Charts & analysis | ✅ | 8 charts in `sandbox/reports/` |
| Analyst report | ✅ | `docs/reports/analyst_report.md` Section 7 |

---

## Phase 3: Testnet Preparation 🔵 IN PROGRESS

| Task | Status | Depends On |
|------|--------|------------|
| LP NFT architecture decision | ❌ Pending | Team decision |
| Real AMM integration (Aerodrome) | ❌ Pending | LP NFT decision |
| Oracle integration (Chainlink) | ❌ Pending | AMM integration |
| Flash buyback sizing fix | ❌ Pending | AMM integration |
| MockLPNFT → real NFT implementation | ❌ Pending | LP NFT decision |
| Unit test suite (Foundry) | ❌ Pending | — |
| Testnet deployment | ❌ Pending | All above |

---

## Phase 4: Security Audit ⏳ NOT STARTED

| Task | Status | Depends On |
|------|--------|------------|
| Audit firm selection | ❌ | Testnet readiness |
| Formal verification (optional) | ❌ | Audit firm recommendation |
| Remediation | ❌ | Audit findings |

---

## Phase 5: Mainnet Launch ⏳ NOT STARTED

| Task | Status | Depends On |
|------|--------|------------|
| Mainnet deployment | ❌ | Audit + testnet validation |
| Initial liquidity bootstrapping | ❌ | Deployment |
| Governance activation | ❌ | Deployment |
| Community distribution | ❌ | Governance |

---

## Critical Path

```
LP NFT Decision ──► Staking Bootstrap ──► PID Activation ──► AMM Integration ──► Audit ──► Testnet ──► Mainnet
     ↑                                                                              ↑
     └── Currently blocked here                                              ~8-10 weeks after unblock
```

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| PID never activates | System has no differentiator | Bootstrap TVL with protocol-owned liquidity |
| Flash buybacks too small | No buyback pressure on price | Increase size 10x or reduce pool depth |
| LP NFT decision delayed | Blocks entire Phase 3 | Need team decision ASAP |
| Audit finds critical issues | Delays mainnet | Run fuzzing before audit |

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Research & Design | 4 weeks | ✅ Complete |
| Phase 2: Simulation & Validation | 2 weeks | ✅ Complete |
| Phase 3: Testnet Preparation | 3-4 weeks | 🔵 In progress (blocked on NFT decision) |
| Phase 4: Security Audit | 3-4 weeks | ⏳ Not started |
| Phase 5: Mainnet Launch | 1-2 weeks | ⏳ Not started |
| **Total remaining** | **~7-10 weeks** | — |
