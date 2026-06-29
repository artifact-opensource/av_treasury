---
title: 01 — Dual-Token Architecture (Au/Ag)
date: 2026-06-29
status: draft
description: Specification of the two-token system — Artifact Utility (Au) and Artifact Governance (Ag) — including economic roles, supply mechanics, and their complementary functions.
category: central-banking
related: [02-monetary-policy-engine.md, 03-emission-mechanics.md, 05-flywheel-mechanics.md, INDEX.md]
---

# 01 — Dual-Token Architecture (Au/Ag)

## 1.1 Design Rationale

The AV Treasury employs a **dual-token model** to separate two functions that
are typically conflated in cryptocurrency systems:

1. **Currency / Medium of Exchange** — Au (Artifact Utility)
2. **Governance / Sovereignty** — Ag (Artifact Governance)

This separation mirrors the separation between a nation's currency (fiat) and
its government bonds (sovereign debt). Au serves as the transactional unit of
account within the ecosystem. Ag represents ownership of the protocol's
monetary policy decisions.

## 1.2 Au — Artifact Utility

| Property | Value |
|---|---|
| Name | Au Token |
| Symbol | Au |
| Decimals | 18 |
| Max Supply | 1,000,000,000 (1B) |
| Transfer Tax | 9 bps (0.09%) — 50% burned, 50% to TreasuryAMO |
| Minting | Deposit-based (ETH / stablecoins) |
| Redeemable | Yes — via TreasuryAMO |
| Permit | EIP-2612 (gasless approvals) |
| Contract | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` |

### 1.2.1 Economic Role

Au is the **reserve-backed currency** of the AV ecosystem. Every Au in
circulation is backed by assets held in TreasuryAMO. The 9bps transfer tax
creates deflationary pressure (half burned) while simultaneously funding
treasury operations (half to TreasuryAMO).

### 1.2.2 Minting Mechanism

Au is minted when users deposit collateral (ETH or stablecoins) into the
TreasuryAMO. The minting ratio is determined by the governance-controlled
reserve ratio (currently 60%).

```
Au_minted = (deposit_value_USD × reserve_ratio) / Au_price_USD
```

### 1.2.3 Transfer Tax

Every Au transfer incurs a 9 basis point tax:
- **4.5 bps burned** — permanent supply reduction
- **4.5 bps to TreasuryAMO** — protocol revenue

This tax does NOT apply to minting, redemption, staking, unstaking, or
governance operations.

## 1.3 Ag — Artifact Governance

| Property | Value |
|---|---|
| Name | Ag Token |
| Symbol | Ag |
| Decimals | 18 |
| Max Supply | 100,000,000 (100M) |
| Transfer Tax | None |
| Minting | PID-governed emissions |
| Distribution | Staking rewards, LP incentives |
| Governor | Compatibility Bravo standard |
| Contract | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` |

### 1.3.1 Economic Role

Ag is the **governance and reward token**. It is minted exclusively by the PID
Controller and distributed to participants who provide value to the protocol
(stakers, LP providers). Ag holders govern monetary policy parameters through
the Governor contract.

### 1.3.2 Minting Mechanism

Ag is NOT mintable by any external party. The PID Controller is the sole minter.
Emission rate is computed dynamically based on the gap between target TVL and
actual TVL (see [02-monetary-policy-engine.md](02-monetary-policy-engine.md)).

### 1.3.3 veAg — Time-Weighted Governance

Users can lock Ag to receive **veAg** (vested escrow Ag), which provides:
- **Multiplied voting power** — longer locks = higher voting weight
- **Proportional reward share** — veAg holders receive larger share of emissions
- **Governance commitment** — signals long-term alignment

```
veAg_weight = Ag_locked × (lock_duration / max_lock_duration)

Where:
  max_lock_duration = 4 years (1,461 days)
  min_lock_duration = 1 week (7 days)
```

## 1.4 Token Interaction Model

```
                    ┌─────────────────�
                    │   Ecosystem     │
                    │   (need Au)     │
                    └────────┬────────�
                             │ deposit collateral
                             ▼
                    ┌─────────────────┐
                    │  TreasuryAMO    │
                    │  (reserves)     │
                    └────�───────┬────┘
                         │       │
              mints Au   │       │ 9bps tax (half to treasury)
                         ▼       ▼
                  ┌──────────┐  ┌──────────────�
                  │ Au Token │  │   PID        │
                  │(circulates)│  │ (monetary   │
                  └────┬─────�  │  policy)    │
                       │        └──────�───────�
           staking     │               │ mints Ag
           rewards     ▼               ▼
                  ┌──────────┐  ┌──────────────�
                  │QuasiCrystal│ │  Ag Token   │
                  │  LP NFT   │  │ (governance)│
                  └──────────┘  └──────────────┘
```

## 1.5 Comparison with Traditional Central Banking

| Function | Traditional Central Bank | AV Treasury |
|----------|-------------------------|-------------|
| Currency Issuance | Central bank mints fiat | TreasuryAMO mints Au against reserves |
| Monetary Policy | Interest rate targeting | PID-controlled Ag emissions |
| Reserve Management | Gold / FX reserves | ETH / stablecoin reserves |
| Governance | Central bank board | Ag-weighted DAO vote |
| Transparency | Quarterly reports | Real-time on-chain |
| Lender of Last Resort | Discount window | FlashBuy buyback mechanism |

## 1.6 Key Invariants

1. **Au supply ≤ 1B** — hard cap enforced in contract
2. **Ag supply ≤ 100M** — hard cap enforced in contract
3. **Only PID can mint Ag** — soleMinter role
4. **Au is always over-collateralized** — reserve ratio ≥ 60%
5. **Transfer tax is fixed at 9bps** — governance can only reduce, not increase
