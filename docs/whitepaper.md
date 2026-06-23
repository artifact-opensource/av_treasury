# AV Treasury — Whitepaper

*A Self-Sustaining, Self-Governing Economic Organism*

**Version:** 1.0 — June 2026
**Deployer:** `0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E`
**Treasury:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`
**Chain:** Base Mainnet (chainId 8453)

---

## Abstract

The AV Treasury is a decentralized economic system built on a dual-token architecture that separates utility from governance. The system captures value from every interaction through a 9 basis-point transfer fee on its utility token (Au), recycles captured value through automated buybacks, and governs itself through a PID-controlled emission schedule for its governance token (Ag). The two tokens are bound by a cross-token staking multiplier: Ag holdings amplify Au staking yields, creating a mathematical link between governance participation and utility demand. The result is a self-reinforcing flywheel where usage drives scarcity, scarcity drives value, and value drives further usage.

This whitepaper presents the complete system design — economic, technical, and governance — as a unified whole. Every mechanism traces back to six core principles: self-preservation, programmatic balance, usage-derived value, liquidation by design, zero trust, and future-proofing.

---

## 1. Introduction

### 1.1 The Problem

Decentralized finance has produced thousands of token models. Almost all of them share the same failure mode: emissions create short-term liquidity, followed by supply inflation, followed by price collapse. The problem was never a lack of capital. It was a lack of mechanism design.

The core challenge: how does a decentralized system create a self-sustaining economy where:

a) Value accrues to participants without relying on continuous external capital inflows
b) The system resists mercenary capital and extractive behavior
c) Governance power concentrates among participants with the longest time horizons
d) Every interaction leaves value behind

### 1.2 The Solution

The AV Treasury addresses this through seven integrated mechanisms:

1. **Dual-token model** — Au (utility) and Ag (governance) serve distinct, non-overlapping functions
2. **Cross-token sink** — Au staking rewards are multiplied by Ag holdings, creating mathematical demand linkage
3. **PID-controlled emission** — Ag supply expands or contracts based on TVL relative to target, preventing both inflation and stagnation
4. **Deflationary burn** — 50% of all Au transfer fees are burned, creating continuous supply reduction
5. **Automated buybacks** — TreasuryAMO executes programmatic buybacks using reserve tokens, creating constant buy pressure
6. **Algorithmic governance** — A GovernorContract with timelock, quorum, and supermajority requirements ensures decentralized control
7. **Hardened security** — Post-EIP-7702 architecture with role-based access control, rate caps, and emergency stops

---

## 2. Dual-Token Model

### 2.1 Au — Artifact Utility

Au is the fuel of the AV ecosystem. It is required for all operations: AI compute, transactions, liquidity provision, and governance participation.

| Property | Value |
|---|---|
| Symbol | Au |
| Name | Artifact Utility |
| Standard | ERC20 + EIP-2612 Permit |
| Total Supply | 1,000,000,000 (1 billion, fixed) |
| Decimals | 18 |
| Upgradeability | UUPS proxy |

**Fee Mechanism:**
- Transfer fee: 9 bps (0.09%) per transfer
  - 4.5 bps (50%) → burned permanently
  - 4.5 bps (50%) → accumulated fees (withdrawable by treasury)
- Flash mint fee: 9 bps (same as transfer fee)
- Max flash mint: 1,000,000 Au
- Fee cap: 500 bps hard ceiling (governance-adjustable up to cap)

**Genesis Distribution:**

| Allocation | Amount | Recipient |
|---|---|---|
| Deployer (for LP) | 999,000,000 Au | `0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E` |
| Staking Fund | 300,000 Au | AVLPStaking_v2 |
| Treasury/Ops | 700,000 Au | `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e` |
| **Total** | **1,000,000,000 Au** | |

Fees are disabled during initial distribution to ensure exact amounts arrive at each destination, then enabled after all transfers complete.

### 2.2 Ag — Artifact Governance

Ag is the power token. It provides programmatic influence over the system: governance voting, staking multiplier qualification, and protocol parameter control.

| Property | Value |
|---|---|
| Symbol | Ag |
| Name | Artifact Governance |
| Standard | ERC20 + ERC20Votes (checkpoints, delegation) |
| Max Supply | 100,000,000 (100 million) |
| Decimals | 18 |
| Upgradeability | UUPS proxy |

**Emission:**
- No genesis mint. All Ag is emitted through the system.
- MINTER_ROLE: AVLPStaking_v2 and PID_Emission_Controller_v2 only
- PID-controlled, TVL-targeted emission schedule
  - TVL < target → higher emissions (incentivize staking)
  - TVL > target → lower emissions (prevent inflation)
- Daily emission cap: 100,000 Ag
- Single emission cap: 10,000 Ag

**Staking Rewards (Au + Ag per block):**
- Au reward: 0.001 Au/block
- Ag reward: 0.0001 Ag/block
- Rate changes: 48-hour timelock

**Staking Multiplier (Ag-Based):**

The staking yield is multiplied based on the staker's Ag holdings:

```
multiplier = 10000 + (15000 * agBalance) / threshold
```

Where `threshold = 5,000 Ag`. At this balance, the multiplier reaches its maximum of 2.5x. This creates the cross-token sink: demand for yield → demand for Ag → Ag scarcity → system value.

---

## 3. The Flywheel Mechanism

The AV Treasury's flywheel is a positive feedback loop that creates self-sustaining value accretion:

```
User buys Au from DEX
       ↓
User spends Au on AI compute / ecosystem services
       ↓
Au transfer fee: 9 bps
  ├── 4.5 bps → BURNED (Au supply decreases)
  └── 4.5 bps → ACCUMULATED FEES (withdrawable by treasury)
       ↓
Treasury withdraws fees → mints Au to treasury
       ↓
TreasuryAMO executes buyback:
  Reserve tokens → DEX → Buy Au → Treasury holds Au
       ↓
Stakers stake LP NFTs → earn Au + Ag
  ├── Au reward: 0.001/block
  └── Ag reward: 0.0001/block × Ag multiplier (1x–2.5x)
       ↓
PID controller monitors TVL:
  TVL < target → emit more Ag (incentivize staking)
  TVL > target → emit less Ag (prevent inflation)
       ↓
Ag holders govern:
  Propose → Vote → Queue (48h timelock) → Execute
       ↓
Governance adjusts system parameters:
  Fees, emission rates, treasury allocation, buyback aggressiveness
       ↓
System grows → More usage → More fees → More buybacks → More scarcity
       ↓
LOOP CLOSES
```

### 3.1 Cross-Token Sink

The critical innovation binding Au and Ag is the cross-token sink. To maximize staking rewards on Au, users must hold Ag. The staking multiplier increases with Ag holdings up to 2.5x at 5,000 Ag.

This creates mathematical arbitrage:
- Demand for Au yield increases demand for Ag
- Ag value is derived from system growth and scarcity
- Au value is derived from protocol usage
- Protocol usage requires Au
- Demand for Au increases

### 3.2 PID-Controlled Emission

The PID Emission Controller continuously adjusts Ag emission based on the gap between current TVL and target TVL:

```
emission(t) = kp * error(t) + ki * ∫error(t)dt + kd * d(error)/dt
```

Where `error(t) = target_TVL - current_TVL`. The PID parameters (kp, ki, kd) are bounded between 1e12 and 1e18, with integral decay of 99/100 per update to prevent windup. This ensures the system self-regulates: when TVL is below target, emissions increase to incentivize staking; when TVL exceeds target, emissions decrease to preserve Ag scarcity.

---

## 4. Contract Architecture

The system is implemented across eight core contracts:

### 4.1 AuToken
- ERC20Upgradeable + ERC20PermitUpgradeable + ERC20FlashMintUpgradeable
- AccessControlUpgradeable + ReentrancyGuardUpgradeable + PausableUpgradeable + UUPSUpgradeable
- Fee logic in `_transfer()` override
- Flash mint fee via `_flashFee()` override
- Blocklist, cooldown, max tx/wallet guards in `_beforeTokenTransfer()`
- On-chain SVG tokenURI (embedded, no external hosting)

### 4.2 AgToken
- ERC20Upgradeable + ERC20PermitUpgradeable + ERC20VotesUpgradeable
- AccessControlUpgradeable + ReentrancyGuardUpgradeable + UUPSUpgradeable
- Mint restricted to MINTER_ROLE (Staking + PID controller only)
- Required overrides for ERC20Votes (_afterTokenTransfer, _mint, _burn)

### 4.3 ArtifactTimelock
- Wraps OpenZeppelin TimelockController
- MIN_DELAY: 48 hours | MAX_DELAY: 30 days | GRACE_PERIOD: 14 days

### 4.4 AVLPStaking_v2
- Stake LP NFTs, earn Au + Ag rewards
- Ag-based multiplier: 1x to 2.5x based on staker's Ag balance
- Rate change timelock: 48 hours
- Rate caps: 1000 Au/block, 100 Ag/block
- NFT recovery for stuck tokens

### 4.5 PID_Emission_Controller_v2
- PID parameters: kp, ki, kd (bounded: 1e12 to 1e18)
- Target TVL: configurable (default 10,000,000)
- Integral decay: 99/100 per update
- Max integral: 1e24
- Daily emission cap: 100,000 Ag | Single emission cap: 10,000 Ag
- Emergency stop toggle

### 4.6 TreasuryAMO
- Automated buybacks: 20% of reserves above runway, 24h cooldown
- TWAP price validation: max 5% deviation
- Slippage protection: max 0.5%
- Per-epoch cap: 5% of reserve
- Dual DEX support: Aerodrome (primary) + Uniswap (backup)

### 4.7 GovernorContract
- Voting delay: 1 block
- Voting period: 216,000 blocks (~3 days at 12s/block)
- Proposal threshold: 100,000 Ag
- Quorum: 4% of total supply
- Standard approval: 66% | Critical approval: 80%
- Timelock: 48 hours

### 4.8 MockLPNFT
- ERC721 + ERC721Enumerable + Ownable
- For testing and initial bootstrapping (replaced by real Aerodrome LP NFTs in production)

---

## 5. Security Architecture

### 5.1 Post-EIP-7702 Hardening

The June 2026 EIP-7702 incident is the security baseline. The AV Treasury is hardened against this class of attack:

- No `authorize` or `approve` patterns exploitable via EIP-7702
- All state changes require explicit function calls with access control
- No batch operations exploitable atomically
- No delegatecall to user-controlled addresses

### 5.2 Access Control Matrix

| Role | Contract | Capability |
|---|---|---|
| MINTER_ROLE | AuToken | Mint tokens (renounced after setup) |
| ANTI_BOT_ROLE | AuToken | Block addresses, manage cooldown |
| DEFAULT_ADMIN_ROLE | AuToken, AgToken | Transferable to DAO |
| MINTER_ROLE | AgToken | Mint via Staking + PID only |
| UPGRADER_ROLE | AgToken | Execute upgrades (DAO only) |
| PROPOSER_ROLE | Timelock | Create governance proposals |
| EXECUTOR_ROLE | Timelock | Execute passed proposals |

### 5.3 Economic Security

- Rate caps on all emissions and reward changes
- 48-hour timelock on parameter changes
- Max transaction: 1% of Au supply per transaction
- Max wallet: 1% of Au supply per wallet
- Flash mint cap: 1,000,000 Au
- Daily Ag emission cap: 100,000
- Emergency stop on PID controller
- Pausable on all critical contracts

### 5.4 Upgrade Security

- UUPS proxy pattern
- 7-day upgrade announcement delay
- Only UPGRADER_ROLE can execute upgrades
- Storage layout preserved across upgrades

---

## 6. Governance

### 6.1 Structure

The AV Treasury is governed by Ag holders through a GovernorContract with the following parameters:

| Parameter | Value |
|---|---|
| Governance Token | Ag (with ERC20Votes delegation) |
| Proposal Threshold | 100,000 Ag |
| Quorum | 4% of total supply |
| Standard Approval | 66% |
| Critical Approval | 80% |
| Voting Delay | 1 block |
| Voting Period | 216,000 blocks (~3 days) |
| Timelock | 48 hours |

### 6.2 Proposal Lifecycle

1. **Propose** — Any address with ≥100,000 Ag can submit a proposal
2. **Vote** — Ag holders (or their delegates) vote during the voting period
3. **Queue** — If quorum and approval thresholds are met, the proposal enters the 48-hour timelock
4. **Execute** — After the timelock, anyone can execute the proposal

### 6.3 Decentralization Roadmap

| Phase | Milestone | Status |
|---|---|---|
| 1 (0-25%) | Architecture and core deployment | Current |
| 2 (25-50%) | Liquidity bootstrapping and flywheel activation | Planned |
| 3 (50-75%) | Treasury automation (AMO + PID) | Planned |
| 4 (75-90%) | Decentralized governance (Governor live) | Planned |
| 5 (90-100%) | Full autonomy (admin renounced) | Planned |

---

## 7. Deployment

### 7.1 Chain Configuration

| Parameter | Value |
|---|---|
| Chain | Base Mainnet |
| Chain ID | 8453 |
| Solidity | 0.8.20 |
| Framework | Hardhat |
| Optimizer | Enabled, 200 runs |
| EVM Version | paris |
| License | MIT |

### 7.2 Deploy Order

1. **AuToken** — No dependencies
2. **AgToken** — No dependencies
3. **MockLPNFT** — No dependencies
4. **ArtifactTimelock** — Configure proposer, canceler, executor
5. **AVLPStaking_v2** — Wire Au, Ag, NFT
6. **PID_Emission_Controller_v2** — Set admin
7. **TreasuryAMO** — Wire Au, reserveToken, router
8. **GovernorContract** — Wire Ag, Timelock

### 7.3 Wiring

- Timelock: Governor gets PROPOSER + EXECUTOR roles
- AgToken: MINTER_ROLE → Staking + PID
- Staking: setRewardRates(Au/block, Ag/block)
- PID: setAuToken, setAgToken, setStaking, setTargetTVL

---

## 8. Risk Factors

### 8.1 Smart Contract Risk
Complexity increases attack surface. Mitigation: multiple tier-1 audits, formal verification of core math, permanent bug bounty.

### 8.2 Demand Drop Risk
If Au usage declines, fee revenue falls, buybacks slow, and the flywheel decelerates. Mitigation: Treasury runway reserve, adjustable fees, PID emission floor.

### 8.3 Liquidity Spiral Risk
The flywheel is pro-cyclical. A sustained downturn could break the positive feedback loop. Mitigation: 24-month runway reserve, dynamic emission floor, emergency pause.

### 8.4 Oracle Risk
Oracle failure could produce incorrect PID parameters or buyback prices. Mitigation: TWAP validation with 5% deviation threshold, dual DEX support.

### 8.5 Governance Risk
Governance capture or apathy could paralyze the system. Mitigation: time-weighted voting, 48-hour timelock, delegation program, optimistic governance for routine changes.

### 8.6 Regulatory Risk
Ag may attract securities regulation. Mitigation: progressive decentralization, legal DAO wrapper, utility-first design.

---

## 9. What This System Is NOT

- **Not a company** — No equity, no revenue, no profit
- **Not a stablecoin** — Au price is market-determined
- **Not a lending protocol** — No borrowing, no interest rates
- **Not a governance-only token** — Ag has programmatic power, not just voting
- **Not a ponzi** — Value derives from usage, not from new deposits

## 10. What This System IS

A self-sustaining economic organism that:

1. Requires Au for all operations (utility)
2. Distributes Ag based on contribution and time (governance)
3. Captures value from every interaction (fees)
4. Recycles captured value back into the system (buybacks)
5. Self-regulates through algorithmic control (PID)
6. Governs itself through decentralized voting (DAO)
7. Evolves through upgradeable architecture (UUPS)
8. Protects itself through hardened security (post-EIP-7702)

---

## 11. Future Integration

### 11.1 Shard (SBT) System
Entity attestation layer on top of Au/Ag. Soulbound tokens representing verified agents/entities. Au serves as gas for Shard operations; Ag governs Shard protocol parameters.

### 11.2 AI Compute Layer
Dapps consume Au for AI compute services. Au spent on compute enters the fee mechanism, driving the flywheel. Ag governs compute pricing, resource allocation, and model selection.

### 11.3 DEX Liquidity
Au/ETH or Au/USDC pools on Aerodrome. LP tokens staked in AVLPStaking_v2 earn Au + Ag. TreasuryAMO maintains constant buyback pressure.

---

*This whitepaper is the public face of the AV Treasury system. For technical details, see the architecture and tokenomics documents. For security analysis, see the security document. For mathematical formalization, see the flywheel analysis.*

*This document does not constitute financial, legal, or investment advice.*

---

**Author:** OWL (on behalf of Ali)
**Date:** June 23, 2026
**Status:** v1.0 — Publication Ready
