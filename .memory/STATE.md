# AV Treasury — Current State (2026-06-28)

## Deployed Contracts (Base Mainnet — all verified on Basescan)

| Contract | Address | Status |
|----------|---------|--------|
| Au Token | 0x1D31719389Bd8b17277Ba367c26b830aE34D3674 | ✅ Live |
| Ag Token | 0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08 | ✅ Live |
| TreasuryAMO | 0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385 | ✅ Live |
| PID Controller | 0x662321CC63700865838aB08378061BE499344714 | ✅ Live |
| AvOracle v5 | 0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB | ✅ Live |
| Governor | 0x991138923880773D67c01392c31A255e770F7f70 | ✅ Live |
| Timelock | 0xD96D502B20474308521958573E3Fa68DbB041685 | ✅ Live |
| RSBT | 0x56653245f4718fe105b95C8424947B31b84b5188 | ✅ Live |
| AcousticVault | 0xf6383860837E6cb983F9Af8Def92fc08F15Be65b | ✅ Live |
| Treasury Safe | 0x1082...9F9e | ⚠️ Threshold 1/2 (TODO: 2/2) |

## New Contracts (Source Only — Not Yet Deployed)

| Contract | File | Lines | Purpose |
|----------|------|-------|---------|
| OracleFlashBuy | contracts/av_suite/OracleFlashBuy.sol | 307 | Oracle-triggered buyback |
| OracleGuardian | contracts/av_suite/OracleGuardian.sol | 464 | Oracle integration layer |
| OracleWrapper | contracts/av_suite/OracleWrapper.sol | 349 | Oracle adapter |
| TreasuryFlashBuy_v2 | contracts/av_suite/TreasuryFlashBuy_v2.sol | 281 | Updated buyback engine |

## Sandbox / Tooling

| Component | Location | Status |
|-----------|----------|--------|
| BotEngine.js | sandbox/bots/BotEngine.js (733 lines) | Simulation only — NOT live |
| atp_watcher.py | sandbox/bots/atp_watcher.py (249 lines) | ATP monitoring |
| deployed.json | sandbox/config/deployed.json | ⚠️ STALE — has old addresses |

## Architecture Summary

### Token System
- **Au**: Fixed supply, 9bps transfer tax, reserve-backed
- **Ag**: Elastic supply, PID-governed, 100M cap, mint/burn by TreasuryAMO

### Monetary Policy
- **PID Controller**: Computes Ag emissions from TVL gap (target: $50K)
- **Reserve Ratio**: 60% target
- **Emission Bounds**: 0–10M Ag over 5 days

### Oracle
- **AvOracle v5**: Multi-source TWAP, manipulation-resistant
- **OracleGuardian**: Governance-controlled adapter between oracle and consumers
- **OracleFlashBuy**: Triggers buybacks when Au < $1.00

### Governance
- **Governor**: 100K threshold, 30-day voting, 4% quorum
- **Timelock**: 48h delay
- **Treasury Safe**: 1/2 multisig (needs upgrade to 2/2)

### Liquidity
- **TreasuryAMO**: Slipstream CLMM operations
- **AcousticVault**: Reserve backing vault

## Phase 4 — Not Started
- [ ] Sub-DAO pilots
- [ ] Live keeper bot (transform BotEngine → production)
- [ ] Governance threshold upgrade (1/2 → 2/2)
- [ ] Timelock ownership transfer
- [ ] Emergency role reassignment
- [ ] LP NFT migration to Governor
- [ ] OracleFlashBuy + OracleGuardian deployment

## Key Parameters
- PID Target TVL: $50,000
- Reserve Ratio: 60%
- Ag Emission Cap: 10,000,000 over 5 days
- Au Floor: $1.00 (FlashBuy trigger)
- Governance Quorum: 4%
- Voting Period: 30 days
- Proposal Threshold: 100,000 tokens
- Timelock Delay: 48 hours
- Au Transfer Tax: 9bps
- Ag Max Supply: 100,000,000
