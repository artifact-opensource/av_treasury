---
title: AV Treasury Documentation — Master Index
date: 2026-06-29
status: in-progress
description: Canonical index for all AV Treasury protocol documentation. Every document, categorized and cross-referenced.
category: index
related: [central-banking/INDEX.md, whitepaper/whitepaper.md, ADDRESS_BOOK.md]
---

# AV Treasury — Documentation Master Index

> AV Treasury is a decentralized central banking protocol on Base. It performs
> currency issuance, monetary policy, and lender-of-last-resort functions through
> autonomous on-chain contracts. This index covers every document in the repository.

## Quick Links

| What | Document |
|------|----------|
| 🚀 First time? | [GETTING_STARTED.md](GETTING_STARTED.md) |
| 🏗️ System design | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 📡 Contract API | [API_REFERENCE.md](API_REFERENCE.md) |
| 💰 Token economics | [TOKENOMICS.md](TOKENOMICS.md) |
| 🔒 Security model | [SECURITY.md](SECURITY.md) |
| 📋 Contract addresses | [ADDRESS_BOOK.md](ADDRESS_BOOK.md) |
| 👤 User walkthrough | [USER_GUIDE.md](USER_GUIDE.md) |
| 🚢 Deployment guide | [DEPLOYMENT_WALKTHROUGH.md](DEPLOYMENT_WALKTHROUGH.md) |

---

## I. Foundational & Overview

| Document | Description | Status |
|----------|-------------|--------|
| [README.md](README.md) | Project overview, repository structure, quick links | complete |
| [WORKSPACE.md](WORKSPACE.md) | Workspace layout, toolchain, developer environment | complete |
| [ADDRESS_BOOK.md](ADDRESS_BOOK.md) | Canonical on-chain contract addresses (Base mainnet) | complete |
| [dapp-technical-brief.md](dapp-technical-brief.md) | DApp frontend technical specification | complete |

## II. Getting Started & User Docs

| Document | Description | Status |
|----------|-------------|--------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | How to interact with the protocol (deposit, stake, vote, claim) | draft |
| [USER_GUIDE.md](USER_GUIDE.md) | End-user walkthrough with screenshots and examples | draft |
| [DEPLOYMENT_WALKTHROUGH.md](DEPLOYMENT_WALKTHROUGH.md) | Step-by-step deployment and verification guide | draft |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment procedures, networks, configuration | draft |
| [ETHERSCAN_V2_VERIFICATION.md](ETHERSCAN_V2_VERIFICATION.md) | Etherscan V2 contract verification on Base | complete |

## III. Architecture & Technical

| Document | Description | Status |
|----------|-------------|--------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture overview with ASCII diagram | draft |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete contract API reference (functions, events, errors) | draft |
| [TOKENOMICS.md](TOKENOMICS.md) | Token economics for Au (reserve-backed) and Ag (governance/emission) | draft |
| [SECURITY.md](SECURITY.md) | Security model, access controls, emergency procedures | draft |

## IV. Central Banking Protocol

> Full deep-dive into the central banking thesis — 18 documents across 7 pillars.
> See [central-banking/INDEX.md](central-banking/INDEX.md) for the canonical index.

| # | Document | Title | Status |
|---|----------|-------|--------|
| — | [central-banking/INDEX.md](central-banking/INDEX.md) | Central Banking Index & Reading Paths | in-progress |
| 01 | [central-banking/01-dual-token-architecture.md](central-banking/01-dual-token-architecture.md) | Dual-Token Architecture (Au/Ag) | draft |
| 02 | [central-banking/02-monetary-policy-engine.md](central-banking/02-monetary-policy-engine.md) | PID Monetary Policy Engine | draft |
| 03 | [central-banking/03-emission-mechanics.md](central-banking/03-emission-mechanics.md) | Ag Emission Mechanics & Distribution | draft |
| 04 | [central-banking/04-treasury-amo.md](central-banking/04-treasury-amo.md) | TreasuryAMO — Reserve Management | draft |
| 05 | [central-banking/05-flywheel-mechanics.md](central-banking/05-flywheel-mechanics.md) | Economic Flywheel — Self-Reinforcing Cycle | draft |
| 06 | [central-banking/06-liquidity-provisioning.md](central-banking/06-liquidity-provisioning.md) | Liquidity Provisioning via Slipstream | draft |
| 07 | [central-banking/07-oracle-system.md](central-banking/07-oracle-system.md) | AvOracle v5 & OracleWrapper — Price Infrastructure | draft |
| 08 | [central-banking/08-flashbuy-mechanism.md](central-banking/08-flashbuy-mechanism.md) | FlashBuy — Treasury Buyback Mechanism | draft |
| 09 | [central-banking/09-governance-framework.md](central-banking/09-governance-framework.md) | Governance Framework (Governor + Timelock) | draft |
| 10 | [central-banking/10-quasicrystal-nft.md](central-banking/10-quasicrystal-nft.md) | QuasiCrystal LP NFT — Staking & Multipliers | draft |
| 11 | [central-banking/11-pid-mathematics.md](central-banking/11-pid-mathematics.md) | PID Controller — Mathematical Specification | draft |
| 12 | [central-banking/12-stability-analysis.md](central-banking/12-stability-analysis.md) | Stability Analysis & Convergence Proofs | draft |
| 13 | [central-banking/13-simulation-framework.md](central-banking/13-simulation-framework.md) | Long-Term Simulation Framework (50/500/5000 yr) | draft |
| 14 | [central-banking/14-central-banking-thesis.md](central-banking/14-central-banking-thesis.md) | Central Banking Thesis — Full Argument | draft |
| 15 | [central-banking/15-comparison-traditional.md](central-banking/15-comparison-traditional.md) | Comparison with Traditional Central Banking | draft |
| 16 | [central-banking/16-dae-architecture.md](central-banking/16-dae-architecture.md) | DAE Architecture — From DAO to Enterprise | draft |
| 17 | [central-banking/17-sub-dao-pilots.md](central-banking/17-sub-dao-pilots.md) | Sub-DAO Pilots — MPC, TRO, LQO | draft |
| 18 | [central-banking/18-autonomy-roadmap.md](central-banking/18-autonomy-roadmap.md) | Path to Total Autonomy — Roadmap & Milestones | draft |

## V. Whitepaper

| Document | Description | Status |
|----------|-------------|--------|
| [whitepaper/whitepaper.md](whitepaper/whitepaper.md) | Comprehensive single-document protocol specification | complete |
| [whitepaper/vision.md](whitepaper/vision.md) | Central banking argument and institutional framing | complete |

## VI. Reports & Audits

| Document | Description | Status |
|----------|-------------|--------|
| [reports/analyst_report.md](reports/analyst_report.md) | Independent analyst assessment | complete |
| [reports/formal_verification_report.md](reports/formal_verification_report.md) | Halmos symbolic execution verification | complete |
| [reports/pentest_report.md](reports/pentest_report.md) | Penetration testing report | complete |
| [reports/RESEARCH_LOG.md](reports/RESEARCH_LOG.md) | Research log and methodology notes | complete |
| [reports/simulation_report.md](reports/simulation_report.md) | Economic simulation results | complete |
| [reports/v3_REPORT.md](reports/v3_REPORT.md) | V3 protocol audit and migration report | complete |

---

## VII. Simulation

| Document | Description | Status |
|----------|-------------|--------|
| [sim/index.md](sim/index.md) | Economic simulation results (36mo, 50yr, 500yr, 5000yr) | complete |

## VIII. Sandbox & Development

| Document | Description | Status |
|----------|-------------|--------|
| [sandbox/README.md](sandbox/README.md) | Sandbox environment overview | complete |
| [sandbox/CONTRACT_INVENTORY.md](sandbox/CONTRACT_INVENTORY.md) | Sandbox contract inventory | complete |
| [sandbox/SECURITY_POSTURE.md](sandbox/SECURITY_POSTURE.md) | Security posture assessment | complete |
| [sandbox/DEPLOYMENT_READINESS.md](sandbox/DEPLOYMENT_READINESS.md) | Deployment readiness checklist | complete |
| [sandbox/SIMULATION_RESULTS.md](sandbox/SIMULATION_RESULTS.md) | Sandbox simulation results | complete |

## IX. Research

| Document | Description | Status |
|----------|-------------|--------|
| [research/morphspace.md](research/morphspace.md) | MorphSpace research notes | complete |
| [research/acoustic_vault.md](research/acoustic_vault.md) | Acoustic vault research | complete |
| [research/meta_structure_schema.md](research/meta_structure_schema.md) | Meta-structure schema | complete |

## Reading Paths

**For new users:** GETTING_STARTED → USER_GUIDE → TOKENOMICS → whitepaper/vision
**For developers:** ARCHITECTURE → API_REFERENCE → central-banking/01 → central-banking/04 → central-banking/07
**For economists/auditors:** whitepaper/whitepaper → central-banking/14 → central-banking/02 → central-banking/11 → central-banking/12
**For security researchers:** SECURITY → reports/pentest_report → reports/formal_verification_report → central-banking/07 → central-banking/08
**For token holders:** GETTING_STARTED → TOKENOMICS → central-banking/05 → central-banking/09

## Nomenclature

| Term | Definition |
|------|-----------|
| Au | Artifact Utility — reserve-backed token (fixed supply, 9bps tax) |
| Ag | Artifact Governance — emission/reward token (elastic supply, PID-minted) |
| PID | Proportional-Integral-Derivative controller — monetary policy engine |
| AMO | Algorithmic Market Operations — autonomous reserve management |
| TWAP | Time-Weighted Average Price — manipulation-resistant oracle output |
| QuasiCrystal | QuasiCrystalLPNFT — ERC-721 representing Au/ETH Slipstream LP positions |
| Governor | DAO governance contract — Ag-weighted voting |
| Timelock | 48-hour delayed execution — security layer for governance |
| DAE | Decentralized Autonomous Enterprise — governance maturity model |
| FlashBuy | Treasury buyback mechanism — burns Au when below peg |

## Document Stats

- **Total documents:** 40+
- **Categories:** 9 (Foundational, User, Architecture, Central Banking, Whitepaper, Reports, Simulation, Sandbox, Research)
- **Central Banking deep-dive:** 18 documents + INDEX
- **All documents have YAML front matter** (title, date, status, description, category, related)
- **Contract addresses:** See [ADDRESS_BOOK.md](ADDRESS_BOOK.md)

## Verification Status

| Check | Status |
|-------|--------|
| All `.md` files have front matter | ✅ |
| All central-banking/ docs cross-referenced | ✅ |
| All contract addresses match address.book | ✅ |
| Formal verification (invariants) | 41/42 pass |
| Simulator runs (36–120+ months) | ✅ |
| RSBT → QuasiCrystal rename complete | ✅ |
