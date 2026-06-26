# QuasiCrystal Deployment Plan

## Deployment Order

### Phase 1 — Foundation (independent, deploy now)
1. **AgToken** — Governance/utility ERC20 (standalone)
2. **AuToken** — Asset/bonding ERC20 (standalone)
3. **QuasiCrystalLPNFT** — Dynamic LP NFT (needs token addresses for constructor)

### Phase 2 — Oracle + Staking
4. **AvOracle** — TVL oracle (needs AuToken address for price feed)
5. **AVLPStaking_v2** — LP staking (needs AuToken + AvOracle addresses)

### Phase 3 — PID + AMO (wired together)
6. **PID_Emission_Controller_v2** — PID emission controller (needs AuToken + AvOracle)
7. **TreasuryAMO** — Auto-market operations (needs AuToken + AvOracle)
8. **Wire PID→AMO** — Call `TreasuryAMO.setPidController(pidAddress)`

### Phase 4 — Supporting (last)
9. **TreasuryFlashBuy** — Flash buy module
10. **ArtifactTimelock** — Governance timelock
11. **GovernorContract** — DAO governance

## Wiring Dependencies

| Contract | Depends On | Connection Method |
|---|---|---|
| QuasiCrystalLPNFT | AgToken, AuToken | Constructor args |
| AvOracle | AuToken | Constructor/initialize |
| AVLPStaking_v2 | AuToken, AvOracle | Constructor args |
| PID_Emission_Controller_v2 | AuToken, AvOracle | Constructor args |
| TreasuryAMO | AuToken, AvOracle | Constructor + setPidController |
| TreasuryFlashBuy | AuToken, TreasuryAMO | Constructor/initialize |

## Key Parameters (all adjustable post-deployment via governance)
- PID: Kp, Ki, Kd, min/max emission, cooldown
- AMO: cooldown, slippary, max buyback %, TWAP settings
- Staking: reward rate, lock period

## Notes
- NFT is ~58KB — fine for L2s (Base, Arbitrum), needs optimization for mainnet
- All set*() functions have access control (PARAM_ROLE / GOVERNOR)
- PID and AMO must be wired: `TreasuryAMO.setPidController(pidAddress)` after both deployed
