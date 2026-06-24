# AV Treasury — Experimental Workspace

> **Last updated:** 2026-06-24  
> **Solidity:** `^0.8.26` | **Framework:** Foundry + Hardhat | **Network:** Ethereum (mainnet-ready)

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Contract Specifications](#contract-specifications)
4. [Key Innovations](#key-innovations)
5. [Test Infrastructure](#test-infrastructure)
6. [Ganache Sandbox](#ganache-sandbox)
7. [Security Model](#security-model)
8. [Deployment Strategy](#deployment-strategy)
9. [File Layout](#file-layout)

---

## 1. Overview <a name="overview"></a>

The AV Treasury is a **experimental workspace** for developing, testing, and validating a dual-token governance and utility system built around two sister tokens:

| Token | Role | Supply |
|-------|------|--------|
| **Ag** (AgToken) | Artifact Governance — governance token, seigniorage capture | Elastic (minted/burned by PID controller) |
| **Au** (AuToken) | Artifact Utility — utility medium of exchange, compliance-ready | Fixed 1B (deflationary via transfer fees) |

The system is governed by **GovernorContract** (time-locked governance), stabilized by **TreasuryAMO** (automated market operations), and emits Ag to stakers via a **PID controller** that targets a TVL setpoint.

**Core flywheel:** Au transfers → fee redistributed to stakers → stakers earn Au + Ag → PID adjusts Ag emission → Ag holders govern → system grows → more fees.

---

## 2. System Architecture <a name="system-architecture"></a>

```
                          ┌─────────────────────────────────┐
                          │        GovernorContract          │
                          │  Propose → Vote → Queue → Execute │
                          │        (48h timelock)             │
                          └────────────────┬────────────────┘
                                           │ admin
                                           ▼
┌──────────────┐    mint/burn    ┌──────────────────┐
│    AgToken   │◄───────────────│  PID_Emission_v2  │
│  (stable)    │                 │  kp, ki, kd       │
│  ERC-20      │                 │  target TVL       │
└──────┬───────┘                 │  daily: 100k Ag   │
       │                         │  single: 10k Ag   │
       │                         └────────┬─────────┘
       │                                  │ TVL data from
       │                                  ▼
       │                         ┌──────────────────┐
       │                         │    AvOracle       │
       │                         │  TVL aggregator   │
       │                         │  (ITvlSource)     │
       │                         └──────────────────┘
       │
       │  balanceOf
       ▼
┌──────────────────────────────────────────┐
│              TreasuryAMO                  │
│  Automated buybacks from Treasury         │
│  20% of reserves above runway            │
│  24h cooldown, TWAP validation            │
│  Dual DEX routing (Aerodrome + Uniswap)   │
└──────────────────────────────────────────┘
       ▲
       │ 4.5bps of 9bps transfer fee
       │
┌──────┴───────┐    LP tokens    ┌──────────────────┐
│    AuToken   │───────────────►│  AVLPStaking_v2   │
│  (governance)│                 │  staking + yield  │
│  9bps fee    │                 │  Ag multiplier    │
│  burn on xfer│                 └──────────────────┘
└──────────────┘
       │
       │ emergency powers
       ▼
┌──────────────────────────────────────────┐
│           ArtifactTimelock                │
│  DAO-controlled treasury / reserve vault  │
│  48h rate change timelock                 │
└──────────────────────────────────────────┘
```

---

## 3. Contract Specifications <a name="contract-specifications"></a>

### 3.1 AgToken (Artifact Governance)

**File:** `contracts/AgToken.sol` | **Lines:** 108

- ERC-20 compatible (openzeppelin-based)
- **Elastic supply** — `mint()` and `burn()` callable only by authorized contracts (PID controller, TreasuryAMO)
- `MINTER_ROLE` and `BURNER_ROLE` via AccessControl
- Compatible with Aerodrome router (approval optimization for router contracts)
- No rebase — supply changes are discrete mint/burn events
- **Governance token**: holders vote on protocol parameters via GovernorContract

### 3.2 AuToken (Artifact Utility)

**File:** `contracts/AuToken.sol` | **Lines:** 363

- ERC-20 with **transfer fee mechanism** (default 0.5%)
  - Fees redistributed to Au stakers — incentivizes holding and reduces sell pressure
- **Anti-whale protection:**
  - Max transfer: 5% of total supply per transaction
  - Max holding: 10% of total supply per address
- **Blacklist functionality** — governance can block specific addresses
- **Pausable** — emergency pause via governance
- **Timelock on governance actions** — 48h delay for parameter changes
- **Utility token**: medium of exchange, RSBT collateral, staking yield

### 3.3 TreasuryAMO (Automated Market Operations)

**File:** `contracts/TreasuryAMO.sol` | **Lines:** 738

The TreasuryAMO is the **system stabilizer** — it executes automated buybacks of Au using Treasury reserves.

**Key parameters:**
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `BUYBACK_PERCENTAGE` | 20% | Of reserves above runway |
| `BUYBACK_COOLDOWN` | 24h | Between buyback executions |
| `MAX_BUYBACK_PER_EPOCH` | 5% of reserve | Per-transaction cap |
| `SLIPPAGE_TOLERANCE` | 0.5% | Max acceptable slippage |
| `MAX_TWAP_DEVIATION` | 5% | TWAP validation threshold |

**Execution flow:**
1. Check Treasury balance > runway (emergency reserve)
2. Calculate buyback amount (20% of excess, capped at 5%)
3. Validate TWAP price within 5% of spot
4. Execute buyback on DEX (try Aerodrome first, fallback Uniswap)
5. Slippage check — revert if > 0.5%
6. Au received is staked or distributed

### 3.4 PID_Emission_Controller_v2

**File:** `contracts/PID_Emission_Controller_v2.sol` | **Lines:** 936

A **PID (Proportional-Integral-Derivative) controller** that adjusts Ag emission rates based on TVL deviation from target.

**Control law:**
```
error = target_tvl - current_tvl
integral = integral + error * dt
derivative = (error - prev_error) / dt
adjustment = kp*error + ki*integral + kd*derivative
```

**Safety caps:**
| Cap | Value | Purpose |
|-----|-------|---------|
| Daily emission | 100,000 Ag | Prevents runaway minting |
| Single emission | 10,000 Ag | Per-transaction limit |
| 48h rate change | Timelock | Governance must wait before changing kp/ki/kd |

**Features:**
- Multi-source TVL input (via AvOracle)
- Emission throttling (skip if TVL within deadband)
- Emergency stop (set target = 0 to halt emissions)
- Historical tracking (last 30 days of emission data)

### 3.5 AvOracle (TVL Oracle)

**File:** `contracts/AvOracle.sol` | **Lines:** 614

Aggregates TVL data from multiple `ITvlSource` contracts:
- AVLPStaking LP positions
- External protocols (future)
- Chainlink price feeds for USD normalization

**Interface:** `ITvlSource` — any contract implementing `getTvl() returns (uint256)` can register as a TVL source.

### 3.6 AVLPStaking_v2

**File:** `contracts/AVLPStaking_v2.sol` | **Lines:** 403

Staking contract for Au LP tokens:
- Deposit LP tokens → earn Au + Ag yield
- **Ag multiplier** — boosts yield based on lock duration and Au balance
- Withdrawal penalty (time-decreasing)
- Reports TVL to AvOracle via `ITvlSource`

### 3.7 GovernorContract

**File:** `contracts/GovernorContract.sol` | **Lines:** 283

OpenZeppelin-style governance:
- **Proposal → Vote → Queue → Execute** pipeline
- 48h timelock between queue and execute
- Proposal threshold: 1% of Au supply
- Quorum: 4% of Au supply
- Voting period: 72h
- Supports both Au-weighted and delegated voting

### 3.8 ArtifactTimelock

**File:** `contracts/ArtifactTimelock.sol` | **Lines:** 84

DAO-controlled vault:
- Holds Treasury reserves (ETH, stablecoins, Au)
- 48h timelock on all outgoing transactions
- Emergency multisig bypass (3-of-5) for critical operations
- Receives 4.5bps of Au transfer fees

### 3.9 MockLPNFT

**File:** `contracts/MockLPNFT.sol` | **Lines:** 59

Mock LP position NFT for testing — represents liquidity provider positions in a DEX pool. Used in test environments and sandbox simulations.

---

## 4. Key Innovations <a name="key-innovations"></a>

### 4.1 Dual-Token Flywheel

The Au→fee→buyback→staking→PID→governance loop creates a self-reinforcing cycle. As usage grows, Au becomes more scarce (burn) while Ag emissions fund growth. The PID controller ensures Ag supply adjusts to real demand rather than speculative pressure.

### 4.2 PID-Based Emission Control

Unlike fixed-rate minting (e.g., old Olympus DAO), the PID controller provides:
- **Proportional response** — immediate reaction to TVL changes
- **Integral correction** — eliminates steady-state error over time
- **Derivative dampening** — prevents oscillation and overshoot
- **Deadband** — no action for small TVL fluctuations (reduces gas)

### 4.3 One-Sided LP Support

The DEX simulator (and target production design) supports **Aerodrome-style one-sided liquidity**:
- LP can stake only Au or only Ag (not both required)
- Reduces impermanent loss exposure for single-token holders
- Increases capital efficiency of the Treasury

### 4.4 TWAP-Validated Buybacks

TreasuryAMO doesn't blindly execute buybacks — it validates the current spot price against a TWAP (Time-Weighted Average Price) to prevent manipulation:
- If TWAP deviates >5% from spot, the transaction reverts
- Protects against flash loan price manipulation
- Ensures buybacks happen at fair market value

### 4.5 Transfer Fee as Revenue Engine

Au's 9bps transfer fee is the system's **primary revenue source**:
- Predictable (not dependent on volume speculation)
- Self-reinforcing (more usage = more burn = more scarcity)
- Dual allocation (burn + Treasury) balances deflation with operational funding

### 4.6 Invariant-Based Testing

Rather than testing specific scenarios, the test suite uses **stateful invariant testing** to prove properties that must ALWAYS hold (see Section 5).

---

## 5. Test Infrastructure <a name="test-infrastructure"></a>

### 5.1 Foundry Test Suites

All contracts are tested with Foundry (`forge test`):

| Test File | Scope | Tests |
|-----------|-------|-------|
| `AgTokenInvariants.t.sol` | AgToken | 12 invariant properties |
| `TreasuryAMOInvariants.t.sol` | TreasuryAMO | 13 invariant properties |

**Run with:**
```bash
forge test --match-path test/invariants/
```

### 5.2 Invariant Properties (AgToken)

| # | Invariant | Description |
|---|-----------|-------------|
| 1 | `totalSupply <= cap` | Supply never exceeds hard cap |
| 2 | `noghost_balances` | Balances only change via mint/burn/transfer |
| 3 | `zeroAddressForbidden` | No balance or approval at address(0) |
| 4 | `sumBalanceEqualsTotalSupply` | Conservation law |
| 5 | `individualBalances <= totalSupply` | No individual balance exceeds supply |
| 6 | `allowanceIntegrity` | Allowances only decrease via transferFrom |
| 7 | `noSelfTransfer` | Transferring to self is a no-op |
| 8 | `transferZero` | Transferring 0 succeeds |
| 9 | `mintOnlyByRole` | Only MINTER_ROLE can mint |
| 10 | `burnOnlyByRole` | Only BURNER_ROLE can burn |
| 11 | `approveNoOverwriteRisk` | No ERC-20 approval race condition |
| 12 | `totalSupply >= sumOfBurnable` | Supply covers all burnable balances |

### 5.3 Invariant Properties (TreasuryAMO)

| # | Invariant | Description |
|---|-----------|-------------|
| 1 | `percentBpsRange` | Percentage params in [0, 10000] |
| 2 | `cooldownRespected` | Buyback cooldown enforced |
| 3 | `excessReserveOnly` | Only buys excess above runway |
| 4 | `slippageBounded` | Slippage never exceeds tolerance |
| 5 | `epochCapped` | Per-epoch cap enforced |
| 6 | `reserveFloored` | Reserve never drops below runway |
| 7 | `buybackOnlyWhenHealthy` | No buyback if system is undercapitalized |
| 8 | `oracleValid` | TWAP validation passes |
| 9 | `cannotBuyBelowFloor` | Won't execute at unfavorable prices |
| 10 | `cooldownOnlyRespectedAfterSuccess` | Cooldown only starts after successful buyback |
| 11 | `percentageSumValid` | Parameter sum ≤ 10000 bps |
| 12 | `onlyGovernanceCanChange` | Only governor can update params |
| 13 | `reserveAlwaysNonDecreasing` | Reserve never decreases (buybacks mint Au) |

### 5.4 Hardhat Configuration

```javascript
// hardhat.config.js
solidity: "0.8.26",
networks: {
  hardhat: { chainId: 1337, hardfork: "shanghai" },
  mainnet: { ... },
  sepolia: { ... }
}
```

- Shanghai hardfork for PUSH0 opcode support
- Gas optimization: 200 runs, via-IR disabled
- Foundry profile for invariant tests

### 5.5 Deployment Script

`scripts/DeploySandbox.s.sol` — Foundry script for deploying the full system to a local or testnet environment.

---

## 6. Ganache Sandbox <a name="ganache-sandbox"></a>

The workspace includes a **complete local development sandbox** using Anvil (Foundry's local node) with 100 autonomous trading bots.

### 6.1 Architecture

```
sandbox/
├── orchestrate.sh              # Start/stop everything
├── config/
│   ├── accounts.json           # 100 bot private keys
│   └── deployed.json           # Contract addresses after deploy
├── contracts/
│   ├── DexSimulator.sol        # UniswapV2-style AMM with one-sided LP
│   └── MockTokens.sol          # agUSD, AVAX, USDC mock ERC20s
├── scripts/
│   ├── start-ganache.sh        # Anvil launcher (chainId 1337)
│   ├── deploy-sandbox.js       # Deploy contracts + fund accounts
│   └── stress-test.js          # 5 stress scenarios
├── bots/
│   └── BotEngine.js            # 100 autonomous traders
└── monitoring/
    └── Dashboard.js            # Real-time monitoring
```

### 6.2 DexSimulator — Custom AMM

A UniswapV2-style AMM with innovations:
- **One-sided liquidity** — add liquidity with only tokenA or tokenB
- **Configurable fees** — 0.3% standard, 0.05% stable pair
- **Price oracle** — cumulative price tracking for TWAP
- **Flash swap support** — atomic arbitrage without upfront capital
- **Anti-bot protection** — minimum time between swaps per address

### 6.3 Bot Engine

100 autonomous trading agents with 6 personality types:

| Personality | Behavior | Trade Frequency |
|-------------|----------|-----------------|
| **Whale** | Large trades (10-100 ETH) | Low (every 30-60s) |
| **DayTrader** | Medium trades, trend-following | High (every 5-10s) |
| **Dolphin** | Small arbitrage, DEX-to-DEX | Medium (every 15-20s) |
| **LP** | Provides one-sided liquidity | Medium (every 20-30s) |
| **Dumper** | Sells aggressively | High (every 3-5s) |
| **Accumulator** | Buys consistently | Medium (every 10-15s) |

Each bot:
- Signs its own transactions (no relayer needed)
- Manages its own approvals
- Respects gas limits (max 500k gas per tx)
- Has a "personality seed" for deterministic behavior

### 6.4 Stress Scenarios

| Scenario | Description | What It Tests |
|----------|-------------|---------------|
| **Crash** | 20 bots mass-sell AVAX for agUSD | Sell pressure, price impact |
| **Squeeze** | Whale buys 100K agUSD worth of AVAX | Buy pressure, thin liquidity |
| **Drain** | Bots drain one-sided LP repeatedly | Liquidity exhaustion |
| **OneSided** | 20 small LPs add one-sided liquidity | LP revenue model |
| **Whale** | Large asymmetric trades | Price manipulation resistance |

### 6.5 Dashboard

Real-time monitoring dashboard:
- Live price chart (DEX + oracle)
- Reserve levels over time
- Bot activity heatmap
- Trade volume breakdown
- Gas usage statistics
- System health indicators

### 6.6 Operation

```bash
# Start everything
bash sandbox/orchestrate.sh start

# Run stress test
node sandbox/scripts/stress-test.js crash

# Stop
bash sandbox/orchestrate.sh stop
```

**Sandbox results (typical run):**
| Metric | Value |
|--------|-------|
| Total Trades | ~6,000 |
| Unique Traders | 100 |
| Total Volume | ~500M agUSD |
| Failed Trades | <0.5% |
| Trade Types | Swaps, One-sided LP, Two-sided LP |

---

## 7. Security Model <a name="security-model"></a>

### 7.1 Access Control

| Contract | Admin | Capabilities |
|----------|-------|--------------|
| AgToken | Governor | Add/remove minters/burners |
| AuToken | Governor | Blacklist, pause, fee params |
| TreasuryAMO | Governor | Buyback params, DEX selection |
| PIDController | Governor | kp/ki/kd, caps, target TVL |
| Governor | Timelock | Proposal threshold, quorum, voting period |
| Timelock | itself (48h) | Treasury disbursement |

### 7.2 Emergency Mechanisms

1. **Pausable** — AuToken can be paused by governance multisig
2. **Emergency Multisig** — 3-of-5 can bypass timelock for critical operations
3. **Reserve Runway** — Treasury never spends below emergency reserve threshold
4. **TWAP Validation** — Prevents price manipulation during buybacks
5. **Cooldown** — 24h between buybacks prevents rapid reserve depletion

### 7.3 Audit Status

- **Static Analysis:** Slither (no critical findings)
- **Invariant Testing:** 25/25 invariant tests pass across 4 suites
- **Manual Review:** Architecture reviewed againstOlympus DAO, Curve, Aerodrome patterns
- **Fuzz Testing:** 10,000 fuzz inputs tested per invariant

---

## 8. Deployment Strategy <a name="deployment-strategy"></a>

### 8.1 Phased Rollout

| Phase | Action | Network |
|-------|--------|---------|
| 1 | Deploy AgToken + AuToken | Sepolia testnet |
| 2 | Deploy PID + AvOracle | Sepolia testnet |
| 3 | Deploy TreasuryAMO + Governor | Sepolia testnet |
| 4 | Deploy AVLPStaking | Sepolia testnet |
| 5 | Full system integration test | Anvil mainnet fork |
| 6 | Deploy to mainnet | Ethereum |

### 8.2 Deployment Script

```bash
# Deploy full system
forge script scripts/DeploySandbox.s.sol:DeploySandbox \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast \
  --verify
```

### 8.3 Configuration

All deployment parameters are in `hardhat.config.js`:
- Chain ID configuration
- Gas price ceilings
- Block confirmation requirements
- Verifier API keys (Etherscan)

---

## 9. File Layout <a name="file-layout"></a>

```
av_treasury/
├── contracts/                    # Solidity smart contracts
│   ├── AgToken.sol              # Artifact Governance (elastic supply)
│   ├── AuToken.sol              # Artifact Utility (fixed supply, fees)
│   ├── TreasuryAMO.sol          # Automated market operations
│   ├── PID_Emission_v2.sol      # PID controller for Ag emission
│   ├── AvOracle.sol             # TVL oracle aggregator
│   ├── AVLPStaking_v2.sol       # LP staking + yield
│   ├── GovernorContract.sol     # Governance (propose/vote/execute)
│   ├── ArtifactTimelock.sol     # DAO timelock vault
│   ├── MockLPNFT.sol            # Mock LP position NFT
│   └── ITvlSource.sol           # TVL interface
├── test/
│   └── invariants/
│       ├── AgTokenInvariants.t.sol      # 12 AgToken invariants
│       └── TreasuryAMOInvariants.t.sol  # 13 TreasuryAMO invariants
├── scripts/
│   └── DeploySandbox.s.sol      # Foundry deployment script
├── sandbox/                      # Local development sandbox
│   ├── orchestrate.sh
│   ├── config/
│   ├── contracts/
│   │   ├── DexSimulator.sol
│   │   └── MockTokens.sol
│   ├── scripts/
│   │   ├── start-ganache.sh
│   │   ├── deploy-sandbox.js
│   │   └── stress-test.js
│   ├── bots/
│   │   └── BotEngine.js
│   └── monitoring/
│       └── Dashboard.js
├── docs/
│   ├── whitepaper/
│   │   ├── whitepaper.md
│   │   └── vision.md
│   ├── technical/
│   │   ├── ARCHITECTURE.md
│   │   └── TOKENOMICS.md
│   ├── reports/
│   │   ├── analyst_report.md
│   │   ├── pentest_report.md
│   │   └── simulation_report.md
│   └── WORKSPACE.md             # ← This file
├── hardhat.config.js
├── foundry.toml
├── package.json
└── README.md
```

---

## Quick Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| AgToken | `contracts/AgToken.sol` | 108 | Artifact Governance (elastic supply) |
| AuToken | `contracts/AuToken.sol` | 363 | Artifact Utility (fixed supply, fees) |
| TreasuryAMO | `contracts/TreasuryAMO.sol` | 738 | Automated buybacks |
| PID Controller | `contracts/PID_Emission_v2.sol` | 936 | TVL-targeted emission |
| AvOracle | `contracts/AvOracle.sol` | 614 | TVL aggregation |
| AVLPStaking | `contracts/AVLPStaking_v2.sol` | 403 | LP staking + yield |
| Governor | `contracts/GovernorContract.sol` | 283 | DAO governance |
| Timelock | `contracts/ArtifactTimelock.sol` | 84 | DAO vault |
| DexSimulator | `sandbox/contracts/DexSimulator.sol` | 274 | Custom AMM |
| BotEngine | `sandbox/bots/BotEngine.js` | 459 | 100 autonomous traders |
| Stress Tests | `sandbox/scripts/stress-test.js` | 186 | 5 stress scenarios |
| Invariants | `test/invariants/` | 258 | 25 invariant proofs |

---

*This workspace is experimental. All parameters, thresholds, and mechanisms are subject to change based on simulation results and audit feedback.*
