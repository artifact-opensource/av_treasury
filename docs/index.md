---
title: AV Treasury — Documentation
version: 1.0
status: canonical
last_updated: 2026-06-29
---

# AV Treasury — Documentation

> A decentralized central bank on Base. Monetary policy enforced by code. Governance by stakeholders. Transparency by default.

## Quick Start

New to AV Treasury? Read in order:

1. [Central Banking Thesis — Index](CENTRAL_BANKING_THESIS/index.md) — Start here
2. [Architecture](CENTRAL_BANKING_THESIS/01_architecture.md) — System overview
3. [Dual Token Design](CENTRAL_BANKING_THESIS/02_dual_token.md) — Au/Ag monetary theory

## Documentation Map

### Core Thesis

| Document | Description |
|----------|-------------|
| [CENTRAL_BANKING_THESIS/](CENTRAL_BANKING_THESIS/index.md) | Complete central banking thesis (11 documents) |
| [01_architecture](CENTRAL_BANKING_THESIS/01_architecture.md) | System topology, all subsystems, data flow |
| [02_dual_token](CENTRAL_BANKING_THESIS/02_dual_token.md) | Au/Ag design, tokenomics, monetary theory |
| [03_pid_controller](CENTRAL_BANKING_THESIS/03_pid_controller.md) | PID math, parameters, stability analysis |
| [04_flywheel](CENTRAL_BANKING_THESIS/04_flywheel.md) | Economic cycle, incentive alignment, failure modes |
| [05_governance](CENTRAL_BANKING_THESIS/05_governance.md) | DAO structure, proposal tiers, timelock |
| [06_oracle_system](CENTRAL_BANKING_THESIS/06_oracle_system.md) | OracleWrapper, AvOracle v5, TWAP, manipulation resistance |
| [07_treasury_ops](CENTRAL_BANKING_THESIS/07_treasury_ops.md) | AMO, FlashBuy, liquidity management |
| [08_contracts](CENTRAL_BANKING_THESIS/08_contracts.md) | All deployed contracts, ABI highlights |
| [09_formal_verification](CENTRAL_BANKING_THESIS/09_formal_verification.md) | Halmos, fuzzing, invariants, proof coverage |
| [10_simulation](CENTRAL_BANKING_THESIS/10_simulation.md) | Long-range economic modeling, 50/500/5000-year plans |
| [11_academic_validation](CENTRAL_BANKING_THESIS/11_academic_validation.md) | Mathematical proofs, paper outline, related work |

### Reference

| Document | Description |
|----------|-------------|
| [ADDRESS_BOOK.md](ADDRESS_BOOK.md) | All contract addresses (proxy + implementation) |
| [dapp-technical-brief.md](dapp-technical-brief.md) | Technical brief for dApp integration |

### Reports

| Document | Description |
|----------|-------------|
| [reports/formal_verification_report.md](reports/formal_verification_report.md) | Halmos + fuzz test results |
| [reports/analyst_report.md](reports/analyst_report.md) | Full system review |
| [reports/pentest_report.md](reports/pentest_report.md) | Security assessment |

### Whitepaper

| Document | Description |
|----------|-------------|
| [whitepaper/whitepaper.md](whitepaper/whitepaper.md) | Full whitepaper |
| [whitepaper/vision.md](whitepaper/vision.md) | Vision statement |

## Key Addresses

| Contract | Address |
|----------|---------|
| Au Token | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` |
| Ag Token | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` |
| TreasuryAMO | `0x56653245f4718fe105b95C8424947B31b84b5188` |
| PID Controller | `0x991138923880773D67c01392c31A255e770F7f70` |
| Governor | `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` |
| Timelock | `0x662321CC63700865838aB08378061BE499344714` |

## Status

- [x] Core documentation complete
- [x] Central Banking Thesis (11 documents)
- [x] Formal verification (Halmos + fuzz)
- [x] 36-month simulation
- [ ] Contender stateful fuzzing
- [ ] Certora formal verification
- [ ] 50/500/5000-year simulation
- [ ] IEEE/arXiv paper
- [ ] External audit
