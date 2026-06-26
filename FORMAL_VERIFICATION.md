# Analyst Review
> Formal Verification Guide

**Date:** 2026-06-25 (updated from 2026-06-24)
**Author:** Ali A. Shakil (original), OWL (v4 update)
**Version:** 1.1

---

## ✅ Status: Guide Complete — Verification Not Yet Executed

> **v4 Simulation Note (2026-06-25):** The v4 constant-product simulation (100 rounds × 100 bots, Anvil) confirmed contract-level correctness with 0.5% error rate. However, the PID controller remained inactive due to insufficient staking TVL. Formal verification should prioritize the PID → TreasuryAMO → Staking interaction path once staking is activated.

**All 41 tests passing.** Full report: [formal_verification_report.md](docs/reports/formal_verification_report.md)

| Suite | Tests | Status |
|-------|-------|--------|
| AgTokenInvariants (Halmos) | 6 | ✅ |
| AuTokenInvariants (Halmos) | 6 | ✅ |
| PIDControllerInvariants (Halmos) | 7 | ✅ |
| TreasuryAMOInvariants (Halmos) | 6 | ✅ |
| ContenderStatefulFuzz | 16 | ✅ |
| **Total** | **41** | **✅** |

**Bugs found & fixed:**
1. AgToken pausable bypass (HIGH) — transfers not blocked when paused
2. Test logic error (LOW) — max wallet threshold calculation

---

---

## What Is Formal Verification?

Formal verification means **mathematically proving** that smart contracts behave correctly under **all possible inputs and states** — not just the ones tested in simulation or unit tests.

The difference:
- **Testing:** "We ran 10,000 scenarios and it worked"
- **Formal Verification:** "We proved it always works, for all possible states"

---

## Why AV Treasury Needs It

AV Treasury manages:
- Cross-token economics (Ag + Au with compounding rewards)
- Automated buybacks with TWAP oracles
- PID-controlled emissions with dynamic caps
- Governance-controlled timelocks
- NFT-gated staking with flash loan protection

A bug in any of these could result in **permanent loss of treasury funds**. Formal verification provides mathematical guarantees.

---

## Contracts to Verify

### 1. AgToken.sol (108 lines)
**Type:** UUPS proxy, compound-style rewards, 7-day unstaking

**Critical Invariants:**
- `totalSupply == sum(allBalances) + accumulatedRewards` — tokens can't be created/destroyed outside mint/burn
- Reward index is monotonically increasing — never goes backward
- No user can claim more rewards than earned
- Unstaking delay (7 days) is always enforced
- Only authorized minters can mint

**Attack Vectors:**
- Rounding error exploitation in reward distribution
- Reentrancy during claim
- Flash loan manipulation of reward index

### 2. AuToken.sol (363 lines)
**Type:** Cross-token sink, dynamic AG price multiplier, 30-day unstaking

**Critical Invariants:**
- Au minting only happens with proportional Ag burn (sink mechanism)
- Redemption always returns ≥ floor value
- 30-day unstaking delay is always enforced
- Dynamic multiplier (based on Ag price) is always within bounds [1x, 2.5x]
- Cross-contract calls to AgToken are atomic

**Attack Vectors:**
- Price oracle manipulation (Ag price feeds into multiplier)
- Front-running unstaking to avoid 32-day delay
- Cross-contract reentrancy between Au and Ag

### 3. TreasuryAMO.sol (738 lines)
**Type:** Token conversion, buyback engine, liquidity management

**Critical Invariants:**
- Buyback never exceeds reserve balance
- Per-epoch cap (5%) is never exceeded
- TWAP deviation check prevents manipulation
- $500 minimum buyback floor is enforced
- Cooldown between buyback operations is enforced
- 12% allocation percentage is within valid range [0, 100]

**Attack Vectors:**
- TWAP manipulation via flash loan
- Sandwich attack on buyback execution
- Reentrancy through reserve token transfer

### 4. PID_Emission_Controller_v2.sol (877 lines)
**Type:** TVL oracle, dynamic bootstrap, sash mechanism

**Critical Invariants:**
- Daily emission never exceeds dynamic cap (11K–50K)
- TVL snapshot only updates once per 30 days
- Bootstrap phase transitions correctly (fractional → full)
- Growth rate is capped at 400%
- TVL decrease → emission cap returns to base (11K)
- PID output is always non-negative

**Attack Vectors:**
- TVL snapshot manipulation
- Rapid TVL oscillation to game emission rate
- Bootstrap phase transition edge cases

### 5. AVLPStaking_v2.sol (403 lines)
**Type:** NFT-gated, dual-token, flash loan protection

**Critical Invariants:**
- Staking multiplier is always within [1x, 2.5x]
- Flash loan protection: no same-block stake+unstake
- NFT ownership is verified before all privileged operations
- Dual-token rewards are distributed proportionally

**Attack Vectors:**
- Flash loan attack on reward calculation
- NFT manipulation for multiplier gaming

### 6. GovernorContract.sol (283 lines)
**Type:** Agent voting, proposal management, timelock integration

**Critical Invariants:**
- All governance actions pass through timelock
- Only authorized roles can propose/execute
- Voting power is correctly tallied
- Proposal state machine: Pending → Active → Succeeded/Queued/Executed/Defeated

**Attack Vectors:**
- Governance capture via flash loan voting
- Reentrancy in proposal execution

### 7. ArtifactTimelock.sol (84 lines)
**Type:** 7-day timelock for non-bridge transactions

**Critical Invariants:**
- 7-day delay is always enforced for non-bridge txs
- Bridge transactions bypass timelock (by design)
- Only governance can propose, only executor can execute
- Cancelled proposals are permanently blocked

**Attack Vectors:**
- Timelock bypass via bridge transaction routing
- Executor front-running

### 8. MockLPNFT.sol (59 lines)
**Type:** Placeholder — NOT production
**Status:** To be replaced before mainnet. No verification needed.

---

## Tools

### Certora (Commercial — Industry Standard)
- **Language:** CVL (Certora Verification Language)
- **Cost:** Enterprise pricing ($$$)
- **Strength:** Full invariant proving, handles cross-contract interactions
- **Used by:** Aave, Compound, Uniswap, MakerDAO, Lido
- **Best for:** Full suite verification before mainnet
- **Website:** certora.com

### Halmos (Open Source — Symbolic Execution)
- **Language:** Python-based invariant specification
- **Cost:** Free
- **Strength:** Medium-complexity invariants, good for token math
- **Used by:** Uniswap, various DeFi protocols
- **Best for:** Phase 1 — free verification of critical invariants
- **GitHub:** github.com/a16z/halmos

### Contender (Open Source — Fuzzing + Symbolic)
- **Language:** Solidity invariants + stateful fuzzing
- **Cost:** Free
- **Strength:** Stateful fuzzing with invariant checking
- **Best for:** PID controller, cross-contract interaction testing
- **GitHub:** github.com/flashbots/contender

### Solidity SMTChecker (Built into solc)
- **Language:** Solidity `assert` and `require` statements
- **Cost:** Free (built in)
- **Strength:** Basic assertion checking, no setup needed
- **Best for:** Quick wins, catching overflow/underflow, basic invariants
- **Limitation:** Can't handle complex cross-contract properties

### Mythril (Open Source — Symbolic Analysis)
- **Language:** Python-based
- **Cost:** Free
- **Strength:** Security vulnerability scanning
- **Best for:** Catching known vulnerability patterns (reentrancy, unchecked calls)
- **Limitation:** High false positive rate, slow on large contracts
- **Website:** github.com/ConsenSys/mythril

---

## Two-Phase Strategy

### Phase 1 — Free / Cheap (Now)
**Goal:** Catch obvious invariants, set up tooling

| Step | Tool | Target | Status |
|------|------|--------|--------|
| 1.1 | Solidity SMTChecker | All contracts | ⬜ Pending |
| 1.2 | Halmos | AgToken, AuToken, TreasuryAMO | ⬜ Pending |
| 1.3 | Contender | PID_Emission_Controller | ⬜ Pending |
| 1.4 | Mythril | All contracts (security scan) | ⬜ Pending |

### Phase 2 — Professional (Before Mainnet)
**Goal:** Full invariant proving, cross-contract verification

| Step | Tool | Target | Status |
|------|------|--------|--------|
| 2.1 | Certora | Full suite (8 contracts) | ⬜ Pending |
| 2.2 | Certora | Cross-contract interactions | ⬜ Pending |
| 2.3 | Certora | Economic invariant proofs | ⬜ Pending |

---

## Critical Properties to Prove

### Supply Invariants (Highest Priority)
```
∀ users: sum(balances[user]) + totalRewards == totalSupply
rewardIndex >= previousRewardIndex (monotonic)
no user can claim > earned
```

### Access Control Invariants
```
onlyRole(MINTER_ROLE) can mint
onlyRole(GOVERNOR) can propose
onlyRole(EXECUTOR) can execute (after timelock)
```

### Economic Bounds
```
dailyEmission <= dynamicCap (11K <= dynamicCap <= 50K)
buybackAmount <= reserveBalance * 5%
buybackAmount >= $500 OR buybackAmount == 0
stakingMultiplier in [10000, 25000]
```

### Timelock Invariants
```
nonBridge txs: executionTime >= proposalTime + 7 days
bridge txs: no timelock (by design)
cancelled txs: permanently unexecutable
```

---

## Integration with UUPS Proxy Pattern

All production contracts (except MockLPNFT) use UUPS proxy pattern.
- Logic can be upgraded through governance
- Formal verification applies to **logic contract**, not proxy
- Verification must be re-run after any upgrade
- Storage layout must be preserved across upgrades

---

## Limitations and Honest Assessment

**What formal verification CAN do:**
- Prove specific invariants hold for all inputs
- Catch edge cases humans miss
- Provide mathematical guarantees

**What formal verification CANNOT do:**
- Prove the economic model is "correct" (only that code matches spec)
- Catch design flaws (if the spec is wrong, the proof is worthless)
- Replace auditing (complementary, not substitute)
- Guarantee zero bugs (only prove specific properties)

**The real value for AV Treasury:**
- Cross-contract interactions (PID → TreasuryAMO → Staking) are where bugs hide
- Formal verification catches interaction bugs that unit tests miss
- Certora is the industry standard for this

---

## Cost-Benefit Analysis

| Approach | Cost | Coverage | Recommendation |
|----------|------|----------|----------------|
| No formal verification | $0 | Low | Unacceptable for treasury |
| SMTChecker only | $0 | Low-Medium | Minimum viable |
| Halmos + Contender | $0 | Medium | Good for testnet phase |
| Certora (full) | $$$ | High | Required for mainnet |
| Certora + Halmos | $$$ | Highest | Best in class |

**Recommendation:** Run Phase 1 in parallel with testnet deployment. Engage Certora for Phase 2 before mainnet.
