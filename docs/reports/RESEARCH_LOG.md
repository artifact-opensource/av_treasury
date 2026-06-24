# AV Treasury — Research Log

> **Started:** 2026-06-24  
> **Author:** Sirius + OWL  
> **Purpose:** Chronological journal of every design decision, build step, and discovery.

---

## Entry 1 — Token Role Correction (CRITICAL)

**What happened:** The sandbox had the token roles completely backwards.

**Discovery:** I re-read all contracts and the whitepaper and confirmed:

| Token | Contract | Role | Supply | Fee | Key Properties |
|-------|----------|------|--------|-----|----------------|
| **Au** | `AuToken.sol` | **Utility token** | 1B fixed | 9bps (4.5 burn, 4.5 treasury) | Deflationary, pausable, blacklist, anti-whale, flash loans, UUPS, sell cooldown |
| **Ag** | `AgToken.sol` | **Governance token** | 100M fixed | None | Vote-elastic, mintable/burnable, no fees |

**What was wrong before:**
- Old sandbox used "agUSD" (a stablecoin that doesn't exist in the protocol)
- Old sandbox had no Au token at all
- Old sandbox treated the volatile asset as the governance token
- The DEX pair was agUSD/AVAX instead of Ag/Au

**Impact:** All previous simulation results are invalid for the dual-token architecture. The sandbox needs a complete rebuild.

---

## Entry 2 — Full Contract Re-read

**What I read (all contracts, line by line):**

1. **AgToken.sol** (108 lines) — Governance token
   - `GOVERNOR_ROLE` can mint/burn
   - `MINTER_ROLE`, `BURNER_ROLE` via AccessControl
   - `setGovernance()` — governance can change the token's own governance
   - `setSupplyCap()` — hard cap at 100M
   - `voteElastic` — voting power scales with lock duration
   - No transfer fees

2. **AuToken.sol** (363 lines) — Utility token
   - 9bps transfer fee split: 4.5bps burned, 4.5bps to `feeCollector` (treasury)
   - `MAX_TRANSFER_PERCENT` = 5% of supply per tx
   - `MAX_HOLDING_PERCENT` = 10% of supply per address
   - `BLACKLIST_ROLE` — governance can block addresses
   - `PAUSER_ROLE` — emergency pause
   - `FLASH_LOAN_ROLE` — flash loan support
   - `SELL_COOLDOWN` — rate limiting on sells
   - UUPS upgradeable pattern
   - `withdrawETH()`, `withdrawToken()` — fee collection

3. **TreasuryAMO.sol** (738 lines) — Automated Market Operations
   - Buys Au on DEX using Treasury reserves
   - 20% of excess reserves above runway
   - 24h cooldown between buybacks
   - TWAP validation (max 5% deviation)
   - Slippage tolerance 0.5%
   - Dual DEX routing (Aerodrome + Uniswap)

4. **PID_Emission_Controller_v2.sol** (936 lines) — Ag emission control
   - PID controller adjusts Ag mint rate based on TVL deviation
   - kp, ki, kd parameters with 48h timelock on changes
   - Daily cap: 100k Ag, Single cap: 10k Ag
   - Multi-source TVL from AvOracle

5. **AvOracle.sol** (614 lines) — TVL aggregator
   - Accepts `ITvlSource` implementations
   - Chainlink price feeds for USD normalization
   - Used by PID controller for emission decisions

6. **AVLPStaking_v2.sol** (403 lines) — LP staking
   - Deposit LP tokens → earn Au + Ag yield
   - Ag multiplier based on lock duration
   - Reports TVL to AvOracle

7. **GovernorContract.sol** (283 lines) — DAO governance
   - Propose → Vote → Queue → Execute pipeline
   - 48h timelock, 72h voting period
   - 1% proposal threshold, 4% quorum

8. **ArtifactTimelock.sol** (84 lines) — DAO vault
   - Holds Treasury reserves
   - 48h timelock on disbursement
   - Emergency multisig bypass (3-of-5)

9. **MockLPNFT.sol** (59 lines) — Mock LP position NFT

10. **ITvlSource.sol** (12 lines) — TVL interface

---

## Entry 3 — Sandbox Rebuild Plan

**Architecture (corrected):**

```
Bots trade against DEX
       │
       ▼
┌──────────────┐     fees     ┌──────────────────┐
│  DexSimulator │───────────►│  AuToken         │
│  Ag/Au pool   │             │  9bps fee        │
│  one-sided LP │             │  4.5bps burned   │
└──────┬───────┘             │  4.5bps treasury │
       │                     └──────────────────┘
       │ price feed
       ▼
┌──────────────┐    mint     ┌──────────────────┐
│  AvOracle    │───────────►│  AgToken         │
│  TVL tracker │             │  governance      │
└──────┬───────┘             │  no fees         │
       │                     └──────────────────┘
       │ TVL data            ▲
       ▼                     │ emission
┌──────────────┐             │
│  PID Controller│───────────┘
│  Ag emission  │
└──────────────┘
```

**Token setup:**
- **Au:** 1B initial supply, 9bps fee, deployed as mock (no real fee in sandbox for simplicity, but fee mechanics logged)
- **Ag:** 100M initial supply, no fees, initial price target ~0.1 Au per Ag
- **DEX pair:** Ag/Au with initial liquidity: 10M Ag + 1M Au (price: 0.1 Au/Ag)

**Bot behaviors (corrected semantics):**
- **Buyers:** Buy Ag with Au (bullish on governance)
- **Sellers:** Sell Ag for Au (take profits)
- **LPs:** Provide one-sided Ag or Au liquidity
- **Arbitrageurs:** Keep DEX price aligned with oracle
- **Whales:** Large moves to test price impact
- **Fee harvesters:** Track accumulated fees

---

## Entry 4 — Implementation Steps

- [x] Write research log (this file)
- [ ] Rewrite MockTokens.sol (Au + Ag)
- [ ] Rewrite DexSimulator.sol (Ag/Au pool + one-sided LP)
- [ ] Rewrite deploy-sandbox.js (full deployment)
- [ ] Rewrite BotEngine.js (correct token semantics)
- [ ] Rewrite stress-test.js (dual-token scenarios)
- [ ] Rewrite Dashboard.js (correct metrics)
- [ ] Rewrite orchestrate.sh (updated scripts)
- [ ] Run simulation on Anvil
- [ ] Document results

---

## Entry 5 — Build Execution

*Continued below as implementation proceeds...*

---

## Entry 6 — Simulation Results

*To be filled after running the simulation...*

---

## Entry 7 — Findings & Next Steps

*To be filled after analysis...*
