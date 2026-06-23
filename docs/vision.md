# AV Treasury — System Vision

> The definitive blueprint. Every contract, every mechanism, every line of code traces back to this document.

---

## I. Purpose

The AV Treasury system is a self-sustaining, self-governing economic organism. It exists to grow in value and to make everything connected to it more valuable. It is not a company. It is not a product. It is a living system with one directive: **benefit the design.**

The system has two tokens:
- **Au (Artifact Utility)** — the fuel. Required for all operations within the ecosystem: AI compute, transactions, liquidity provision, governance participation. Fixed supply. Deflationary.
- **Ag (Artifact Governance)** — the power. Programmatic influence over the system. Non-linear accumulation. Algorithmically balanced distribution. The system controls who has power and how much.

---

## II. Design Principles

### 1. Self-Preservation
Every mechanism must strengthen the system first. Value flows to token holders only because the system is healthy, not despite it. The system optimizes for its own sustainability before any external benefit.

### 2. Programmatic Balance
No human — not the deployer, not the DAO, not a whale — should be able to unilaterally control the system. Power (Ag) is distributed algorithmically. The system adjusts emission, multipliers, and thresholds to prevent concentration.

### 3. Usage-Derived Value
Au has value because it is required for real economic activity (AI compute, gas, liquidity). The more the system is used, the more Au is consumed. Scarcity is earned through utility, not manufactured through hype.

### 4. Liquidation by Design
The system captures value from every interaction. Fees, burns, buybacks, and emissions all serve one purpose: making the system more valuable over time. Every token that moves through the system leaves value behind.

### 5. Zero Trust
The system assumes every participant is adversarial. Every contract is hardened against theft, manipulation, and exploitation. The June 2026 EIP-7702 incident is the baseline — the system must be stronger than the attack that compromised it.

### 6. Future-Proof
The system is designed to evolve. UUPS upgradeability, modular architecture, and algorithmic governance mean the system can adapt without human intervention. What we deploy in June 2026 is the foundation, not the ceiling.

---

## III. Token Architecture

### Au — Artifact Utility

**Properties:**
- Symbol: Au
- Name: Artifact Utility
- Standard: ERC20 with EIP-2612 Permit
- Total Supply: 1,000,000,000 (1 billion, fixed, no further minting)
- Decimals: 18
- Upgradeability: UUPS proxy

**Fee Mechanism:**
- Transfer fee: 9 bps (0.09%)
  - 50% burned (deflationary sink)
  - 50% to accumulated fees (withdrawable by treasury/admin)
- Flash mint fee: 9 bps (same as transfer fee)
- Max flash mint: 1,000,000 Au
- Fee cap: 500 bps (5% hard ceiling, governance-adjustable up to cap)

**Access Control:**
- MINTER_ROLE: deployer at initialization, renounced after setup
- ANTI_BOT_ROLE: deployer at initialization, transferable to DAO
- DEFAULT_ADMIN_ROLE: deployer at initialization, transferable to DAO

**Security:**
- Blocklist: ANTI_BOT_ROLE can block addresses
- Cooldown: Anti-bot sell cooldown (configurable, max 7 days)
- Max transaction: 1% of supply per transaction
- Max wallet: 1% of supply per wallet
- Pausable: Emergency pause by admin

**Distribution (Genesis):**
| Allocation | Amount | Recipient |
|---|---|---|
| Deployer (for LP) | 999,000,000 Au | Deployer wallet |
| Staking Fund | 300,000 Au | AVLPStaking_v2 |
| Treasury/Ops | 700,000 Au | Treasury multisig |
| **Total** | **1,000,000,000 Au** | |

Fees are disabled during initial distribution, then enabled after all transfers are complete. This ensures exact amounts arrive at each destination.

### Ag — Artifact Governance

**Properties:**
- Symbol: Ag
- Name: Artifact Governance
- Standard: ERC20 with ERC20Votes (checkpoints, delegation, historical lookups)
- Max Supply: 100,000,000 (100 million)
- Decimals: 18
- Upgradeability: UUPS proxy

**Emission:**
- No genesis mint. All Ag is emitted through the system.
- MINTER_ROLE: granted to AVLPStaking_v2 and PID_Emission_Controller_v2 only
- Emission schedule: PID-controlled, TVL-targeted
  - When TVL < target: higher emissions (incentivize staking)
  - When TVL > target: lower emissions (prevent inflation)
  - Daily emission cap: 100,000 Ag
  - Single emission cap: 10,000 Ag
- Staking rewards: Au + Ag per block
  - Au reward: 0.001 Au/block
  - Ag reward: 0.0001 Ag/block
  - Rate changes: 48-hour timelock

**Staking Multiplier (Ag-Based):**
The staking yield is multiplied based on the staker's Ag holdings:
- multiplier = 1x to 2.5x
- Formula: `multiplier = 10000 + (15000 * agBalance) / threshold`
- Threshold: 5,000 Ag (at this balance, multiplier = 2.5x)
- This creates the cross-token sink: demand for yield → demand for Ag → Ag scarcity → system value

**Access Control:**
- MINTER_ROLE: AVLPStaking_v2 + PID_Emission_Controller_v2
- UPGRADER_ROLE: DAO (GovernorContract)
- DEFAULT_ADMIN_ROLE: deployer at init, transferable to DAO

---

## IV. Contract Architecture

### 4.1 AuToken (contracts/av_suite/AuToken.sol)
- ERC20Upgradeable + ERC20PermitUpgradeable + ERC20FlashMintUpgradeable
- AccessControlUpgradeable + ReentrancyGuardUpgradeable + PausableUpgradeable + UUPSUpgradeable
- Fee logic in `_transfer()` override
- Flash mint fee via `_flashFee()` override
- Blocklist, cooldown, max tx/wallet guards in `_beforeTokenTransfer()`
- On-chain SVG tokenURI (embedded, no external hosting)

### 4.2 AgToken (contracts/av_suite/AgToken.sol)
- ERC20Upgradeable + ERC20PermitUpgradeable + ERC20VotesUpgradeable
- AccessControlUpgradeable + ReentrancyGuardUpgradeable + UUPSUpgradeable
- Mint restricted to MINTER_ROLE
- Required overrides for ERC20Votes (_afterTokenTransfer, _mint, _burn)

### 4.3 ArtifactTimelock (contracts/av_suite/TimelockController.sol)
- Wraps OZ TimelockController
- MIN_DELAY: 48 hours
- MAX_DELAY: 30 days
- GRACE_PERIOD: 14 days
- Constructor: (proposer, canceler, executor) — all deployer at init

### 4.4 AVLPStaking_v2 (contracts/av_suite/AVLPStaking_v2.sol)
- AccessControlUpgradeable + ReentrancyGuardUpgradeable + PausableUpgradeable + UUPSUpgradeable + IERC721ReceiverUpgradeable
- Stake LP NFTs, earn Au + Ag rewards
- Reward distribution: per-weight, per-block
- Ag-based multiplier: 1x to 2.5x based on staker's Ag balance
- Rate change timelock: 48 hours
- Rate caps: 1000 Au/block, 100 Ag/block
- NFT recovery: admin can recover stuck NFTs
- Dust accumulation and distribution

### 4.5 PID_Emission_Controller_v2 (contracts/av_suite/PID_Emission_Controller_v2.sol)
- AccessControl + ReentrancyGuard + Pausable
- PID parameters: kp, ki, kd (bounded: 1e12 to 1e18)
- Target TVL: configurable (default 10,000,000)
- Integral decay: 99/100 per update (prevents windup)
- Max integral: 1e24
- Daily emission cap: 100,000 Ag
- Single emission cap: 10,000 Ag
- Emergency stop: toggle by admin
- Two-step admin transfer
- TVL source: reads from staking contract

### 4.6 TreasuryAMO (contracts/av_suite/TreasuryAMO.sol)
- AccessControl + ReentrancyGuard + Pausable
- Automated buybacks: 20% of reserves above runway, 24h cooldown
- TWAP price validation: max 5% deviation
- Slippage protection: max 0.5%
- Per-epoch cap: 5% of reserve
- Dual DEX support: Aerodrome (primary) + Uniswap (backup)
- Emergency withdraw: when paused, admin can withdraw
- Reserve token: configurable (USDC, cbBTC, etc.)

### 4.7 GovernorContract (contracts/av_suite/GovernorContract.sol)
- OZ Governor + GovernorSettings + GovernorCountingSimple + GovernorVotes + GovernorVotesQuorumFraction + GovernorTimelockControl
- Voting delay: 1 block
- Voting period: 216,000 blocks (~3 days at 12s/block)
- Proposal threshold: 100,000 Ag
- Quorum: 4% of total supply
- Standard approval: 66%
- Critical approval: 80%
- Timelock: 48 hours (via ArtifactTimelock)

### 4.8 MockLPNFT (contracts/av_suite/MockLPNFT.sol)
- ERC721 + ERC721Enumerable + Ownable
- Mintable by owner (for testing and initial bootstrapping)
- In production, replaced by real Aerodrome LP NFTs

---

## V. The Flywheel (How Value Flows)

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

---

## VI. Security Architecture

### 6.1 Anti-Theft (Post EIP-7702)
- No `authorize` or `approve` patterns that can be exploited via EIP-7702
- All state changes require explicit function calls with access control
- No batch operations that could be exploited atomically
- No delegatecall to user-controlled addresses

### 6.2 Access Control
- Role-based: MINTER, ANTI_BOT, ADMIN, EXECUTOR, PARAM, EMIT, UPGRADER
- Two-step admin transfer for PID controller
- No single role can both mint and burn
- No single role can both pause and unpause without timelock

### 6.3 Economic Security
- Rate caps on all emissions and reward changes
- Timelock on parameter changes (48h)
- Max transaction/wallet limits on Au
- Flash mint cap (1M Au)
- Daily emission cap on Ag (100k)
- Emergency stop on PID controller
- Pausable on all critical contracts

### 6.4 Upgrade Security
- UUPS proxy pattern
- 7-day upgrade announcement delay
- Only UPGRADER_ROLE can execute upgrades
- Storage layout preserved across upgrades

---

## VII. Deployment Architecture

- **Chain:** Base mainnet (chainId 8453)
- **Solidity:** 0.8.20
- **Framework:** Hardhat
- **Compiler:** solc v0.8.20+commit.a1b79de6
- **Optimizer:** enabled, 200 runs
- **EVM Version:** paris
- **License:** MIT
- **Verification:** Etherscan V2 API (chainid=8453)

### Deploy Order
1. AuToken (no deps)
2. AgToken (no deps)
3. MockLPNFT (no deps)
4. ArtifactTimelock (proposer, canceler, executor)
5. AVLPStaking_v2 (needs Au, Ag, NFT)
6. PID_Emission_Controller_v2 (needs admin)
7. TreasuryAMO (needs Au, reserveToken, router)
8. GovernorContract (needs Ag, Timelock)

### Wiring
- Timelock: Governor gets PROPOSER + EXECUTOR roles
- AgToken: MINTER_ROLE → Staking + PID
- Staking: setRewardRates(Au/block, Ag/block)
- PID: setAuToken, setAgToken, setStaking, setTargetTVL

---

## VIII. Integration Points (Future)

### Shard (SBT) System
- Entity attestation layer on top of Au/Ag
- Soulbound tokens representing verified agents/entities
- Integration: Shard contracts can call Au/Ag for fee payment and staking
- Au is the gas/utility for Shard operations
- Ag governs Shard protocol parameters

### AI Compute Layer
- Dapp consumes Au for AI compute services
- Au spent on compute → enters fee mechanism → flywheel
- Ag governs compute pricing, resource allocation, model selection

### DEX Liquidity
- Au/ETH or Au/USDC pool on Aerodrome
- LP tokens → staked in AVLPStaking_v2 → earn Au + Ag
- TreasuryAMO maintains buyback pressure

---

## IX. What This System Is NOT

- Not a company — no equity, no revenue, no profit
- Not a stablecoin — Au price is market-determined
- Not a lending protocol — no borrowing, no interest rates
- Not a governance-only token — Ag has programmatic power, not just voting
- Not a ponzi — value derives from usage, not from new deposits

## X. What This System IS

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

*This document is the single source of truth. Every contract implements this vision. Every test validates this vision. Every deployment deploys this vision.*

*Author: ARTIFACT RESEARCH DIVISION
*Date: June 22, 2026*
*Status: IMPLEMENTED
