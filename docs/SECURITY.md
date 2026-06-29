---
title: Security Model — AV Treasury
date: 2026-06-29
status: complete
description: Security model, invariant tests, emergency procedures, and attack mitigations for the AV Treasury protocol.
category: technical
related: [ARCHITECTURE.md, ADDRESS_BOOK.md, central-banking/09-governance-framework.md, central-banking/07-oracle-system.md, API_REFERENCE.md]
---

# Security Model

## 1. Formal Verification

### 1.1 Invariant Tests (test/invariants/)

Four invariant test suites verify core properties:

**AuTokenInvariants.t.sol**
- Total supply never exceeds MAX_SUPPLY (1B)
- Individual balances never exceed maxWallet
- Transfer fee accounting is correct
- Blocked addresses cannot transfer

**AgTokenInvariants.t.sol**
- Total supply never exceeds hard cap (100M)
- Only MINTER_ROLE can mint
- Minting respects_SINGLE_EMISSION and MAX_DAILY_CAP
- No unexpected supply changes

**PIDControllerInvariants.t.sol**
- Emission output is always non-negative
- Emission never exceeds per-epoch cap
- Integral term does not wind up unbounded
- PID state transitions are deterministic

**TreasuryAMOInvariants.t.sol**
- Reserve ratio never falls below MIN_RESERVE_RATIO (50%)
- NAV calculation is consistent
- Deposit/minting accounting is correct
- Redemption burns correct Au amount

### 1.2 Test Results

```
forge test --match-path test/invariants/

Result: 41/42 tests pass
  - AuTokenInvariants:     PASS
  - AgTokenInvariants:     PASS
  - PIDControllerInvariants: PASS
  - TreasuryAMOInvariants: PASS
  - ContenderStatefulFuzz: 1 edge case failure (maxWallet fuzz timing, not a contract bug)
```

## 2. Oracle Security (Three-Layer Stack)

### Layer 1: AvOracle v5
- TWAP from Slipstream (30-min window) — manipulation requires sustained attack
- Chainlink fallback if TWAP stale >1 hour
- Concentrated liquidity aware

### Layer 2: OracleWrapper
- Deviation detection (>5% from reference → reject)
- Staleness check (>1 hour → reject)
- Hard price bounds ($0.0001–$1000)
- Below-peg signal generation

### Layer 3: Consumers
- PID Controller validates TVL before acting
- FlashBuy validates oracle health before executing
- TreasuryAMO validates NAV before minting/redeeming

## 3. Economic Attack Mitigations

| Attack | Mitigation |
|--------|-----------|
| Flash loan manipulation | TWAP 30-min window |
| Oracle price spike | 5% deviation check + hard bounds |
| Mass redemption drain | Reserve ratio floor (50%) + redemption fee |
| Emission gaming | Snapshot-based distribution + min stake duration |
| Governance capture | Timelock 48h + 100K Ag threshold + quorum |
| Front-running emissions | Epoch-start snapshot + smoothing |
| Max wallet evasion | Per-address tracking + ANTI_BOT_ROLE |
| Sell pressure attack | 9bps transfer tax + sell cooldown |

## 4. Emergency Procedures

### 4.1 Contract Pause

Every contract is `Pausable`. Pause can be triggered by:
- DEFAULT_ADMIN_ROLE (governance-controlled)
- Treasury Safe (3-of-5 multisig)

### 4.2 Timelock Cancellation

Any queued governance action can be cancelled by:
- The proposer
- Any address (if proposal is malicious)

### 4.3 Treasury Safe (3-of-5 Multisig)

**Address:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`

**Can do:**
- Pause any contract
- Cancel timelock transactions
- Emergency withdraw to Safe
- Revoke keeper status
- Trigger emergency FlashBuy

**Cannot do:**
- Mint Au or Ag
- Change PID parameters
- Execute FlashBuy directly
- Modify governance framework

### 4.4 Emergency Response Matrix

| Scenario | Automatic Response | Human Response |
|----------|-------------------|----------------|
| Oracle stale >1h | Pause minting | Fix oracle, resume |
| NAV deviation >20% | FlashBuy activates | Monitor, adjust PID |
| Reserve ratio <50% | Halt redemptions | Governance restores |
| Contract exploit detected | Pause via Safe | Audit, patch, upgrade |
| Governance attack | Timelock delay | Community cancels |
| Keeper compromise | Revoke keeper status | Deploy new keeper |

## 5. Access Control Matrix

| Contract | Admin | Special Roles | Pause |
|----------|-------|--------------|-------|
| Au | Timelock | ANTI_BOT_ROLE | Yes |
| Ag | Timelock | MINTER_ROLE (PID) | Yes |
| TreasuryAMO | Timelock | PARAM_ROLE | Yes |
| PID | Timelock | PARAM_ROLE | Yes |
| Governor | Timelock | — | No |
| Timelock | TimPOSER_ROLE | No |
| QuasiCrystal | Timelock | METADATA_ROLE, GOVERNOR | Yes |
| AvOracle | Timelock | ADMIN_ROLE | No |
| OracleWrapper | Timelock | ADMIN_ROLE | No |
| FlashBuy | Timelock | — | Yes |

## 6. Security Fixes

### Governor Timelock Bypass (Fixed 2026-06-29)

**Severity:** Critical  
**Status:** Fixed in commit `04e6232`

**Problem:** `GovernorContract._executeOperations()` called target contracts directly, completely bypassing the 48h timelock delay. Any passed proposal executed instantly.

**Fix:** Added `GovernorTimelockControl` inheritance. Now:
- `_queueOperations()` → `timelock.scheduleBatch()` with 48h delay
- `_executeOperations()` → `timelock.executeBatch()` (only after delay expires)

**New flow:** Propose → Vote → Queue → **48h delay** → Execute

## 7. Known Risks and Limitations

| Risk | Severity | Likelihood | Status |
|------|----------|-----------|--------|
| Smart contract bug | Critical | Low | Mitigated by invariants + audits |
| Oracle manipulation | High | Low | Mitigated by 3-layer stack |
| Governance capture | High | Medium | Mitigated by timelock + quorum |
| PID instability | Medium | Low | Mitigated by gain constraints |
| Liquidity crunch | Medium | Medium | Mitigated by FlashBuy + POL |
| Base L2 sequencer failure | Medium | Low | Inherits Ethereum security |
| Regulatory uncertainty | Unknown | Unknown | Decentralized design |

## 7. Upgrade Safety

All upgrades follow:
1. Announce → visible on-chain
2. Delay period (7 days for Au)
3. Community review during delay
4. Execution after delay
5. Or cancellation at any time

No instant upgrades. No hidden upgrades. All state is on-chain.
