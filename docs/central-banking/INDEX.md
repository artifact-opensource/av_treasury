---
title: Central Banking Protocol — Index
date: 2026-06-29
status: in-progress
description: Canonical breakdown of the AV Treasury central banking system. Each document covers one policy pillar, mechanism, or mathematical proof.
category: central-banking
related: [whitepaper/whitepaper.md, whitepaper/vision.md, reports/formal_verification.md]
---

# Central Banking Protocol — Document Index

## Thesis

AV Treasury is a decentralized central banking protocol. It performs the three
canonical functions of a central bank — currency issuance, monetary policy, and
lender of last resort — through autonomous on-chain contracts. This directory
breaks down each function into its constituent mechanisms, policies, and
mathematical foundations.

## Document Count

18 documents across 7 categories (I–VII).

### I. Foundational Framework
| # | Document | Title | Status |
|---|----------|-------|--------|
| 01 | [01-dual-token-architecture.md](01-dual-token-architecture.md) | Dual-Token Architecture (Au/Ag) | draft |
| 02 | [02-monetary-policy-engine.md](02-monetary-policy-engine.md) | PID Monetary Policy Engine | draft |
| 03 | [03-emission-mechanics.md](03-emission-mechanics.md) | Ag Emission Mechanics & Distribution | draft |

### II. Reserve & Treasury Operations
| # | Document | Title | Status |
|---|----------|-------|--------|
| 04 | [04-treasury-amo.md](04-treasury-amo.md) | TreasuryAMO — Reserve Management | draft |
| 05 | [05-flywheel-mechanics.md](05-flywheel-mechanics.md) | Economic Flywheel — Self-Reinforcing Cycle | draft |
| 06 | [06-liquidity-provisioning.md](06-liquidity-provisioning.md) | Liquidity Provisioning via Slipstream | draft |

### III. Price Stability & Oracle Infrastructure
| # | Document | Title | Status |
|---|----------|-------|--------|
| 07 | [07-oracle-system.md](07-oracle-system.md) | AvOracle v5 & OracleWrapper — Price Infrastructure | draft |
| 08 | [08-flashbuy-mechanism.md](08-flashbuy-mechanism.md) | FlashBuy — Treasury Buyback Mechanism | draft |

### IV. Governance & Sovereignty
| # | Document | Title | Status |
|---|----------|-------|--------|
| 09 | [09-governance-framework.md](09-governance-framework.md) | Governance Framework (Governor + Timelock) | draft |
| 10 | [10-quasicrystal-nft.md](10-quasicrystal-nft.md) | QuasiCrystal LP NFT — Staking & Multipliers | draft |

### V. Mathematical & Academic Validation
| # | Document | Title | Status |
|---|----------|-------|--------|
| 11 | [11-pid-mathematics.md](11-pid-mathematics.md) | PID Controller — Mathematical Specification | draft |
| 12 | [12-stability-analysis.md](12-stability-analysis.md) | Stability Analysis & Convergence Proofs | draft |
| 13 | [13-simulation-framework.md](13-simulation-framework.md) | Long-Term Simulation Framework (50/500/5000 yr) | draft |

### VI. Central Banking Thesis
| # | Document | Title | Status |
|---|----------|-------|--------|
| 14 | [14-central-banking-thesis.md](14-central-banking-thesis.md) | Central Banking Thesis — Full Argument | draft |
| 15 | [15-comparison-traditional.md](15-comparison-traditional.md) | Comparison with Traditional Central Banking | draft |

### VII. Phase 4 — DAE & Autonomous Operations
| # | Document | Title | Status |
|---|----------|-------|--------|
| 16 | [16-dae-architecture.md](16-dae-architecture.md) | DAE Architecture — From DAO to Enterprise | draft |
| 17 | [17-sub-dao-pilots.md](17-sub-dao-pilots.md) | Sub-DAO Pilots — MPC, TRO, LQO | draft |
| 18 | [18-autonomy-roadmap.md](18-autonomy-roadmap.md) | Path to Total Autonomy — Roadmap & Milestones | draft |

## Reading Paths

**For economists / auditors:** 14 → 01 → 02 → 11 → 12 → 13
**For developers:** 01 → 04 → 07 → 09 → 10
**For token holders:** 01 → 03 → 05 → 09
**For security researchers:** 07 → 08 → 04 → reports/formal_verification.md

## Nomenclature

| Term | Definition |
|------|-----------|
| Au | Artifact Utility — reserve-backed token (fixed supply, 9bps tax) |
| Ag | Artifact Governance — emission/reward token (elastic supply, PID-minted) |
| PID | Proportional-Integral-Derivative controller — monetary policy engine |
| AMO | Algorithmic Market Operations — autonomous reserve management |
| TWAP | Time-Weighted Average Price — manipulation-resistant oracle output |
| QuasiCrystal | QuasiCrystalLPNFT — LP staking NFT with veAg-weighted multipliers |
| Governor | DAO governance contract — Ag-weighted voting |
| Timelock | 48-hour delayed execution — security layer for governance |

## Relationship to Other Documentation

- **Whitepaper** (`whitepaper/whitepaper.md`) — comprehensive single-document overview
- **Vision** (`whitepaper/vision.md`) — central banking argument and institutional framing
- **Formal Verification** (`reports/formal_verification.md`) — Halmos symbolic execution proofs
- **Simulator** (`sim/`) — Python-based long-term economic simulation
