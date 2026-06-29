---
title: System Architecture — AV Treasury
date: 2026-06-29
status: complete
description: Complete system architecture — contract hierarchy, data flow, upgrade mechanisms, and Layer 2 deployment on Base.
category: technical
related: [API_REFERENCE.md, TOKENOMICS.md, ADDRESS_BOOK.md, GETTING_STARTED.md, SECURITY.md]
---

# System Architecture

## 1. Deployment

All contracts are deployed on **Base** (Coinbase L2, chainId 8453).
Base provides low gas costs, EVM equivalence, and Ethereum security.

## 2. Contract Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        GOVERNANCE LAYER                         │
│  GovernorContract (0x259c...6385)                               │
│  ArtifactTimelock (0x6623...4714)                               │
│  Treasury Safe (0x1082...9F9e) — 3-of-5 multisig                │
└────────────────────────────┬────────────────────────────────────┘
                             │ governance + timelock
�────────────────────────────▼────────────────────────────────────┐
│                      CORE PROTOCOL LAYER                        │
│                                                                  │
│  ┌─────────────�  �──────────────┐  ┌───────────────────�      │
│  │   Au Token   │  │   Ag Token   │  │  PID Controller   │      │
│  │ 0x0c5A...   │  │ 0x1D31...    │  │ 0x9911...7f70     │      │
│  │ Utility     │  │ Governance   │  │ Emission Engine   │      │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘      │
│         │                │                    │                  │
│  ┌──────▼────────────────▼────────────────────▼──────────┐      │
│  │               QuasiCrystal LP NFT                      │      │
│  │               0xfd04...47CD                            │      │
│  │               Staking + Rewards                        │      │
│  └────────────────────────┬───────────────────────────────�      │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────┐      │
│  │               TreasuryAMO                               │      │
│  │               0x5665...5188                             │      │
│  │               Reserve Management + LP                   │      │
│  └────────────────────────┬───────────────────────────────┘      │
│                           │                                      │
│  �────────────────────────▼───────────────────────────────┐      │
│  │               TreasuryFlashBuy v2                       │      │
│  │               0xf638...e65b                             │      │
│  │               Buyback Engine                            │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
�────────────────────────────▼────────────────────────────────────┐
│                        ORACLE LAYER                             │
│  AvOracle v5 (0xfd04...47CD) — TWAP + Chainlink                │
│  OracleWrapper (0xb479...32bdB) — Deviation + Staleness         │
│  OracleFlashBuy — Buyback-specific price reads                  │
│  OracleGuardian — Emergency price override                      │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Data Flow

### 3.1 Deposit Flow
```
User → TreasuryAMO.deposit()
  → Collateral held in TreasuryAMO
  → Au minted at reserve ratio (60%)
  → Excess collateral held as reserve
```

### 3.2 Emission Flow
```
PID Controller.executeEmission()
  → Computes E(t) from Kp, Ki, Kd
  → Mints Ag (if under daily cap)
  → Distributes to QuasiCrystal LP NFT stakers, direct stakers, TreasuryAMO
```

### 3.3 Staking Flow
```
User → Slipstream LP tokens → QuasiCrystalLPNFT.mint()
  → NFT encodes position + lock + multiplier
  → Earns Ag emissions per epoch
  → veAg boosts effective APY up to 2.5×
```

### 3.4 Governance Flow
```
Proposal → GovernorContract.propose()
  → 1 day delay → 3 day voting → quorum check
  → Queued in Timelock (48 hours)
  → Executed
```

### 3.5 Buyback Flow
```
Au price < NAV × 0.98
  → OracleWrapper signals below-peg
  → FlashBuy.executeBuyback()
  → USDC from TreasuryAMO → Au from market
  → 50% burned, 30% treasury, 20% stakers
```

## 4. Upgrade Mechanism

All contracts support **announced upgrades** with delay:

1. `announceUpgrade(newImplementation)` — starts timer
2. Wait period (7 days for Au, varies by contract)
3. Anyone can execute after delay
4. `cancelUpgrade()` can cancel anytime

Governor + Timelock controls protocol-level upgrades.

## 5. Access Control

| Role | Contracts | Capability |
|------|-----------|------------|
| DEFAULT_ADMIN_ROLE | All | Pause, admin changes |
| PARAM_ROLE | TreasuryAMO, PID | Parameter adjustment |
| METADATA_ROLE | QuasiCrystal LP NFT | TVL updates, render params |
| MINTER_ROLE | Ag Token | Mint (PID only) |
| ANTI_BOT_ROLE | Au Token | Block addresses |
| GOVERNOR | QuasiCrystal LP NFT | Pause/unpause |
| Treasury Safe (3-of-5) | All (via admin) | Emergency actions |

## 6. External Dependencies

| Dependency | Usage |
|-----------|-------|
| Slipstream (Base) | Concentrated liquidity AMM |
| Chainlink | Oracle fallback price feeds |
| OpenZeppelin | ERC20, ERC721, Governor, AccessControl |

## 7. Key Design Decisions

1. **No proxy pattern** — each contract is standalone with announced upgrade
2. **No cross-contract calls in critical paths** — prevents cascading failures
3. **All state changes emit events** — full auditability
4. **Pausable everywhere** — emergency stop on every contract
5. **No upgradeable storage** — clean contract boundaries
