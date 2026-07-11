# AV Treasury — Testnet Analytics & Live Market Engine

## Purpose
Drives the local testnet full-stack deployment so the double-flywheel treasury
network "perpetually grows as designed": live buy/sell swaps, treasury buybacks,
flash buybacks, and staking — while tracking every contract + function call
granularly and surfacing where the stack fails.

## Layout
- `engine.js`    — perpetual simulation loop (run with `node engine.js`)
- `log.jsonl`    — every tx: {t, contract, fn, ok, gas, err}
- `metrics.json` — rolling per-contract/per-function counters {calls, fails, gas}
- `summary.js`   — prints current metrics + failure report

## Stack under test (deployments/testnet/addresses.json)
AuToken (Artifact Utility), AgToken (Artifact Governance), MockUSDC,
MockAerodromeRouter (local AMM), AvOracle v5, OracleWrapper, TreasuryAMO,
TreasuryFlashBuy_v2, TreasurySafe (2-of-2), ArtifactTimelock, GovernorContractV5,
AVLPStaking_v2, PIDEmissionControllerV2, QuasiCrystalLPNFT.

## Run
1. Local node must be up: `npx hardhat node --port 8545`
2. Deploy stack: `npx hardhat run scripts/deploy_testnet.js --network localhost`
3. Start engine: `node deployments/testnet/analytics/engine.js`
4. Watch metrics: `node deployments/testnet/analytics/summary.js`

## Failure handling
The engine NEVER patches or redeploys automatically. It logs every failure to
log.jsonl + metrics.json. A human/agent reviews summary.js and decides whether
to fix a contract, re-run deploy_testnet.js (idempotent fresh deploy), or adjust
the simulation. This keeps the testnet honest: failures are visible, not hidden.
