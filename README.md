# Artifact Virtual Treasury 
> ARC Subsystems v3.1 <br>
> Au/Ag dual_token Flywheel Ecosystem

> **Production deployment on Base Mainnet <br> verified on Etherscan v2**
> **Status: 🟢 LIVE <br> All contracts deployed, verified, and operational**

---

## Overview

The Artifact Virtual Treasury is a complete DeFi ecosystem built on Base, centered around two tokens:

- **Au (Artifact Utility)** — A utility token with a 9bps transaction fee (50% burned, 50% to treasury). Designed for low-friction trading and sustainable buy pressure.
- **Ag (Artifact Governance)** — A governance token with no fees, no minting. Used for staking rewards and protocol governance.

The system is fully autonomous: all market operations, emissions, and liquidity management run through smart contracts. No human intervention required for routine operations.

---

## Live Contracts (10/10 Verified)

| # | Contract | Address | Description |
|---|----------|---------|-------------|
| 1 | **QuasiCrystalLPNFT** | `0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8` | ERC721 representing ownership of the Aerodrome Au/ETH LP position |
| 2 | **AVLPStaking_v2** | `0x8F638B6C2EBD61A638561B6993930CF25D53ACB9` | Staking contract — deposit LP NFTs, earn Au + Ag rewards |
| 3 | **PID_Emission_Ctrl** | `0xB8F240870DBc1cD5F9262F8180350A29ea404268` | Dynamic emission controller — adjusts rewards based on TVL targets |
| 4 | **ArtifactTimelock** | `0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77` | Governance timelock — queues and executes protocol changes |
| 5 | **GovernorContract** | `0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03` | Governance contract — proposals, voting, and execution |
| 6 | **FlashLoan** | `0x4DDD1873964E5C2E3BE6712E199812903E6696B9` | Flash loan facilitator — enables zero-collateral Au/Ag flash swaps |
| 7 | **TreasuryFlashBuy** | `0xCE73711EE793AF348837C09B729680B12DF6D8C0` | On-chain buyback engine — executes large Au buybacks from the treasury |
| 8 | **AvOracle** | `0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D` | Decentralized oracle — V3 native TWAP (Aerodrome Slipstream). AU price live. |
| 9 | **DexSimulator** | `0x2C1BD0E498CEA315DA7486A41FB3DD991DA302B2` | Simulation infrastructure — stress-tests operations before mainnet execution |
| 10 | **TreasuryAMO** | `0xF096cD4D24811B0F824c929907196bCB796bca88` | Autonomous Market Operations — manages liquidity, buybacks, and reserves |

### Assets

| Token | Address | Description |
|-------|---------|-------------|
| **Au Token** | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` | Utility token with 9bps fee |
| **Ag Token** | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` | Governance token |
| **Au/ETH LP** | `0xA41aB59dDDE5bA9b561f838d0B23268ADB863665` | Aerodrome SlipStream pool |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Treasury Safe (Multisig)                   │
│            0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e         │
│                Owns & controls all contracts                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ Governor  │   │  Timelock  │    │ Treasury  │
    │ Contract  │──▶│ (executor) │    │   Safe    │
    └───────────┘   └───────────┘    └───────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼──────┐
    │ Treasury  │   │    PID     │   │    Av      │
    │   AMO     │   │ Controller │   │  Oracle    │
    └─────┬─────┘   └─────┬─────┘   └────────────┘
          │               │
    ┌─────▼─────┐   ┌─────▼─────┐
    │  Staking  │◀──│   Flash   │
    │  + NFT    │   │   Buy     │
    └───────────┘   └───────────┘
          │
    ┌─────▼─────┐
    │   Flash   │
    │   Loan    │
    └───────────┘
```

### How It Works

1. **Trading**: Users trade Au on Aerodrome. Each transaction incurs a 9bps fee — 50% is burned (deflationary), 50% goes to the Treasury Safe.

2. **Buybacks**: TreasuryFlashBuy monitors conditions and executes large Au buybacks from treasury reserves when the price dips below thresholds set by the PID controller.

3. **Staking**: LP NFT holders stake their NFTs in AVLPStaking_v2 and earn Au + Ag rewards. The PID controller dynamically adjusts emission rates based on TVL targets.

4. **Governance**: Ag token holders create proposals through GovernorContract. Proposals are queued in ArtifactTimelock (with configurable delay) and executed on-chain if they pass voting.

5. **AMO Operations**: TreasuryAMO autonomously manages Aerodrome liquidity — adding/removing liquidity based on reserve levels and price signals.

6. **Price Feeds**: AvOracle provides accurate Au/Ag price data from Chainlink (primary) and TWAP from Aerodrome pools (fallback).

---

## Security

| Measure | Status |
|---------|--------|
| All contracts verified on Etherscan v2 | ✅ |
| Treasury Safe (multisig) owns all contracts | ✅ |
| Deployer keys removed from all admin roles | ✅ |
| No proxy admin backdoors | ✅ |
| No open mint functions | ✅ |
| All parameters adjustable only via governance | ✅ |
| Flash loan reentrancy protection | ✅ |
| Oracle has dual-source price validation | ✅ |

### Treasury Safe

**Address:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`

This multisig wallet is the sole owner of every protocol contract. All administrative operations (parameter changes, emissions adjustments, reserve management) require multisig approval. No single address can unilaterally modify protocol behavior.

---

## Token Parameters

### Au Token (Artifact Utility)

| Parameter | Value |
|-----------|-------|
| Name | Au Token |
| Symbol | Au |
| Decimals | 18 |
| Transaction Fee | 9 bps (50% burn, 50% treasury) |
| Max Wallet | 10% of supply |
| Max Transaction | 1% of supply |

### Ag Token (Artifact Governance)

| Parameter | Value |
|-----------|-------|
| Name | Artifact |
| Symbol | AG |
| Decimals | 18 |
| Fees | None |
| Minting | Disabled after deploy |

---

## Aerodrome Pool

The primary trading venue for Au is the Au/ETH pool on Aerodrome (Base):

- **Pool Address:** `0xA41aB59dDDE5bA9b561f838d0B23268ADB863665`
- **Fee Model:** SlipStream concentrated liquidity
- **Initial Liquidity:** 100K Au + matching ETH
- **LP NFT:** Owned by Treasury Safe (`0x7797cb...6Ea8`)

---

## Roadmap

### Phase 1 — Current (✅ Live)
- [x] Full contract deployment and verification
- [x] Treasury Safe ownership
- [x] Governor + Timelock wired
- [x] Staking configured with PID controller
- [x] FlashBuy buyback engine deployed
- [x] AvOracle with dual-source feeds
- [x] DexSimulator for testing

### Phase 2 — Active Development
- [ ] **Anvil Wallet** — Smart wallet with integrated DApps, built for the Au ecosystem
- [ ] **Oracle activation** — Configure and activate Chainlink/TWAP price feeds
- [ ] **Governance launch** — Set voting parameters (delay, period, quorum) and go live
- [ ] **AMO calibration** — Fine-tune buyback thresholds and liquidity targets

### Phase 3 — Growth
- [ ] **Bot trading engine** — Automated market-making for baseline liquidity
- [ ] **Cross-chain expansion** — Architecture is chain-agnostic
- [ ] **Advanced AMO strategies** — Dynamic buyback thresholds, targeted liquidity

---

## Development

### Prerequisites

```bash
npm install
```

### Compile

```bash
npx hardhat compile
```

### Deploy (Full Stack)

```bash
npx hardhat run scripts/redeploy_fixed.js --network base
```

### Verify

```bash
npx hardhat verify --network base <contract_address> <constructor_args>
```

### Test

```bash
npx hardhat test
```

### Network Configuration

| Network | Chain ID | RPC |
|---------|----------|-----|
| Base Mainnet | 8453 | Configured in hardhat.config.js |

---

## License

AGPL-3.0 — See LICENSE file for details.

---

*Built by the Artifact team. Deployed June 2026.*
