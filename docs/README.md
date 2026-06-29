---
title: AV Treasury — Quick Start
date: 2026-06-29
status: final
description: Quick start guide for the AV Treasury protocol documentation system.
category: reference
related: [INDEX.md, whitepaper/whitepaper.md, whitepaper/vision.md, technical/dapp-brief.md, technical/deployment-plan.md]
---

# AV Treasury — Quick Start

> **Production Live** on Base Mainnet (Chain ID: 8453)
> **Last Updated:** 2026-06-29

## What is AV Treasury?

AV Treasury is a decentralized central banking protocol that manages a dual-token system:

- **Artifact Utility (Au)** — The utility token, used for staking rewards and protocol fees
- **Artifact Governance (Ag)** — The governance token, used for voting and protocol direction

The protocol uses a **PID controller** to autonomously manage Au emission rates based on TVL targets, creating a self-stabilizing economic flywheel.

## Key Contracts

| Contract | Purpose |
|----------|---------|
| TreasuryAMO | Core treasury management |
| PID_Emission_Controller | Autonomous emission rate control |
| Au / Ag | Dual-token system |
| QuasiCrystalLPNFT | LP position NFTs |
| AVLPStaking_v2 | LP staking with Ag-balance multiplier (1.0x-2.5x) |
| OracleWrapper | Price oracle aggregation |
| Governor / Timelock | On-chain governance |

See [`address.book`](../address.book) for all deployed addresses.

## Documentation Map

- **Whitepapers** → [`whitepaper/`](whitepaper/) — Protocol design & vision
- **Technical Docs** → [`technical/`](technical/) — Deployment, DApp, formal verification
- **Reports** → [`reports/`](reports/) — Audits, pentest, formal verification results
- **Simulator** → [`sim/`](sim/) — Economic simulation engine & results
- **Sandbox** → [`sandbox/`](sandbox/) — Test deployment environment

## Quick Links

- [Master Index](INDEX.md) — Complete document registry
- [Whitepaper](whitepaper/whitepaper.md) — Core protocol mechanics
- [Deployment Plan](technical/deployment-plan.md) — How to deploy
- [Formal Verification Report](reports/formal_verification.md) — Security proofs
- [Pentest Report](reports/pentest.md) — Penetration test results
- [Simulator](sim/index.md) — Economic simulation engine
