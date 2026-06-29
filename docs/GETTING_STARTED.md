---
title: Getting Started with AV Treasury
date: 2026-06-29
status: draft
description: How to interact with the AV Treasury protocol — deposit, stake, govern, and claim rewards.
category: guides
related: [ADDRESS_BOOK.md, API_REFERENCE.md, ARCHITECTURE.md, TOKENOMICS.md, SECURITY.md]
---

# Getting Started with AV Treasury

This guide walks you through interacting with the AV Treasury protocol on Base network: depositing liquidity, staking LP tokens, participating in governance, and claiming rewards.

---

## Prerequisites

### Wallet & Network
- **Wallet**: Any EVM-compatible wallet (MetaMask, Rabby, Frame)
- **Network**: Base (Chain ID 8453)
  - RPC: `https://mainnet.base.org`
  - Block Explorer: `https://basescan.org`
- **Tokens needed**:
  - **USDC** on Base — for depositing into TreasuryAMO
  - **Au** (Artifact Utility) — the protocol utility token
  - **AVLP** LP tokens — for staking in AVLPStaking_v2
  - **Ag** (Artifact Governance) — for governance voting power

### Contract Addresses

> See [ADDRESS_BOOK.md](./ADDRESS_BOOK.md) for the full canonical address list.

Key contracts (Base Mainnet):
| Contract | Purpose |
|----------|---------|
| `AuToken` | Utility token (fixed supply, 1B max) |
| `AgToken` | Governance token (mintable via PID controller) |
| `TreasuryAMO` | Treasury AMO — deposit Au/USDC |
| `AVLPStaking_v2` | Stake LP tokens, earn Au rewards |
| `GovernorContract` | Governance proposals & voting |
| `PID_Emission_Controller_v2` | Controls Ag emission rate |
| `AvOracle` | On-chain price oracle |
| `OracleGuardian` | Oracle security & validation |
| `QuasiCrystalLPNFT` | LP position NFT |
| `TreasuryFlashBuy_v2` | Flash-buy mechanism |
| `ArtifactTimelock` | Governance timelock (48h delay) |

---

## Depositing Au/USDC into TreasuryAMO

The TreasuryAMO (Automated Market Operations) contract manages protocol liquidity. Users can deposit Au or USDC to mint LP tokens.

### Deposit Flow
1. **Approve** the TreasuryAMO contract to spend your Au or USDC tokens
2. **Call deposit** with the desired amount

```solidity
// Step 1: Approve
IERC20(auToken).approve(treasuryAMO, amount);

// Step 2: Deposit
ITreasuryAMO(treasuryAMO).deposit(auAmount, usdcAmount);
```

### Key TreasuryAMO Functions
- `deposit(uint256 auAmount, uint256 usdcAmount)` — Deposit Au and/or USDC
- `withdraw(uint256 auAmount, uint256 usdcAmount)` — Withdraw Au and/or USDC
- `getReserves()` — View current Au and USDC reserves

> **Note**: TreasuryAMO is `whenNotPaused`. Deposits are blocked during emergency pause.

---

## Staking LP Tokens via AVLPStaking_v2

Stake your AVLP LP tokens to earn Au rewards over time.

### Staking Flow

#### 1. Stake
```solidity
// Approve LP tokens
IERC20(lpToken).approve(avlpStaking, amount);

// Stake tokens
IAVLPStaking_v2(avlpStaking).stake(amount);
```

#### 2. Check Pending Rewards
```solidity
uint256 pending = IAVLPStaking_v2(avlpStaking).earned(address account);
```

#### 3. Claim Rewards
```solidity
IAVLPStaking_v2(avlpStaking).claimRewards();
```

#### 4. Unstake
```solidLPStaking_v2(avlpStaking).withdraw(amount);
// or withdraw all:
IAVLPStaking_v2(avlpStaking).exit();
```

### Key AVLPStaking_v2 Functions
| Function | Description |
|----------|-------------|
| `stake(uint256 amount)` | Stake LP tokens |
| `withdraw(uint256 amount)` | Unstake LP tokens |
| `claimRewards()` | Claim accumulated Au rewards |
| `exit()` | Withdraw all stake + claim all rewards |
| `earned(address account)` | View pending Au rewards for an account |
| `stakedBalance(address account)` | View staked balance |
| `rewardRate()` | Current Au reward rate per second |
| `getRewardForDuration(uint256 duration)` | Rewards over a time window |

---

## Governance Voting via GovernorContract

Participate in protocol governance by creating proposals and casting votes.

### Voting Power
- Voting power is derived from **Ag token balance** (delegated) and staked LP tokens.
- You must **delegate** your Ag tokens before voting:
```solidity
// Self-delegate
IAgToken(agToken).delegate(msg.sender);
```

### Governance Flow

#### 1. Create a Proposal
```solidity
GovernorContract.Proposal memory proposal = {
    targets: [targetContract],
    values: [0],
    calldatas: [calldata],
    description: "Proposal description"
};

uint256 proposalId = IGovernorContract(governor).propose(
    targets,
    values,
    calldatas,
    description
);
```

> **Requirement**: Proposer must meet `proposalThreshold()` (minimum Ag balance).

#### 2. Cast a Vote
```solidity
// After voting delay and within voting period
IGovernorContract(governor).castVote(proposalId, support);
// support: 0=Against, 1=For, 2=Abstain
```

#### 3. Execute
```solidity
// After proposal succeeds — executes immediately (no timelock delay)
IGovernorContract(governor).execute(targets, values, calldatas, descriptionHash);
```

> **Note:** The Governor executes proposals immediately after voting ends.
> The Governor's `_queueOperations` returns 0, bypassing the timelock delay.
> The ArtifactTimelock contract is deployed but the Governor does not route through it.

### Key GovernorContract Functions
| Function | Description |
|----------|-------------|
| `propose(targets[], values[], calldatas[], description)` | Create a new proposal |
| `castVote(uint256 proposalId, uint8 support)` | Vote on a proposal |
| `castVoteWithReason(uint256 proposalId, uint8 support, string reason)` | |
| `queue(address[] targets, uint[] values, bytes[] calldatas, bytes32 descriptionHash)` | Queue for timelock |
| `execute(address[] targets, uint[] values, bytes[] calldatas, bytes32 descriptionHash)` | Execute after timelock |
| `state(uint256 proposalId)` | Get proposal state |
| `proposalThreshold()` | Minimum Ag to propose |
| `votingDelay()` | Delay before voting starts |
| `votingPeriod()` | Duration of voting window |

---

## Claiming Rewards

### Staking Rewards (Au)
```solidity
// Claim Au rewards from staking
IAVLPStaking_v2(avlpStaking).claimRewards();
```

### PID Controller Rewards (Ag)
```solidity
// Claim Ag emission rewards
IPID_Emission_Controller_v2(pidController).claim();
```

### Treasury Fees (Au)
```solidity
// Withdraw accumulated Au transfer fees to treasury
Token(auToken).withdrawFees();
// Only callable by treasury address or DEFAULT_ADMIN_ROLE
```

---

## Quick-Start Examples

### Example 1: Full Deposit + Stake + Claim Cycle
```javascript
// 1. Deposit into TreasuryAMO
await auToken.approve(treasuryAMO, auAmount);
await usdc.approve(treasuryAMO, usdcAmount);
await treasuryAMO.deposit(auAmount, usdcAmount);

// 2. Receive LP tokens, stake them
const lpBalance = await lpToken.balanceOf(user);
await lpToken.approve(avlpStaking, lpBalance);
await avlpStaking.stake(lpBalance);

// 3. Wait for rewards to accumulate...

// 4. Claim rewards
await avlpStaking.claimRewards();

// 5. Unstake when done
await avlpStaking.exit(); // withdraw all + claim all
```

### Example 2: Governance Participation
```javascript
// 1. Acquire Ag tokens
// 2. Self-delegate for voting power
await agToken.delegate(userAddress);

// 3. Create proposal (if above threshold)
const proposalId = await governor.propose(
  [targetContract],
  [0],
  [calldata],
  "Upgrade PID controller parameters"
);

// 4. Wait for voting delay, then cast vote
await governor.castVote(proposalId, 1); // 1 = For

// 5. After voting ends, if succeeded:
await governor.queue(targets, values, calldatas, descriptionHash);
// Wait 48h timelock...
await governor.execute(targets, values, calldatas, descriptionHash);
```

### Example 3: Stake LP, Earn Au, Participate in Governance
```javascript
// Stake LP tokens
await avlpStaking.stake(amount);

// Accumulate Au rewards
const earned = await avlpStaking.earned(userAddress);

// Claim Au
await avlpStaking.claimRewards();

// Use Au for protocol interactions or hold
```

---

## Important Notes

- **Transfer fees**: Au has a 9bps (0.09%) transfer fee — 50% burned, 50% to treasury
- **Max transaction**: 10% of supply per transaction (configurable)
- **Max wallet**: 10% of supply per wallet (configurable)
- **Flash loans**: Au supports flash minting up to 1M Au with 9bps fee
- **Governance timelock**: 48-hour delay between queue and execute
- **Upgrade timelock**: 7-day delay for all contract upgrades
- **Paused state**: All user-facing functions respect the pause state
