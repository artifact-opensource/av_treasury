---
title: Tokenomics — Au and Ag Token Economics
date: 2026-06-29
status: complete
description: Complete token economics for Au (utility) and Ag (governance) — supply mechanics, staking, fee distribution, emission schedule, and veAg governance power.
category: technical
related: [central-banking/01-dual-token-architecture.md, central-banking/03-emission-mechanics.md, central-banking/10-quasicrystal-nft.md, GETTING_STARTED.md, API_REFERENCE.md]
---

# Tokenomics — Au and Ag

## 1. Au (Utility Token)

### 1.1 Core Parameters

| Parameter | Value |
|-----------|-------|
| Contract | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` |
| Max Supply | 1,000,000,000 (1 billion) |
| Decimals | 18 |
| Transfer Fee | 9 bps (0.09%) |
| Max Transfer Fee | 500 bps (5%) |
| Max Transaction | 100% of supply (governance-adjustable) |
| Max Wallet | 10% of supply (governance-adjustable) |
| Sell Cooldown | 7 days |
| Flash Loan Cap | 1,000,000 Au |
| Upgrade Delay | 7 days |

### 1.2 Transfer Fee Mechanics

```
fee_amount = transfer_amount × transferFeeBps / 10000
fee_split:
  50% → Fee pool (accumulatedFees)
  50% → Burn (permanent supply reduction)
```

Fee is zero for whitelisted contracts (staking, governance, AMO).

### 1.3 Anti-Bot Measures

- `isBlocked` mapping — addresses can be blocked by ANTI_BOT_ROLE
- `isWhitelistedContract` — DEX routers, staking contracts exempt from fees
- Sell cooldown prevents rapid sell-walls
- Max wallet prevents concentration

### 1.4 Upgrade Mechanism

Au uses a 7-day timelock upgrade:
1. `announceUpgrade(newImpl)` — starts 7-day timer
2. After 7 days — anyone can execute
3. `cancelUpgrade()` — cancels pending upgrade

## 2. Ag (Governance Token)

### 2.1 Core Parameters

| Parameter | Value |
|-----------|-------|
| Contract | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` |
| Max Supply | 100,000,000 (100 million) — hard cap |
| Decimals | 18 |
| Transfer Fee | None |
| Mint Rights | PID Controller only (MINTER_ROLE) |
| Upgrade Delay | 7 days |

### 2.2 Supply Schedule

| Phase | Duration | Characteristic |
|-------|----------|---------------|
| Bootstrap | Months 0–10 | High emission, rapidly declining |
| Growth | Months 11–60 | Moderate, PID-steady |
| Mature | Months 60+ | Low, maintenance-level |

### 2.3 Emission Constraints

```
Per-epoch cap:    10,000 Ag (MAX_SINGLE_EMISSION)
Per-day cap:      50,000 Ag (MAX_DAILY_CAP)
Hard cap:         100,000,000 Ag (total supply)
```

At current rates, the 100M cap will not be reached for approximately 15-20 years.

## 3. Emission Distribution

```
Per-epoch Ag emission (from PID):
  ├── 60% → QuasiCrystal LP NFT stakers
  ├── 25% → Direct Ag stakers (veAg lockers)
  └── 15% → TreasuryAMO (operational reserve)
```

## 4. veAg Mechanics

### 4.1 Locking

```
veAg_multiplier = 1.0 + (user_veAg / total_veAg) × 1.5
Range: 1.0× (no lock) to 2.5× (maximum lock)
```

### 4.2 Lock Duration

| Duration | Multiplier Boost |
|----------|-----------------|
| 1 day | Minimal |
| 90 days | Moderate |
| 1 year | High |
| 4 years | Maximum (2.5×) |

### 4.3 Voting Power

```
voting_power = Ag_balance + veAg_boost
veAg_boost = Ag_locked × (lock_duration / 1460 days) × 1.5
```

## 5. Staking Economics

### 5.1 QuasiCrystal LP NFT Staking

```
user_reward = epoch_emissions × 0.60 × (user_nft_weight / total_nft_weight)
effective_APY = base_APY × veAg_multiplier
```

### 5.2 Direct Ag Staking

```
direct_reward = epoch_emissions × 0.25 × (user_veAg / total_veAg)
```

### 5.3 Anti-Gaming

- **Snapshot-based**: Rewards based on epoch-start balance (prevents front-running)
- **Minimum stake**: 1 day (prevents flash staking)
- **Smoothing**: `smoothed = α × current + (1-α) × previous`, α = 0.3

## 6. Fee Flow Summary

```
Au Transfer (9bps)
  ├── 4.5 bps → Accumulated fees (Au contract)
  └── 4.5 bps → Burn (permanent removal)

Au → TreasuryAMO (deposit)
  └── 0.05% redemption fee

Slipstream LP Fees
  └── 100% → TreasuryAMO (protocol-owned)

FlashBuy Profits
  ├── 50% → Burn
  ├── 30% → Treasury reserve
  └── 20% → Staker rewards
```
