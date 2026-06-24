# av_treasury Sandbox — Technical Documentation

> **Version**: 1.0 | **Chain**: Local (Ganache/Anvil, chainId 1337) | **Solidity**: ^0.8.20

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Contract Interactions](#2-contract-interactions)
3. [Flywheel Mechanics](#3-flywheel-mechanics)
4. [Contract APIs](#4-contract-apis)
5. [Bot Personalities](#5-bot-personalities)
6. [Stress Scenarios](#6-stress-scenarios)
7. [Deployment Flow](#7-deployment-flow)
8. [Key Constants](#8-key-constants)

---

## 1. Architecture Overview

The sandbox is a **dual-token DAO simulation** implementing a positive-feedback flywheel:

```
          ┌─────────────────────────────────────────────────────┐
          │                   FLYWHEEL LOOP                     │
          │                                                     │
          │  LP ──► Stake ──► Earn Yield ──► More LP ──► TVL↑  │
          │   ▲                                        │        │
          │   │                                        ▼        │
          │   │                              PID Mint Ag Token  │
          │   │                                        │        │
          │   │                                        ▼        │
          │   │                                  Treasury Buyback│
          │   │                                        │        │
          │   │                                        ▼        │
          │   └──── Au Price ↑ ◄── Reduced Supply ◄────┘        │
          │                                                     │
          └─────────────────────────────────────────────────────┘
```

### Contract Map

| Contract | File | Role |
|----------|------|------|
| MockAuToken | MockTokens.sol | Reserve/asset token (Au = gold) |
| MockAgToken | MockTokens.sol | Protocol token (Ag = silver) |
| DexSimulator | DexSimulator.sol | AMM with liquidity pools |
| SandboxLPToken | SandboxLPToken.sol | LP receipt token |
| MockStaking | MockStaking.sol | Stake LP for Au+Ag yield |
| MockPIDController | MockPIDController.sol | PID-controlled Ag minting |
| MockTreasuryAMO | MockTreasuryAMO.sol | Buyback mechanism (AMO) |
| MockGovernor | MockGovernor.sol | DAO governance |

---

## 2. Contract Interactions

### 2.1 Token Layer

```
MockAuToken ◄─────── DexSimulator (reserveA) ◄─────── addLiquidity / addOneSidedA
MockAgToken ◄─────── DexSimulator (reserveB) ◄─────── addLiquidity / addOneSidedB
     │                                                        │
     │                     SandboxLPToken                     │
     │    mint(reserveA, reserveB) ◄──────────────────────────┘
     │    burn(liquidity) ──────────────────────► returns reserveA + reserveB
     │    ▲
     │    │ stake()
     │    │
MockStaking
     │
     │ claimRewards() → Au + Ag
     ▼
```

### 2.2 PID Controller → Treasury AMO

```
MockPIDController                    MockTreasuryAMO
─────────────────                    ────────────────
getCurrentError()  ──triggers──►    executeBuyback(amount, agPrice)
tick()                              canExecute()
canEmit()                           cooldownRemaining()
targetTvl()                         maxBuybackAmount()
remainingDailyEmission()            totalBuybacksExecuted()
                                    totalAuBought()
```

### 2.3 Governance Layer

```
MockGovernor
────────────
propose(description, target, payload)  →  proposal created
castVote(proposalId, support, weight) →  vote recorded
queue(proposalId)                     →  enters queue
execute(proposalId)                   →  executes payload
```

---

## 3. Flywheel Mechanics

### 3.1 The Positive Feedback Loop

The system is designed as a **self-reinforcing flywheel** where each step amplifies the next:

```
Step 1: Liquidity Providers add Au + Ag to DexSimulator
        ↓
Step 2: LPs receive SandboxLPToken (LP receipt)
        ↓
Step 3: LP tokens are staked in MockStaking
        ↓
Step 4: Stakers earn Au + Ag yield (from PID emissions)
        ↓
Step 5: Yield incentivizes more LP → more TVL
        ↓
Step 6: Higher TVL → PID controller detects error (target - actual)
        ↓
Step 7: PID mints Ag tokens proportional to error
        ↓
Step 8: Minted Ag sold into DEX → Ag price drops
        ↓
Step 9: TreasuryAMO buys back Ag with Au (supports Ag price)
        ↓
Step 10: Buyback reduces Au circulating supply → Au price ↑
        ↓
Step 11: Higher Au price → more attractive to stake LP
        ↓
Step 12: Loop continues (Step 1)
```

### 3.2 Equilibrium Conditions

The flywheel reaches equilibrium when:
- `PID_error == 0` (TVL matches target)
- `staking_apy == opportunity_cost` (no excess yield)
- `buyback_rate == emission_rate` (neutral Ag supply)
- `dex_reserves_ratio == market_ratio` (price stability)

---

## 4. Contract APIs

### 4.1 MockAuToken / MockAgToken (MockTokens.sol)

Both tokens share the same ERC20 implementation with minting capability.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_name: string`, `_symbol: string` | — | Sets name, symbol, decimals (18) |
| `mint` | external | `to: address`, `amount: uint256` | `bool` | Mints `amount` to `to` |
| `balanceOf` | public view | `account: address` | `uint256` | Returns token balance |
| `approve` | public | `spender: address`, `amount: uint256` | `bool` | Approves spender |
| `transfer` | public | `to: address`, `amount: uint256` | `bool` | Transfers tokens |

---

### 4.2 DexSimulator (DexSimulator.sol)

Automated Market Maker (AMM) with constant-product formula.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_tokenA: address`, `_tokenB: address` | — | Sets reserve addresses |
| `swapAforB` | external | `amountAIn: uint256` | `uint256 amountBOut` | Swaps Au→Ag, applies 0.3% fee |
| `swapBforA` | external | `amountBIn: uint256` | `uint256 amountAOut` | Swaps Ag→Au, applies 0.3% fee |
| `addLiquidity` | external | `amountA: uint256`, `amountB: uint256` | `uint256 liquidity` | Mints LP tokens (geometric mean) |
| `removeLiquidity` | external | `liquidity: uint256` | `(uint256 amountA, uint256 amountB)` | Burns LP, returns proportional reserves |
| `addOneSidedA` | external | `amountAIn: uint256` | `uint256 liquidity` | Swaps half A→B, then adds liquidity |
| `addOneSidedB` | external | `amountBIn: uint256` | `uint256 liquidity` | Swaps half B→A, then adds liquidity |
| `removeOneSidedA` | external | `liquidity: uint256` | `uint256 amountA` | Burns LP, swaps all B→A |
| `removeOneSidedB` | external | `liquidity: uint256` | `uint256 amountB` | Burns LP, swaps all A→B |
| `getReserveA` | public view | — | `uint256` | Returns Au reserve |
| `getReserveB` | public view | — | `uint256` | Returns Ag reserve |
| `getLpBalance` | public view | `account: address` | `uint256` | Returns LP balance |
| `getLpTotalSupply` | public view | — | `uint256` | Returns total LP supply |
| `getPriceA` | public view | — | `uint256` | Returns Au price in Ag (1e18) |
| `getPriceB` | public view | — | `uint256` | Returns Ag price in Au (1e18) |

**Invariant**: `k = reserveA * reserveB` (constant product)

---

### 4.3 SandboxLPToken (SandboxLPToken.sol)

Liquidity provider receipt token with one-sided mint/burn.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_dex: address` | — | Sets DexSimulator reference |
| `mint` | external | `amountA: uint256`, `amountB: uint256` | `uint256 liquidity` | Pulls tokens from user, mints LP |
| `mintOneSidedA` | external | `amountAIn: uint256` | `uint256 liquidity` | Pulls Au, half-swaps, mints LP |
| `mintOneSidedB` | external | `amountBIn: uint256` | `uint256 liquidity` | Pulls Ag, half-swaps, mints LP |
| `burn` | external | `liquidity: uint256` | `(uint256 amountA, uint256 amountB)` | Burns LP, returns proportional reserves |
| `burnOneSidedA` | external | `liquidity: uint256` | `uint256 amountA` | Burns LP, returns all as Au |
| `burnOneSidedB` | external | `liquidity: uint256` | `uint256 amountB` | Burns LP, returns all as Ag |
| `approve` | public | `spender: address`, `amount: uint256` | `bool` | Approves spender |
| `balanceOf` | public view | `account: address` | `uint256` | Returns LP balance |
| `totalSupply` | public view | — | `uint256` | Returns total supply |

---

### 4.4 MockStaking (MockStaking.sol)

Stake LP tokens to earn Au + Ag yield.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_lpToken: address`, `_rewardTokenA: address`, `_rewardTokenB: address` | — | Sets LP and reward tokens |
| `stake` | external | `amount: uint256` | — | Transfers LP from user, updates reward debt |
| `unstake` | external | `amount: uint256` | — | Returns LP, claims pending rewards |
| `claimRewards` | external | — | — | Transfers Au + Ag rewards to user |
| `pendingRewards` | public view | `account: address` | `(uint256 rewardA, uint256 rewardB)` | Returns pending Au + Ag |
| `stakedBalance` | public view | `account: address` | `uint256` | Returns staked LP |
| `getTvl` | public view | — | `uint256` | Returns total staked LP |
| `totalStaked` | public view | — | `uint256` | Returns total staked LP |
| `rewardRateA` | public view | — | `uint256` | Returns Au reward rate per second |
| `rewardRateB` | public view | — | `uint256` | Returns Ag reward rate per second |
| `lastStakedTime` | public view | `account: address` | `uint256` | Returns last stake timestamp |

**Reward Calculation**: Rewards accrue per second per LP staked:
```
rewardA = (rewardRateA * stakedBalance * timeDelta) / totalStaked
rewardB = (rewardRateB * stakedBalance * timeDelta) / totalStaked
```

---

### 4.5 MockPIDController (MockPIDController.sol)

PID controller that mints Ag tokens based on TVL error.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_tokenAg: address`, `_staking: address`, `_treasury: address`, `_targetTvl: int256`, `_Kp: int256`, `_Ki: int256`, `_Kd: int256` | — | Sets PID parameters |
| `tick` | external | — | `uint256 amountToMint` | Executes one PID cycle, mints Ag if error > 0 |
| `getCurrentError` | public view | — | `int256` | Returns `targetTvl - currentTvl` |
| `canEmit` | public view | — | `bool` | Returns true if daily emission not exhausted |
| `targetTvl` | public view | — | `int256` | Returns target TVL (1e18) |
| `remainingDailyEmission` | public view | — | `uint256` | Returns remaining Ag to mint today |
| `lastError` | public view | — | `int256` | Returns previous error |
| `integral` | public view | — | `int256` | Returns accumulated integral |
| `kp` | public view | — | `int256` | Returns proportional gain |
| `ki` | public view | — | `int256` | Returns integral gain |
| `kd` | public view | — | `int256` | Returns derivative gain |
| `dailyEmissionCap` | public view | — | `uint256` | Returns max daily Ag mint |
| `lastEmissionTime` | public view | — | `uint256` | Returns last emission timestamp |

**PID Formula**:
```
error = targetTvl - currentTvl
integral = integral + error
derivative = error - lastError
output = Kp*error + Ki*integral + Kd*derivative
amountToMint = max(0, output)  // Only mint, never burn
```

---

### 4.6 MockTreasuryAMO (MockTreasuryAMO)

Autonomous Market Operation that buys back Ag with Au.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_tokenAu: address`, `_tokenAg: address`, `_dex: address`, `_maxBuyback: uint256`, `_cooldown: uint256` | — | Sets buyback parameters |
| `executeBuyback` | external | `amountAu: uint256`, `agPrice: uint256` | `uint256 amountAgBought` | Swaps Au for Ag on DEX |
| `canExecute` | public view | — | `bool` | Returns true if cooldown elapsed |
| `cooldownRemaining` | public view | — | `uint256` | Returns seconds until next buyback |
| `maxBuybackAmount` | public view | — | `uint256` | Returns max Au per buyback |
| `totalBuybacksExecuted` | public view | — | `uint256` | Returns total buyback count |
| `totalAuSpent` | public view | — | `uint256` | Returns total Au spent |
| `totalAgBought` | public view | — | `uint256` | Returns total Ag bought |
| `lastBuybackTime` | public view | — | `uint256` | Returns last buyback timestamp |

**Constraints**:
- Must respect cooldown period
- Cannot exceed `maxBuybackAmount` per transaction
- Must have `canExecute() == true`

---

### 4.7 MockGovernor (MockGovernor.sol)

DAO governance with proposal, voting, and execution.

| Function | Visibility | Parameters | Returns | Effects |
|----------|------------|------------|---------|---------|
| `constructor` | public | `_token: address`, `_proposalThreshold: uint256`, `_votingPeriod: uint256`, `_quorumPercent: uint256` | — | Sets governance parameters |
| `propose` | external | `description: string`, `target: address`, `payload: bytes` | `uint256 proposalId` | Creates proposal if sender meets threshold |
| `castVote` | external | `proposalId: uint256`, `support: bool`, `weight: uint256` | — | Records vote (weight = voting power) |
| `queue` | external | `proposalId: uint256` | — | Queues proposal after voting period |
| `execute` | external | `proposalId: uint256` | — | Executes proposal payload |
| `getProposal` | public view | `proposalId: uint256` | `tuple` | Returns full proposal struct |
| `proposalCount` | public view | — | `uint256` | Returns total proposals created |
| `votingPeriod` | public view | — | `uint256` | Returns voting period duration |
| `quorumPercent` | public view | — | `uint256` | Returns required quorum % |
| `proposalThreshold` | public view | — | `uint256` | Returns min tokens to propose |

**Proposal Struct**:
```solidity
struct Proposal {
  uint256 id;
  address proposer;
  string description;
  address target;
  bytes payload;
  uint256 forVotes;
  uint256 againstVotes;
  uint256 startBlock;
  uint256 endBlock;
  uint256 executionTime;
  bool executed;
  bool canceled;
}
```

---

## 5. Bot Personalities

The `BotEngine.js` defines **7 distinct personalities** that simulate realistic agent behavior. Each personality has different risk tolerance, trade size preferences, and action probabilities.

### 5.1 Personality Matrix

| Personality | Trade Size % | Risk Tolerance | Primary Actions | Population Weight |
|-------------|-------------|----------------|-----------------|-------------------|
| **Whale** | 30% of balance | High | Large swaps, governance | 5% |
| **Degen** | 25% of balance | Very High | Aggressive LP, high leverage | 10% |
| **Conservative** | 5% of balance | Low | Small stakes, safe swaps | 20% |
| **Arbitrageur** | 20% of balance | Medium | Price correction swaps | 15% |
| **Loyalist** | 10% of balance | Low | Long-term staking, voting | 25% |
| **Speculator** | 15% of balance | High | Momentum trading | 10% |
| **Liquidity Provider** | 10% of balance | Low-Med | Balanced LP provision | 15% |

### 5.2 Personality Details

#### Whale
- **Trade Size**: 30% of balance per action
- **Actions**: Large swaps (move price significantly), governance proposals, emergency unstakes
- **Behavior**: Only acts when opportunities are significant (>5% price deviation)
- **Probability Distribution**: swap 40%, addLP 20%, stake 20%, governance 10%, unstake 10%

#### Degen
- **Trade Size**: 25% of balance per action
- **Actions**: Maximum LP, aggressive staking, rapid unstake/re-stake
- **Behavior**: Always chasing highest APY, enters/exits positions quickly
- **Probability Distribution**: swap 20%, addLP 30%, stake 30%, unstake 20%

#### Conservative
- **Trade Size**: 5% of balance per action
- **Actions**: Small, safe swaps, long-term staking
- **Behavior**: Rarely unstakes, prefers staking rewards over trading
- **Probability Distribution**: swap 10%, addLP 20%, stake 50%, unstake 5%, claimRewards 15%

#### Arbitrageur
- **Trade Size**: 20% of balance per action
- **Actions**: Price correction swaps, LP balancing
- **Behavior**: Acts when price deviates from reference (oracle) price
- **Probability Distribution**: swap 60%, addLP 15%, stake 10%, unstake 15%

#### Loyalist
- **Trade Size**: 10% of balance per action
- **Actions**: Long-term staking, governance voting
- **Behavior**: Rarely trades, focuses on governance and steady yield
- **Probability Distribution**: swap 5%, addLP 15%, stake 50%, claimRewards 20%, governance 10%

#### Speculator
- **Trade Size**: 15% of balance per action
- **Actions**: Momentum trading, trend following
- **Behavior**: Buys when price rising, sells when falling; uses moving averages
- **Probability Distribution**: swap 50%, addLP 15%, stake 15%, unstake 20%

#### Liquidity Provider
- **Trade Size**: 10% of balance per action
- **Actions**: Balanced LP provision, one-sided liquidity
- **Behavior**: Maintains balanced pools, removes when IL risk high
- **Probability Distribution**: swap 10%, addLP 40%, stake 20%, removeLP 20%, claimRewards 10%

### 5.3 Action Execution Flow

Each bot tick:
1. Read system state (price, TVL, APY, buyback capacity)
2. Calculate action probability based on personality + state
3. Select action via weighted random
4. Calculate amount based on personality trade size %
5. Execute action (with slippage check)
6. Update internal state

---

## 6. Stress Scenarios

The `stress-test.js` implements **5 stress test scenarios** that simulate extreme conditions.

### 6.1 Scenario 1: Bank Run (Mass Unstaking)

**Purpose**: Test system resilience when all stakers attempt to exit simultaneously.

**Sequence**:
1. Setup: 100 bots stake all LP tokens
2. Trigger: All bots call `unstake()` simultaneously
3. Expected: System processes all unstakes without reverting
4. Success Criteria:
   - All unstake transactions succeed
   - No locked funds
   - Correct reward payouts
   - LP token supply returns to zero

**Failure Mode**: If unstake reverts due to insufficient contract LP, funds are locked.

---

### 6.2 Scenario 2: Price Crash (Ag Token)

**Purpose**: Test PID controller response to rapid Ag price decline.

**Sequence**:
1. Setup: Normal system operation with target TVL
2. Trigger: Large sell orders of Ag on DEX (simulating panic sell)
3. Expected: PID reduces/ceases Ag minting; TreasuryAMO buybacks activate
4. Success Criteria:
   - PID error goes negative → no minting
   - Buyback cooldown respected
   - Price stabilizes within 10% of pre-crash

**Failure Mode**: If PID continues minting during crash, Ag becomes worthless.

---

### 6.3 Scenario 3: Governance Attack

**Purpose**: Test governance resilience against malicious proposals.

**Sequence**:
1. Setup: Normal governance with quorum requirements
2. Trigger: Attacker submits malicious proposal (e.g., transfer all funds)
3. Expected: Proposal fails due to insufficient votes or quorum
4. Success Criteria:
   - Malicious proposal rejected
   - Quorum enforcement works
   - Voting power correctly calculated

**Failure Mode**: If attacker accumulates enough tokens to pass malicious proposal.

---

### 6.4 Scenario 4: Liquidity Drain

**Purpose**: Test system when liquidity is rapidly removed.

**Sequence**:
1. Setup: Full liquidity in DEX
2. Trigger: Large `removeLiquidity()` and `removeOneSidedA/B()` calls
3. Expected: Reserves deplete, price impact increases, system adapts
4. Success Criteria:
   - No contract reverts
   - Price oracle updates correctly
   - PID adjusts minting to TVL drop

**Failure Mode**: If reserves reach zero, subsequent swaps revert (division by zero).

---

### 6.5 Scenario 5: PID Controller Saturation

**Purpose**: Test PID behavior when daily emission cap is reached.

**Sequence**:
1. Setup: Large TVL deficit (error >> 0)
2. Trigger: Multiple `tick()` calls in rapid succession
3. Expected: PID respects daily emission cap, distributes over time
4. Success Criteria:
   - `remainingDailyEmission` reaches 0
   - No additional minting until next day
   - `canEmit()` returns false

**Failure Mode**: If cap is exceeded, excessive Ag minting dilutes value.

---

## 7. Deployment Flow

### 7.1 `deploy-sandbox.js` Step-by-Step

```
Step 1: Connect to Local Chain
   └─ Provider: http://127.0.0.1:8545 (Ganache/Anvil)
   └─ Chain ID: 1337

Step 2: Deploy MockAuToken
   └─ Constructor: "Mock Au Token", "Au"
   └─ Decimals: 18

Step 3: Deploy MockAgToken
   └─ Constructor: "Mock Ag Token", "Ag"
   └─ Decimals: 18

Step 4: Deploy DexSimulator
   └─ Constructor: MockAuToken.address, MockAgToken.address
   └─ Sets up Au/Ag trading pair

Step 5: Deploy SandboxLPToken
   └─ Constructor: DexSimulator.address
   └─ Links LP token to DEX

Step 6: Deploy MockStaking
   └─ Constructor: SandboxLPToken.address, MockAuToken.address, MockAgToken.address
   └─ Sets LP as staking token, Au+Ag as reward tokens

Step 7: Deploy MockPIDController
   └─ Constructor: AgToken, Staking, Treasury, targetTvl, Kp, Ki, Kd
   └─ Sets PID parameters for Ag minting control

Step 8: Deploy MockTreasuryAMO
   └─ Constructor: AuToken, AgToken, DexSimulator, maxBuyback, cooldown
   └─ Sets buyback parameters

Step 9: Deploy MockGovernor
   └─ Constructor: AuToken, proposalThreshold, votingPeriod, quorumPercent
   └─ Sets governance parameters

Step 10: Fund Bot Accounts
   └─ Derive 100 wallets from mnemonic
   └─ Send 1000 ETH each to bots
   └─ Approve token spending for contracts

Step 11: Initialize System State
   └─ Add initial liquidity to DEX
   └─ Set initial PID target
   └─ Enable staking
```

### 7.2 `orchestrate.sh` Flow

```bash
# 1. Start local chain (Ganache/Anvil)
bash sandbox/scripts/start-ganache.sh

# 2. Deploy contracts
node sandbox/scripts/deploy-sandbox.js

# 3. Run BotEngine simulation
node sandbox/bots/BotEngine.js

# 4. (Optional) Run stress tests
node sandbox/scripts/stress-test.js
```

### 7.3 Configuration (`accounts.json`)

```json
{
  "totalAccounts": 100,
  "defaultBalanceEth": 1000,
  "mnemonic": "test test test test test test test test test test test junk",
  "derivationPath": "m/44'/60'/0'/0/",
  "networkId": 1337,
  "chainId": 1337
}
```

---

## 8. Key Constants

### 8.1 PID Controller Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `Kp` | 1e15 (0.001) | Proportional gain |
| `Ki` | 1e14 (0.0001) | Integral gain |
| `Kd` | 1e14 (0.0001) | Derivative gain |
| `targetTvl` | 1e21 (1000e18) | Target TVL in wei |
| `dailyEmissionCap` | 1e20 (100e18) | Max Ag minted per day |
| `minEmission` | 0 | Minimum emission per tick |
| `maxEmission` | 1e20 (100e18) | Maximum emission per tick |

### 8.2 Treasury AMO Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `maxBuybackAmount` | 1e20 (100e18) | Max Au spent per buyback |
| `cooldown` | 1800 (30 min) | Seconds between buybacks |
| `minAgPriceForBuyback` | 1e15 (0.001e18) | Minimum Ag price to trigger |

### 8.3 Staking Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `rewardRateA` | 1e15 (0.1%) | Au reward rate per second per LP |
| `rewardRateB` | 1e15 (0.1%) | Ag reward rate per second per LP |
| `unstakeCooldown` | 600 (10 min) | Seconds before unstake completes |
| `minStake` | 1e15 (0.001e18) | Minimum LP to stake |

### 8.4 Governance Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `proposalThreshold` | 1e18 (1e18) | Min Au tokens to propose |
| `votingPeriod` | 100 blocks | Duration of voting |
| `quorumPercent` | 4% | Required for/against ratio |
| `executionDelay` | 600 (10 min) | Seconds after voting before execution |

### 8.5 DEX Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `swapFee` | 0.3% (30 bps) | Trading fee |
| `minLiquidity` | 1e15 (0.001e18) | Minimum LP to mint |
| `priceImpactLimit` | 50% | Max single-swap price impact |

### 8.6 Bot Engine Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `BOT_COUNT` | 100 | Number of autonomous agents |
| `BOT_FUNDING` | 1000 ETH | Initial ETH per bot |
| `DEPLOYER_FUNDING` | 10000 ETH | Initial ETH for deployer |
| `TICK_INTERVAL` | 1000ms | Milliseconds between bot ticks |
| `MAX_GAS_PER_ACTION` | 500000 | Gas limit per bot action |
| `SLIPPAGE_TOLERANCE` | 2% | Max acceptable slippage |

---

## Appendix A: Contract Dependency Graph

```
MockAuToken ◄─────────────────────────────────────────────────────┐
MockAgToken ◄─────────────────────────────────────────────────┐   │
                                                            │   │
DexSimulator ◄──────────────────────────────────────────────┘   │
    │                                                            │
    └────► SandboxLPToken                                        │
              │                                                  │
              └────► MockStaking                                 │
                        │                                        │
                        └────► MockPIDController ◄──────────────┘
                                  │
                                  └────► MockTreasuryAMO ◄─────┘
                                            │
                                            └────► MockGovernor
```

## Appendix B: State Transitions

```
[Idle] ──► [LP Provided] ──► [Staked] ──► [Earning Yield]
   ▲              │                │              │
   │              │                │              │
   └──────────────┴────────────────┴──────────────┘
              (unstake + remove liquidity)
```

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Au** | Gold — the reserve/asset token in the system |
| **Ag** | Silver — the protocol/governance token |
| **LP** | Liquidity Provider — someone who deposits tokens into the DEX |
| **AMO** | Autonomous Market Operation — automated market intervention |
| **PID** | Proportional-Integral-Derivative — control algorithm for TVL targeting |
| **TVL** | Total Value Locked — aggregate value in the system |
| **IL** | Impermanent Loss — LP risk from price divergence |
| **Flywheel** | Positive feedback loop where each step reinforces the next |

---

*Generated from source: av_treasury/sandbox/*
