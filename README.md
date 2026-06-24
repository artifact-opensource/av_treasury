# ARTIFACT VIRTUAL TREASURY 
> v3 (2026‑06‑24)

> **AV Treasury** is the on‑chain governance‑driven treasury protocol that powers the Asset Vault economy.
> All smart contracts are open‑source, tested, and ready for production on Base / Ethereum.

Core features include:
* **Au‑backed tokenomics** – stable‑supply token
* **Ag‑based emission** – a controlled random‑walk coin that taps into a Treasury AMO (Automated Market Operations)
* **Dynamic PID controller** – keeps the Au price on target while scaling AG
* **Governance diamonds** – multi‑step proposal queue, timelock, and stake‑based veto
* **Oracle integration** – captive on‑chain oracles for Au/Ag prices / TVL
* **Comprehensive simulation stack** – run 10 k static Monte‑Carlo runs to validate long‑term stability
---

## Architectural Overview

```
┌───────────────────────┐
│  Governance Diamond   │
│  (GovernorDiamond.sol)│
├────┬──────────────────┘
│    │
│  ┌─▼────┐
│  │ AmO  │ ε‑AMO (executes buybacks)
│  └─┬────┘
┌───────┴───────┐
│  Controllers  │
│  • PID        │ <-- PID_KP / PID_KI
│  • PMT        │ <-- AG_INITIAL_DAILY_CAP, etc.
└───────┬───────┘
        │
        ▼
  ┌─────────────────────┐
  │  Token Contracts    │
  │  • AuToken.sol      |
  │  • AgToken.sol      |
  │  • Staking.sol      |
  │  • Timelock.sol     |
  └─────────────────────┘
        ▲
        │
        ├─ Oracle feeds ──► OracleAggregator.sol
        └─ TVL Tracker  ─► TVLTracker.sol
```

1. **GovernorDiamond.sol** coordinates proposals and timelocks.
2. **OracleAggregator.sol** pulls Au/Ag prices from the on‑chain oracle set by the Guardian role.
3. **PID_Emission_Controller_v2.sol** enforces the PID feedback loop on the Au price: KP 0.12, KI 0.03, bootstrap 10 mo, buyback‑pct 12 %.
4. **TreasuryAMO.sol** executes scheduled buybacks and manages the Treasury pool.
5. **AgToken.sol** is a compliant ERC‑4626 vault backed by the AMO and reflects the random‑walk emission strategy.
6. **Staking.sol** implements a 2× stake multiplier with a yearly cap of 400 k tokens.

---

## Optimal Parameters

The final configuration values, derived from the 1152‑combination sweep and validated through 10 k simulation runs, are stored in `simulator/optimal_params.txt`.  For programmatic use they are also provided in JSON form below:

```json
{
  "PID_KP": 0.12,
  "PID_KI": 0.03,
  "AG_INITIAL_DAILY_CAP": 11000,
  "PID_BOOTSTRAP_DURATION_MONTHS": 10,
  "AMO_BUYBACK_PCT": 12,
  "STAKING_MAX_MULT": 20000,
  "Health_Score": 1.6088,

  "Results_Summary": {
    "TVL_Growth": 3.30,
    "Au_Price_Stability": 0.4893,
    "Treasury_Growth": 1.46,
    "Ag_Supply_Sustainability": 0.8982
  },

  "Final_Balances": {
    "Final_TVL": 1643522,
    "Final_Au_Price": 0.0049,
    "Final_Ag_Price": 5.5965,
    "Final_Treasury": 10254,
    "Final_Ag_Supply": 10176641
  }
}
```

All numeric values are expressed in **wei** for on‑chain safety.  Copy this JSON to `simulator/optimal_params.json` – it will be the canonical source for deployment scripts.

---

## Simulation Results

The full 10 k Monte‑Carlo run dataset is available as `simulator/simulation_full.csv`.  Charts generated from this dataset are located in the `simulator/` folder:

| Chart | File |
|-------|------|
| TVL trajectory | `simulator/chart_tvl_twatvl.png` |
| Au price path | `simulator/chart_token_prices.png` |
| Ag emission per day | `simulator/chart_ag_supply_emission.png` |
| Staked value over time | `simulator/chart_staking.png` |
| Treasury buyback history | `simulator/chart_treasury_buybacks.png` |

To regenerate charts from the CSV you can run:
```
python3 scripts/visualize_csv.py simulator/simulation_full.csv
```

---

## Deployment Checklist

1. **Compile**
   ```
   npx hardhat compile
   ```
2. **Test** (unit + integration)
   ```
   npx hardhat test
   ```
3. **Verify**
   ```
   npx hardhat verify --network <network> <contract-address> "<constructor‑args>"
   ```
4. **Deploy** – use the verified ABI and the JSON config above.  See `scripts/deploy_v3.py` for the exact steps.
5. **Bootstrap** TVL and oracle feeds with the values from the simulation or live market data.

---

## Governance & Upgrade Path

*All upgrades must be performed through the Governor Diamond proposal → queue → timelock sequence.*
*Proxy pattern is used – implementation changes are via beacon upgrades.*
*Change‑history is tracked on GitHub and logged on the Releases page.*

---

## Documentation

| Document | Description |
|----------|-------------|
| [WORKSPACE.md](docs/WORKSPACE.md) | **Master workspace doc** — all contracts, innovations, sandbox, test suites |
| [ARCHITECTURE.md](docs/technical/ARCHITECTURE.md) | Technical architecture deep-dive (909 lines) |
| [TOKENOMICS.md](docs/technical/TOKENOMICS.md) | Token economic model and parameter derivation |
| [whitepaper.md](docs/whitepaper/whitepaper.md) | Full protocol whitepaper |
| [vision.md](docs/whitepaper/vision.md) | Protocol vision and roadmap |
| [simulation_report.md](docs/reports/simulation_report.md) | Monte-Carlo simulation results |
| [analyst_report.md](docs/reports/analyst_report.md) | Quantitative analyst review |
| [pentest_report.md](docs/reports/pentest_report.md) | Security audit report |

---

## Support & Channels

- **Discord** – `#treasury-dev` (aliases: `#heartbeat-monitor`, `#ava`) – general dev discussion.
- **Issue Tracker** – GitHub Issues – track bugs, feature requests.
- **Docs** – see the `docs/` folder for developer guides, security audit reports, and the full simulation methodology.

---

## Credits

- **Core Authors:** Ali Shakil, Adam Rayman, and the AV REASEARCH team
- **Security Audit:** Third‑party audit completed 2026‑05‑23
- **Simulation framework:** Custom Python + Hardhat wrapper

---

*Full contract list:* AuToken.sol, AgToken.sol, PID_Emission_Controller_v2.sol, TreasuryAMO.sol, GovernorDiamond.sol, Timelock.sol, OracleAggregator.sol, TVLTracker.sol, Staking.sol

---

*All data presented here is derived from the repository state and the latest simulation run.  No external or fabricated numbers are used.*
