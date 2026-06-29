---
title: 10 — QuasiCrystal LP NFT & Staking
date: 2026-06-29
status: canonical
description: The QuasiCrystal LP NFT (ERC-721 with on-chain SVG art) and AVLPStaking_v2 contract. Covers minting, staking, Au+Ag rewards, Ag-balance multiplier, and anti-gaming measures.
category: central-banking
related: [01-dual-token-architecture.md, 03-emission-mechanics.md, 05-flywheel-mechanics.md, INDEX.md]
---

# 10 — QuasiCrystal LP NFT & Staking

## 10.1 Overview

Two contracts work together:

| Contract | Address | Purpose |
|----------|---------|---------|
| **QuasiCrystalLPNFT** | `0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8` | ERC-721 NFT representing LP positions |
| **AVLPStaking_v2** (Proxy) | `0xD96D502B20474308521958573E3Fa68DbB041685` | Stake LP NFTs, earn Au + Ag rewards |
| **AVLPStaking_v2** (Impl) | `0xE699960b6e81d00A42F8580004C8FBD72902806A` | Implementation (UUPS upgradeable) |

## 10.2 QuasiCrystalLPNFT (ERC-721)

### 10.2.1 Purpose

Each LP position is represented as a unique NFT with **on-chain SVG art**.
The visual appearance is derived from the position's parameters (reserves,
volatility, liquidity depth, time held) plus a random seed.

### 10.2.2 Position Parameters

```solidity
struct PositionParams {
    uint128 agReserve;        // Ag reserve in the position
    uint128 auReserve;        // Au reserve in the position
    uint128 liquidityAmount;  // Total liquidity
    uint32 volume24h;         // 24h trading volume
    uint8 volatilityIndex;    // Volatility score (0-100)
    uint8 liquidityDepth;     // Liquidity depth score
    uint16 timeHeld;          // Days position has been open
    uint32 openedAt;          // Timestamp opened
}
```

### 10.2.3 On-Chain Art

SVG generated via `QuasiCrystalSVG` library:
- Deterministic from position params + random seed
- Render params: maxSymmetry (13), maxLines (21), bleedFactor, diagonals, ringEcho
- Metadata JSON encoded as base64 data URI
- No external dependencies (fully on-chain)

### 10.2.4 Minting

- Only `MINTER_ROLE` can mint
- Each mint gets a unique random seed from `keccak256(blockhash, sender, tokenId, timestamp, gasprice)`
- Batch minting supported

### 10.2.5 Metrics

- `refreshMetrics(tokenId, tvlUSD, healthScore)` — owner or authorized source
- `CachedMetrics` stores TVL, health score (0-100), timestamp, validity
- `setAccumulatedTvl()` — METADATA_ROLE only, for aggregate TVL tracking

## 10.3 AVLPStaking_v2

### 10.3.1 Purpose

Stake QuasiCrystal LP NFTs to earn **Au + Ag rewards**.
Features an **Ag-balance multiplier** — stakers with more Ag earn more.

### 10.3.2 Rewards

| Token | Reward Rate | Max Rate |
|-------|------------|----------|
| Au | `auRewardPerBlock` | 1000 Au/block |
| Ag | `agRewardPerBlock` | 100 Ag/block |

Rates are governance-adjustable with a 48-hour timelock.

### 10.3.3 Ag Multiplier

The staking contract has an **Ag-balance multiplier** — NOT a veAg lock.
The multiplier is based on the staker's **current Ag balance**:

```
multiplier = 10000 + (15000 × agBalance) / agThreshold

Where:
  agThreshold = 5000 Ag (for max multiplier)
  max multiplier = 25000 (2.5x) — reached at ≥5000 Ag
  min multiplier = 10000 (1.0x) — at 0 Ag
```

**Key distinction:** This is NOT a veAg lock mechanism. The multiplier reads
the staker's **current Ag balance** at reward calculation time. No tokens
are locked. The staker can transfer Ag at any time, which would reduce
their multiplier on subsequent reward accruals.

### 10.3.4 Staking Flow

```solidity
// Stake an LP NFT
stake(tokenId, weight)

// Unstake (minimum 1-day duration)
unstake(tokenId)

// Claim rewards without unstaking
claimRewards(tokenId)
```

### 10.3.5 Anti-Gaming

| Measure | Implementation |
|---------|---------------|
| Minimum stake duration | 1 day (`minStakeDuration = 1 days`) |
| Rate change timelock | 48 hours before new rates take effect |
| Upgrade timelock | 7 days before upgrade can execute |
| Dust accumulation | Sub-wei rewards accumulate, redistributed |

### 10.3.6 Reward Distribution

Rewards are distributed **proportional to staked weight**:

```
user_reward = total_rewards × (user_weight / total_weights)
```

The Ag multiplier increases effective weight for stakers with higher Ag
balances, but the base distribution is weight-proportional.

### 10.3.7 Upgradeability

- UUPS proxy pattern
- Upgrades require: announce → 7-day timelock → execute
- Only `DEFAULT_ADMIN_ROLE` (governance) can upgrade

## 10.4 Security

| Risk | Mitigation |
|------|-----------|
| NFT stuck on unstake | ReentrancyGuard, safeTransferFrom |
| Rate manipulation | 48h timelock on rate changes |
| Malicious upgrade | 7-day timelock, admin-only |
| Reward dust | Accumulator redistributes sub-wei amounts |
| Flash stake/unstake | 1-day minimum stake duration |

## 10.5 Governance-Controlled Parameters

| Parameter | Contract | Function |
|-----------|----------|----------|
| Au reward rate | AVLPStaking_v2 | `setRewardRates()` |
| Ag reward rate | AVLPStaking_v2 | `setRewardRates()` |
| Ag threshold (multiplier) | AVLPStaking_v2 | `agThreshold` (set in initializer) |
| Min stake duration | AVLPStaking_v2 | `minStakeDuration` (set in initializer) |
| Render params | QuasiCrystalLPNFT | `setRenderParams()` |
| Pause | Both | `pause()` / Governor only |
