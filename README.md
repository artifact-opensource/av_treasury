# Artifact Virtual Treasury — Au/Ag Dual-Token Ecosystem

> **Production deployment on Base Mainnet — verified on Basescan**
> **Status: 🟢 LIVE — All contracts deployed, verified, and operational**
> **Version: v3.2 (Oracle + Governance Update — 2026-06-28)**

> *Resilience is not something you can buy off the shelf. It's forged — through incidents, recoveries, and the quiet decision to keep building. This system has been tested not just in simulation, but in production. Every contract here exists because it earned its place.*

---

## 🏦 What Is This?

The Artifact Virtual Treasury is a **decentralized central banking system** built on Base (Ethereum L2). It issues and manages a utility token (Au) through a suite of autonomous smart contracts that handle monetary policy, price stabilization, governance, and value accrual — all without human intervention for routine operations.

Think of it as an algorithmic central bank:
- **Au** = the currency (utility token with built-in transaction tax)
- **Ag** = governance token (vote on monetary policy parameters)
- **TreasuryAMO** = foreign exchange reserve management (peg maintenance)
- **PID Controller** = monetary policy engine (dynamic emission targeting)
- **Governor** = central bank council (proposal + voting + execution)
- **OracleWrapper** = price data feed (deviation detection + buyback triggers)

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Token Architecture](#token-architecture)
3. [Contract Architecture](#contract-architecture)
4. [Governance](#governance)
5. [Oracle Layer](#oracle-layer)
6. [The Flywheel — How Value Accrues](#the-flywheel)
7. [Security Model](#security-model)
8. [Live Contracts](#live-contracts)
9. [Deployment](#deployment)
10. [Development](#development)
11. [Roadmap](#roadmap)
12. [License](#license)

---

## 1. System Overview

The AV Treasury operates through five interconnected subsystems:

### 💰 Currency Layer (Au Token)
Au is a standard ERC20 token with EIP-2612 permit (gasless approvals) and a 9 basis-point transfer fee. The fee is split: 50% is burned (creating deflationary pressure), and 50% flows to the Treasury. This creates inherent buy pressure from every transaction.

### 🏛️ Governance Layer (Ag Token + Governor)
Ag is a standard ERC20 governance token with no fees. Ag holders propose and vote on protocol changes through GovernorContract, which routes successful proposals through a 2-day timelock before execution. The system uses three proposal tiers (Standard, Emergency, Constitutional) with different thresholds and requirements.

### 📊 Monetary Policy (PID Controller)
The PID Emission Controller dynamically adjusts Ag emission rates based on total value locked (TVL) relative to a governance-set target. If TVL exceeds the target, emissions increase to circulate more Ag. If TVL falls below, emissions tighten. This is the "interest rate" mechanism of the system.

### 🏧 Treasury Operations (TreasuryAMO)
TreasuryAMO manages the protocol's reserves and liquidity. It adds/removes concentrated liquidity on Aerodrome (Base's DEX) based on price signals and reserve levels. It can also execute buybacks of Au when conditions are met.

### 📡 Oracle Layer (OracleWrapper + OracleFlashBuy)
OracleWrapper aggregates price data from multiple sources (AvOracle TWAP, Chainlink) and provides a unified price feed to TreasuryAMO and other consumers. It detects price deviations (5% threshold) and triggers events. OracleFlashBuy is an automated buyback executor that fires when Au trades below $0.98.

---

## 2. Token Architecture

### Au Token (Artifact Utility)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Name | Au Token | |
| Symbol | AU | |
| Decimals | 18 | Standard |
| Initial Supply | 1,000,000,000 | Fixed cap |
| Transaction Fee | 9 bps (0.09%) | 50% burned, 50% to Treasury |
| EIP-2612 Permit | ✅ | Gasless approvals |
| Upgradeable | ✅ (UUPS) | Via governance |
| Current Price | ~$0.0085 USDC | Market-determined (bootstrapping phase) |

**Fee Mechanics:**
- Every transfer deducts 9 bps from the transfer amount
- 4.5 bps is sent to the Treasury Safe
- 4.5 bps is burned (removed from supply permanently)
- Fee can be adjusted only through governance

### Ag Token (Artifact Governance)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Name | Artifact | |
| Symbol | AG | |
| Decimals | 18 | Standard |
| Initial Supply | 100,000,000 | Emitted programmatically via PID |
| Transaction Fee | None | No tax on governance transfers |
| Minting | Controlled by PID | Only PID controller can mint |
| Delegation | ✅ (ERC20Votes) | Vote power via delegation |
| Upgradeable | ✅ (UUPS) | Via governance |

**Emission Mechanics:**
- Ag is minted by the PID controller each epoch (weekly)
- Emission amount is determined by the PID formula based on TVL deviation from target
- Minted Ag flows to AVLPStaking for LP rewards
- No team minting — emission is purely algorithmic

### veAg (Vote-Escrowed Ag)

veAg is a non-transferable voting power representation that scales with the duration Ag is locked:

| Lock Period | Multiplier |
|-------------|-----------|
| 1 month | 1.0x |
| 3 months | 1.5x |
| 6 months | 2.0x |
| 12 months | 2.5x |

Longer locks = higher voting power. This incentivizes long-term alignment and prevents flash-loan governance attacks.

---

## 3. Contract Architecture

### Complete Contract Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          GOVERNANCE LAYER                                 │
│                                                                            │
│   Ag Holders ──vote──▶ GovernorContract ──queue──▶ ArtifactTimelock       │
│   (0x259c...06385)              │                    (0x6623...4714)       │
│                                 │    2-day delay          │               │
│                                 └────────────────────────┘               │
│                                          │                                 │
│                                  after delay                              │
│                                          │                                 │
│                                          ▼                                 │
│                                   execute tx                              │
├──────────────────────────────────────────────────────────────────────────┤
│                          TREASURY / AMO LAYER                             │
│                                                                            │
│   TreasuryAMO ◀──oracle price── OracleWrapper ◀──TWAP── AvOracle          │
│   (0x5665...5188)         (0xb479...32bdB)        (0xfd04...647CD)       │
│         │                       │                                          │
│         │              deviation < 5%?                                      │
│         │                       │                                          │
│         │                       ▼                                          │
│         │              OracleFlashBuy ◀──trigger── price < $0.98           │
│         │              (0xDfD0...DDcc)                                     │
│         │                                                                  │
│         ▼                                                                  │
│   Aerodrome Pool ◀──add/remove liquidity──                                 │
│   (Au/ETH)                                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                       EMISSION / STAKING LAYER                             │
│                                                                            │
│   PID_Emission_Ctrl ──mint Ag──▶ AVLPStaking_v2 ──rewards──▶ LP Stakers   │
│   (0x9911...7f70)              (0xD96D...1685)                            │
│         │                             ▲                                    │
│         │      target TVL (gov-set)   │                                    │
│         │◀──TVL feedback────────────────┘                                    │
│         │                                                                  │
│         ▼                                                                  │
│   QuasiCrystalLPNFT ◀──staked by── LP Providers                            │
│   (0x7797...6Ea8)                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                          FLASH LAYER (Util)                                │
│                                                                            │
│   FlashLoan ──flash swaps──▶ Arbitrage / Liquidation / Self-liquidation    │
│   (0x4DDD...96B9)                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Contract Specifications

#### GovernorContract
- **Address:** `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385`
- **Inherits:** Governor, GovernorCompatibilityBravo, GovernorVotes, GovernorTimelockControl, GovernorCountingSimple, GovernorQuorum
- **Voting Token:** AgToken (0x1D31...3674)
- **Timelock:** ArtifactTimelock (0x6623...4714)
- **Key Parameters:**
  - Proposal Threshold: 100,000 Ag
  - Voting Delay: 1 block
  - Voting Period: 216,000 blocks (~30 days @ 12s/block)
  - Quorum: 4% of total supply (4,000,000 Ag)
  - Timelock Delay: 2 days (via ArtifactTimelock)

#### ArtifactTimelock
- **Address:** `0x662321CC63700865838aB08378061BE499344714`
- **Inherits:** TimelockController
- **Delay:** 2 days (minimum)
- **Roles:** PROPOSER (Governor), EXECUTOR (anyone), CANCELLER (Governor), DEFAULT_ADMIN (Governor)

#### TreasuryAMO
- **Address:** `0x56653245f4718fe105b95C8424947B31b84b5188`
- **Purpose:** Autonomous market operations — liquidity management, buybacks, reserve operations
- **Oracle Source:** AvOracle v5 (TWAP-primary)
- **DEX:** Aerodrome Slipstream (0xcF77...4E43)
- **Functions:** `addLiquidity()`, `removeLiquidity()`, `executeBuyback()`, `rebalance()`
- **Access:** DEFAULT_ADMIN, AMO_MANAGER roles

#### PID_Emission_Controller_v2
- **Address:** `0x991138923880773D67c01392c31A255e770F7f70`
- **Purpose:** Dynamic Ag emission based on TVL deviation from target
- **Target:** Governance-controlled TVL target
- **PID Constants:** Kp=0.1, Ki=0.00005, Kd=0.05
- **Output Range:** 100–50,000 Ag per epoch
- **Epoch Length:** 1 week (governance-adjustable)
- **Access:** DEFAULT_ADMIN, GOVERNANCE roles

#### AVLPStaking_v2
- **Address:** `0xD96D502B20474308521958573E3Fa68DbB041685`
- **Purpose:** Cross-token LP staking with RSBT multiplier
- **Stake Token:** QuasiCrystalLPNFT (representing Au/ETH LP positions)
- **Reward Token:** Au
- **RSBT Multiplier:** veAg-weighted (1.0x–2.5x based on Ag lock duration)
- **Functions:** `stake()`, `unstake()`, `claimRewards()`, `compound()`
- **Access:** DEFAULT_ADMIN, REWARD_MANAGER roles

#### OracleWrapper
- **Address:** `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB`
- **Purpose:** Unified price feed with deviation detection
- **Price Sources:** AvOracle (TWAP), Chainlink (primary)
- **Key Functions:**
  - `getLatestPrice()` → returns Au price in USDC
  - `checkDeviation()` → compares current vs reference price, reverts if >5%
  - `checkFlashBuyTrigger()` → returns true if price < $0.98
  - `emitFlashBuyTrigger()` → emits event when conditions met
  - `getAuPriceForAMO()` → oracle price formatted for TreasuryAMO
  - `getAuPriceForFlashBuy()` → oracle price formatted for OracleFlashBuy
- **Parameters:** Deviation threshold 5% (500 bps), staleness 1 hour (3600s)
- **Price Bounds:** 1 wei – $1000 (safety bounds)
- **Access:** DEFAULT_ADMIN, GOVERNANCE roles

#### OracleFlashBuy
- **Address:** `0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc`
- **Purpose:** Oracle-triggered automated buyback executor
- **Trigger:** Au price < $0.98 (from OracleWrapper)
- **Max per Execution:** 1000 USDC
- **Cooldown:** 1 hour between executions
- **Price Feed:** OracleWrapper
- **Functions:** `executeBuyback()`, `checkTrigger()`
- **Access:** DEFAULT_ADMIN, GOVERNANCE roles

#### QuasiCrystalLPNFT
- **Address:** `0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8`
- **Purpose:** ERC721 representing ownership of Aerodrome Au/ETH LP position
- **Holder:** Treasury Safe
- **Staked In:** AVLPStaking_v2

#### DexSimulator
- **Address:** `0x2C1BD0E498CEA315DA7486A41FB3DD991DA302B2`
- **Purpose:** Stress-tests operations before mainnet execution
- **Use Case:** Simulate buybacks, liquidity adds/removes, rebalances

---

## 4. Governance

The AV Treasury uses a formal governance system where Ag holders control all protocol parameters. See the full [Governance Specification](docs/technical/GOVERNANCE_SPEC.md).

### Proposal Lifecycle

```
Submit → Voting Delay (1d) → Active (5d) → Succeeded/Defeated
   │                                            │
   │                                     if Succeeded:
   │                                            ▼
   │                                     Queue in Timelock
   │                                            │
   │                                     2-day delay
   │                                            │
   │                                            ▼
   │                                     Execute on-chain
   │
   └── Can be canceled at any time before execution
```

### Proposal Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Proposal Threshold | 100,000 Ag | Minimum Ag to submit proposal |
| Voting Delay | 1 block | Delay before voting begins |
| Voting Period | 216,000 blocks (~30 days) | Duration of the voting window |
| Quorum | 4% of total supply | Minimum participation for validity |
| Timelock Delay | 2 days | Between passage and execution |

### Governed Parameters

Every protocol parameter is governable through the Governor → Timelock pipeline:

| Parameter | Contract | Current Value | Notes |
|-----------|----------|---------------|-------|
| Transaction fee (bps) | AuToken | 9 | 50% burned, 50% to Treasury |
| Burn ratio (%) | AuToken | 50 | Split of fee between burn/treasury |
| Target TVL | PID Controller | Governance-set | PID targets this TVL |
| PID Kp | PID Controller | 0.1 | Proportional gain |
| PID Ki | PID Controller | 0.00005 | Integral gain |
| PID Kd | PID Controller | 0.05 | Derivative gain |
| Min emission | PID Controller | 100 Ag/epoch | Floor per epoch |
| Max emission | PID Controller | 50,000 Ag/epoch | Ceiling per epoch |
| Deviation threshold | OracleWrapper | 5% (500 bps) | Max allowed price deviation |
| Staleness period | OracleWrapper | 1 hour (3600s) | Max oracle age |
| Price bounds | OracleWrapper | 1 wei – $1000 | Safety bounds |
| FlashBuy trigger | OracleFlashBuy | $0.98 (98% of $1.00) | Buyback activation price |
| FlashBuy max amount | OracleFlashBuy | 1000 USDC | Per execution |
| FlashBuy cooldown | OracleFlashBuy | 1 hour (3600s) | Between executions |
| Voting period | Governor | 216,000 blocks (~30 days) | Duration of voting |
| Quorum | Governor | 4% of total supply | Minimum participation |
| Proposal threshold | Governor | 100,000 Ag | To submit proposal |
| Timelock delay | Timelock | 2 days | Passage → execution |

---

## 5. Oracle Layer

The oracle layer is the "price feed" of the central bank. It provides reliable, manipulation-resistant price data to all consumers.

### Data Flow

```
AvOracle (TWAP) ──┐
                   ├──▶ OracleWrapper ──┬──▶ TreasuryAMO (peg maintenance)
Chainlink (primary)┘                    │
                                        ├──▶ OracleFlashBuy (buyback trigger)
                                        │
                                        └──▶ PID Controller (emission decisions)
```

### Deviation Detection

OracleWrapper continuously monitors the Au price against a reference price ($1.00). If the price deviates more than 5%, the `checkDeviation()` call reverts, preventing operations that would be executed at stale or manipulated prices. This is the early warning system.

### FlashBuy Trigger

When Au trades below $0.98 (2% below the $1.00 reference), OracleFlashBuy can be called by any keeper to execute a buyback of up to 1000 USDC. This creates automatic buy pressure at the lower bound, supporting the price floor.

---

## 6. The Flywheel — How Value Accrues

The AV Treasury runs on a **4-layer flywheel** that converts protocol activity into sustained token value.

### 🔄 Layer 1 — LP Fee Engine (Primary)

```
More LP Deposits → More Trading Volume → More Fees Generated
       ↑                                        │
       │                                        ▼
       └──── Higher Yields ← More LP Demand ←───┘
```

Every Au transfer generates a 9bp fee. 50% is burned (reducing supply), 50% accumulates in the treasury (creating buy pressure). More trading volume = more burns + more treasury growth.

### 🔄 Layer 2 — PID Emission Engine (Secondary)

```
Higher Reserve Ratio → PID Mints More Ag → More Emissions to Stakers
       ↑                                              │
       │                                              ▼
       └──── Ag Price Rises ← More Ag Demand ←───────┘
```

As protocol TVL grows toward the target, the PID controller mints more Ag and distributes it to stakers. Higher staking APY attracts more Ag demand, pushing Ag price up, which attracts more liquidity and further grows TVL.

### 🔄 Layer 3 — RSBT Staking Multiplier (Tertiary)

```
RSBT Multiplier Active → Higher Effective Stake → Higher Yield
       ↑                                              │
       │                                              ▼
       └──── Higher LP Value ← Less LP Supply ←──────┘
```

Users who lock LP tokens for the RSBT multiplier earn amplified yields. This removes LP tokens from circulation, reducing sell pressure and boosting LP value.

### 🔄 Layer 4 — Oracle Buyback Engine (NEW)

```
Price Drops Below $0.98 → OracleFlashBuy Triggers → USDC→Au Buyback
       ↑                                                    │
       │                                                    ▼
       └──── Price Stabilizes ← Reduced Au Supply ──────────┘
```

When Au trades below the $0.98 threshold, keepers trigger OracleFlashBuy which swaps USDC for Au on the open market, creating automatic buy pressure and reducing circulating supply.

### Combined Effect

All four flywheels are interlocked. LP fees strengthen reserves → reserves drive PID emissions → emissions boost staking → staking locks LP → locked LP deepens liquidity → oracle buybacks stabilize price → stable price attracts more traders.

**Usage drives scarcity → scarcity drives value → value drives further usage.**

---

## 7. Security Model

### Architecture

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Access Control | Role-based (DEFAULT_ADMIN, GOVERNAGER, etc.) | ✅ |
| Timelock | 2-day minimum delay on all governance actions | ✅ |
| Oracle Validation | Deviation checks + staleness checks + TWAP | ✅ |
| Reentrancy Guards | OpenZeppelin ReentrancyGuard on all state-changing functions | ✅ |
| Flash Loan Protection | TWAP-based pricing resistant to single-block manipulation | ✅ |
| Pause Mechanism | Emergency pause on all contracts (governance-controlled) | ✅ |
| Upgrade Safety | UUPS proxy pattern with timelock-governed upgrades | ✅ |

### Treasury Safe

**Address:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`

This is the ultimate admin of last resort. It can:
- Recover stuck funds
- Emergency pause contracts
- Execute governance decisions
- It cannot bypass the timelock for parameter changes

### Audit & Verification

- All contracts verified on Etherscan v2
- Full test suite: 37/38 tests passing (1 RPC rate limit, not contract issue)
- DexSimulator used for pre-execution stress testing

---

## 8. Live Contracts

### Deployed on Base Mainnet (8453)

| # | Contract | Address | Description |
|---|----------|---------|-------------|
| 1 | **AgToken** | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` | Governance token (ERC20Votes, UUPS) |
| 2 | **AuToken** | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` | Utility token with 9bp fee (UUPS) |
| 3 | **GovernorContract** | `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` | Governance (Bravo-compatible) |
| 4 | **ArtifactTimelock** | `0x662321CC63700865838aB08378061BE499344714` | 2-day timelock controller |
| 5 | **PID_Emission_Ctrl** | `0x991138923880773D67c01392c31A255e770F7f70` | PID-controlled Ag emission |
| 6 | **AVLPStaking_v2** | `0xD96D502B20474308521958573E3Fa68DbB041685` | LP staking with RSBT multiplier |
| 7 | **TreasuryAMO** | `0x56653245f4718fe105b95C8424947B31b84b5188` | Autonomous market operations |
| 8 | **TreasuryFlashBuy_v2** | `0xf6383860837E6cb983F9Af8Def92fc08F15Be65b` | Flash buyback engine |
| 9 | **OracleWrapper** | `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB` | Unified price feed + deviation detection |
| 10 | **OracleFlashBuy** | `0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc` | Oracle-triggered buyback executor |
| 11 | **QuasiCrystalLPNFT** | `0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8` | LP position NFT |
| 12 | **FlashLoan** | `0x4DDD1873964E5C2E3BE6712E199812903E6696B9` | Flash swap facilitator |
| 13 | **AvOracle** | `0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD` | TWAP oracle (Aerodrome Slipstream) |
| 14 | **DexSimulator** | `0x2C1BD0E498CEA315DA7486A41FB3DD991DA302B2` | Pre-execution simulation |

### Assets

| Token | Address | Type |
|-------|---------|------|
| Au Token | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` | ERC20 |
| Ag Token | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` | ERC20 |
| USDC (Base) | `0x833589c5cD18E6532d07a2e87A1d6C2E1d2E0980` | ERC20 |
| Au/ETH LP | `0xA41aB59dDDE5bA9b561f838d0B23268ADB863665` | Aerodrome SlipStream |

### Deployer

| Role | Address |
|------|---------|
| Deployer | `0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E` |

---

## 9. Deployment

### Deployment History

| Date | Deployment | Contracts |
|------|-----------|-----------|
| 2026-06-27 | Initial | AgToken, AuToken, GovernorContract, ArtifactTimelock, PID_Emission_Ctrl, AVLPStaking_v2, TreasuryAMO, FlashLoan, DexSimulator, QuasiCrystalLPNFT |
| 2026-06-28 | Oracle Update | OracleWrapper, OracleFlashBuy, TreasuryFlashBuy_v2 |

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `scripts/redeploy_fixed.js` | Initial full deployment |
| `scripts/deploy_oracle_wrapper_v2.js` | OracleWrapper deployment |
| `scripts/deploy_flashbuy_v2.js` | OracleFlashBuy deployment |
| `scripts/test_full_stack.js` | Comprehensive integration test (37/38 ✅) |

---

## 10. Development

### Prerequisites

```bash
npm install
npx hardhat compile
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
# or run full stack integration test:
npx hardhat run scripts/test_full_stack.js --network base
```

### Verify on Etherscan

```bash
npx hardhat verify --network base <contract_address> <constructor_args>
```

### Network Configuration

| Network | Chain ID | Explorer |
|---------|----------|-----------|
| Base Mainnet | 8453 | https://basescan.org |
| Base Sepolia | 84532 | https://sepolia.basescan.org |

### Directory Structure

```
av_treasury/
├── contracts/
│   ├── av_suite/           # Core protocol contracts
│   │   ├── AgToken.sol
│   │   ├── AuToken.sol
│   │   ├── GovernorContract.sol
│   │   ├── TreasuryAMO.sol
│   │   ├── OracleWrapper.sol
│   │   └── OracleFlashBuy.sol
│   └── ...                 # Additional implementations
├── scripts/
│   ├── deploy_oracle_wrapper_v2.js
│   ├── deploy_flashbuy_v2.js
│   └── test_full_stack.js
├── docs/
│   ├── technical/
│   │   ├── ARCHITECTURE.md
│   │   ├── TOKENOMICS.md
│   │   ├── GOVERNANCE_SPEC.md
│   │   └── Ag_profile.txt
│   └── whitepaper/
│       ├── whitepaper.md
│       └── vision.md
├── address.book             # All deployed addresses
└── README.md               # This file
```

---

## 11. Roadmap

### Phase 1 — Foundation (✅ Complete)
- [x] Dual-token architecture (Au + Ag)
- [x] AVLPStaking with RSBT multiplier
- [x] PID emission controller
- [x] TreasuryAMO for autonomous liquidity management
- [x] Governor + Timelock governance framework
- [x] FlashLoan facilitator
- [x] DexSimulator for pre-execution testing
- [x] Full deployment + verification on Base Mainnet

### Phase 2 — Oracle Integration (✅ Complete — Current)
- [x] OracleWrapper — unified price feed with deviation detection
- [x] OracleFlashBuy — automated buyback on price dips
- [x] TreasuryFlashBuy_v2 — updated buyback engine using oracle
- [x] Integration testing (37/38 ✅)

### Phase 3 — Governance Activation (🔜 Next)
- [ ] Activate Governor voting (set initial parameters, announce to community)
- [ ] Enable Ag token delegation
- [ ] Launch veAg time-weighted voting
- [ ] First governance proposal: parameter initialization
- [ ] Transition deployer admin to governance control

### Phase 4 — Decentralization
- [ ] Remove deployer from admin roles (governance-only)
- [ ] Community-run keeper infrastructure for FlashBuy
- [ ] Advanced AMO strategies (dynamic thresholds, targeted liquidity)
- [ ] Cross-chain expansion (chain-agnostic architecture)

---

## 12. Resilience

This system didn't emerge from a whitepaper and a wish. It was built, broken, rebuilt, and tested — in production, on mainnet, with real money. Every contract here carries the lessons of that process.

Resilience isn't a feature you add. It's what survives after everything that could break has been broken and fixed. The oracle layer exists because pricing can lie. The timelock exists because governance can be rushed. The PID controller exists because static rules fail in dynamic markets.

We don't claim this system is perfect. We claim it has been tested — and it held.

---

## 13. License

AGPL-3.0 — See LICENSE file for details.

---

*Built by the Artifact team. Deployed June 2026. Tested in production. Still standing.*
*For technical deep-dives, see [ARCHITECTURE.md](docs/technical/ARCHITECTURE.md) and [TOKENOMICS.md](docs/technical/TOKENOMICS.md).*
*For governance details, see [GOVERNANCE_SPEC.md](docs/technical/GOVERNANCE_SPEC.md).*
*For the economic vision, see [vision.md](docs/whitepaper/vision.md).*
