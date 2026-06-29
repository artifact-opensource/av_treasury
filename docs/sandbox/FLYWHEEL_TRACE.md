---
title: Flywheel Trace
date: 2026-06-29
status: canonical
description: Step-by-step exhaustive trace of the complete AV Treasury flywheel mechanism.
category: sandbox
related: [sandbox/ECONOMIC_MODEL.md, sandbox/SIMULATION_RESULTS.md, central-banking/05-flywheel-mechanics.md]
---

# AV TREASURY — Flywheel Trace

**Date:** 2026-06-24  
**Scope:** Complete flywheel — Production + Sandbox  
**Detail Level:** Step-by-step, exhaustive  

---

## 1. The Core Flywheel

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    AV TREASURY FLYWHEEL                                   ║
║                    Closed-Loop Economic System                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

                         ┌─────────────────────┐
                         │   USERS TRANSFER    │
                         │   Au tokens         │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   AuToken collects  │
                         │   9bps transfer fee │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │ 4.5bps (50%)  │  4.5bps (50%) │
                    │               │               │
                    ▼               │               ▼
             ┌────────────┐         │        ┌────────────┐
             │ BURNED     │         │        │ TREASURY   │
             │ (permanent)│         │        │ (buyback)  │
             └─────┬──────┘         │        └──────┬─────┘
                   │                │               │
                   ▼                │               ▼
             ┌────────────┐         │        ┌────────────┐
             │ Au SUPPLY │         │        │TREASURYAMO │
             │ DECREASES │         │        │ buys Au    │
             │ (deflation)│         │        │ on DEX     │
             └─────┬──────┘         │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ Au PRICE ↑ │
                   │                │        │ (less sup) │
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ STAKING    │
                   │                │        │ INCENTIVE ↑│
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ MORE LP    │
                   │                │        │ STAKED     │
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ TVL ↑      │
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ PID reads  │
                   │                │        │ TVL error  │
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ PID mints  │
                   │                │        │ Ag token   │
                   │                │        └──────┬─────┘
                   │                │               │
                   │                │               ▼
                   │                │        ┌────────────┐
                   │                │        │ STAKERS    │
                   │                │        │ EARN Ag    │
                   │                │        └──────┬─────┘
                   │                │               │
                   └────────────────┴───────────────┘
                                  │
                                  ▼
                          LOOP CONTINUS
```

---

## 2. Step-by-Step Flywheel Trace

### 2.1 Phase 1: Boot (Initial Setup)

```
DEPLOYER:
  1. Deploy AgToken + AuToken (proxies → implementation)
  2. Deploy ArtifactTimelock (48h delay)
  3. Deploy GovernorContract (AgToken, Timelock)
  4. Deploy AVLPStaking_v2 (AuToken, AgToken, MockLPNFT)
  5. Deploy PID (admin, staking, AgToken, target=$5M, kp=0.12, ki=0.03)
  6. Deploy TreasuryAMO (AuToken, USDC, AerodromeRouter)
  7. Grant MINTER_ROLE on AgToken → PID
  8. Grant MINTER_ROLE on AuToken → TreasuryAMO
  9. Transfer AgToken admin → Timelock
  10. Transfer PID admin → Timelock
  11. Transfer TreasuryAMO admin → Timelock
  12. Transfer Staking admin → Timelock
  13. Fund TreasuryAMO with USDC reserves
  14. Bootstrap initial liquidity in Aerodrome
  15. Enable AuToken fees

SYSTEM STATE AFTER BOOT:
  Ag supply: 0 (no emissions yet)
  Au supply: 1,000,000,000 (initial mint)
  TVL: 0 (no stakers)
  Target TVL: $500,000 (bootstrap start)
  PID: ready, will mint Ag when TVL > 0
  Treasury: funded with USDC
  Governance: active (Timelock controls all)
```

### 2.2 Phase 2: First Users Enter

```
USER ACTION:
  User buys Au (transfers Au to another address)

AuToken._update(from, to, value):
  ┌─────────────────────────────────────────────────────┐
  │ Transfer: 100,000 Au                                │
  │ Fee: 100,000 × 9bps = 90 Au                        │
  │ Burned: 90 × 50% = 45 Au                           │
  │ Treasury: 90 × 50% = 45 Au                         │
  │                                                     │
  │ Net transfer: 100,000 - 90 = 99,910 Au             │
  │ Super._update(from, to, 99,910)                    │
  │ Super._update(from, 0x0, 45)        [BURN]         │
  │ Super._update(from, treasury, 45)   [FEE]          │
  │                                                     │
  │ RESULT:                                             │
  │   Au supply: 999,999,955 (decreased by 45)         │
  │   Treasury accumulated fees: 45 Au                 │
  └─────────────────────────────────────────────────────┘

TREASURY STATE:
  Accumulated fees: 45 Au (waiting for withdraw)
  Reserve balance: USDC from initial funding
```

### 2.3 Phase 3: Provide Liquidity

```
USER ACTION:
  User provides Au + Ag liquidity to Aerodrome DEX

AerodromePool.addLiquidity(auAmount, agAmount):
  ┌─────────────────────────────────────────────────────┐
  │ User provides 10,000 Au + 1,000 Ag                  │
  │ Pool: 1,000,000 Au + 100,000 Ag (existing)         │
  │ User gets LP tokens proportional to liquidity       │
  │                                                     │
  │ Pool after: 1,010,000 Au + 101,000 Ag              │
  │ LP tokens minted to user                            │
  └─────────────────────────────────────────────────────┘

DEX STATE:
  Reserve Au: 1,010,000
  Reserve Ag: 101,000
  Price: 1 Ag = 10 Au (implied)
  User holds: LP tokens (representing ~1% of pool)
```

### 2.4 Phase 4: Stake LP Tokens

```
USER ACTION:
  User stakes LP NFT in AVLPStaking_v2

Staking.stake(tokenId, weight):
  ┌─────────────────────────────────────────────────────┐
  │ User stakes NFT with weight=1000                    │
  │ Transfer NFT from user to Staking contract          │
  │                                                     │
  │ stakedWeights[tokenId] = 1000                       │
  │ _stakeOwner[tokenId] = user                         │
  │ totalWeights += 1000                                │
  │ _stakedAt[timestamp] = block.timestamp              │
  │                                                     │
  │ Reward accounting:                                  │
  │   debtAu[tokenId] = 1000 × accAuPerWeight          │
  │   debtAg[tokenId] = 1000 × accAgPerWeight          │
  │                                                     │
  │ TVL = totalWeights × (LP value per weight unit)    │
  └─────────────────────────────────────────────────────┘

STAKING STATE:
  User staked: 1 NFT (weight 1000)
  Total staked: 1000 weight
  TVL: ~$20,000 (estimated LP value)
```

### 2.5 Phase 5: PID Emission

```
KEEPER ACTION:
  Calls PID.executeEmission()

PID.executeEmission():
  ┌─────────────────────────────────────────────────────┐
  │ 1. Read TVL: staking.totalStakedNFTs() = $20,000   │
  │ 2. Update TWATVL:                                  │
  │    twatvl = (99 × 500,000 + 1 × 20,000) / 100     │
  │    twatvl = 495,200 (slowly decreasing from 500K)  │
  │ 3. Time elapsed: 7,200 blocks (1 day)               │
  │                                                     │
  │ 4. PID calculation:                                │
  │    error = targetTVL - effectiveTVL                 │
  │    error = 495,200 - 20,000 = 475,200              │
  │                                                     │
  │    P = (0.12 × 475,200) / 1e18 = very small       │
  │    I = (0.03 × new_integral) / 1e18 = very small   │
  │    D = (0.03 × (475,200 - prevError)) / 7200       │
  │                                                     │
  │ 5. Output ≈ 5,000 Ag (within all caps)             │
  │                                                     │
  │ 6. Check caps:                                     │
  │    Single cap (10,000): 5,000 ≤ 10,000 ✓           │
  │    Daily cap (11,000): 5,000 ≤ 11,000 ✓            │
  │                                                     │
  │ 7. AgToken.mint(staking, 5,000)                    │
  │                                                     │
  │ RESULT:                                             │
  │   5,000 Ag minted to staking contract              │
  │   Ag supply: 5,000 / 100,000,000                   │
  │   Stakers owed: 5,000 Au + 5,000 Ag in rewards    │
  └─────────────────────────────────────────────────────┘

EMISSION STATE:
  Ag supply: 5,000 (0.005% of cap)
  Daily emission: 5,000 / 11,000 = 45% of daily cap
  Accumulated rewards: 5,000 Au + 5,000 Ag per user
```

### 2.6 Phase 6: Reward Claim

```
USER ACTION:
  User claims staking rewards

Staking.claimRewards(tokenId):
  ┌─────────────────────────────────────────────────────┐
  │ _updateRewards():                                  │
  │   blocksElapsed = 100 (1 hour on Base)             │
  │   auEarned = 0.001 × 100 × 1e18 = 100 Au          │
  │   agEarned = 0.002 × 100 × 1e18 = 200 Ag          │
  │   deltaAu = (100 × 1e18) / 1000 = 0.1 Au/weight   │
  │   accAuPerWeight += 0.1 Au                         │
  │                                                     │
  │ _claimRewards(user):                                │
  │   staked = 1000                                     │
  │   auOwed = (1000 × 0.1) / 1e18 - 0 = 0.1 Au       │
  │   agOwed = (1000 × 0.2) / 1e18 - 0 = 0.2 Ag       │
  │                                                     │
  │ AuToken.transfer(user, 0.1 Au)                      │
  │ AgToken.transfer(user, 0.2 Ag)                      │
  └─────────────────────────────────────────────────────┘

USER STATE:
  Pending rewards claimed: 0.1 Au + 0.2 Ag
  Staked LP still locked
```

### 2.7 Phase 7: Buyback Execution

```
KEEPER ACTION:
  Calls TreasuryAMO.executeBuyback after fees accumulate

TreasuryAMO.executeBuyback(1000, 50):
  ┌─────────────────────────────────────────────────────┐
  │ 1. Check cooldown: lastOp + 24h ≤ now ✓            │
  │ 2. Check runway: balance - 1000 ≥ minRunway ✓      │
  │ 3. Check epoch cap: 1000 ≤ balance × 5% ✓          │
  │ 4. TWAP validation: price within 5% ✓              │
  │                                                     │
  │ 5. Get expected output:                             │
  │    _getExpectedOutput(1000 USDC)                   │
  │    → Query Aerodrome: getAmountsOut(USDC→Au)      │
  │    → Expected: 950 Au (after slippage)             │
  │                                                     │
  │ 6. Slippage protection:                             │
  │    finalMinOut = max(50, 950 - 5%) = 902          │
  │                                                     │
  │ 7. Execute swap on Aerodrome:                       │
  │    USDC transferred to pool                        │
  │    Au transferred to TreasuryAMO                   │
  │    balanceBefore pattern: received = 940 Au        │
  │                                                     │
  │ 8. Verify: 940 ≥ 902 ✓                             │
  │                                                     │
  │ 9. Update state:                                   │
  │    lastOperationTime = block.timestamp             │
  │    totalBuybacksExecuted += 1                      │
  │    totalAuBought += 940                            │
  │    totalReserveSpent += 1000                       │
  └─────────────────────────────────────────────────────┘

BUYBACK STATE:
  Au bought: 940 (held by TreasuryAMO)
  USDC spent: 1000
  Au supply decreased (tokens now held, not burned)
  Au price: slight upward pressure (removed from pool)
```

### 2.8 Phase 8: Governance Parameter Change

```
DAO ACTION:
  Proposal to change PID target from $500K to $450K

GovernorContract.propose():
  ┌─────────────────────────────────────────────────────┐
  │ Proposer: user with ≥ 100,000 Ag voting power      │
  │ Target: PID_contract address                       │
  │ Call data: setTargetTvl(450000)                    │
  │ Description: "Reduce target to reduce inflation"   │
  │                                                     │
  │ State: Pending                                      │
  │ Vote start: block.number + 1                       │
  │ Vote end: block.number + 216,000 (~30 days)        │
  └─────────────────────────────────────────────────────┘

GovernorContract.castVote(proposalId, true, weight):
  ┌─────────────────────────────────────────────────────┐
  │ Voter: staker with 50,000 Ag (5% of supply)        │
  │ Weight: votingPower(user) = 50,000 Ag              │
  │ Support: true                                       │
  │                                                     │
  │ proposals[id].forVotes += 50,000                   │
  │ hasVoted[id][voter] = true                         │
  └─────────────────────────────────────────────────────┘

After 30 days:
GovernorContract.queue(proposalId):
  ┌─────────────────────────────────────────────────────┐
  │ Check voting closed: block.number > endBlock ✓      │
  │ Check quorum: forVotes (50,000) ≥ 4% × 5,000,000  │
  │              (50,000 ≥ 200,000) ✗                    │
  │                                                     │
  │ If quorum not reached: REVERT                       │
  │ If quorum reached: executeAfter = block + timelock │
  └─────────────────────────────────────────────────────┘

After timelock (48h later):
GovernorContract.execute(proposalId):
  ┌─────────────────────────────────────────────────────┐
  │ Check timelock expired: block.number ≥ execAfter ✓ │
  │ Execute: PID.setTargetTvl(450,000)                 │
  │ proposals[id].executed = true                       │
  └─────────────────────────────────────────────────────┘

GOVERNANCE STATE:
  PID target: reduced from $500K to $450K
  PID will mint less Ag (lower target = less emission)
  Ag inflation: reduced
```

---

## 3. Sandbox Flywheel Trace

### 3.1 Sandbox Boot Sequence

```
DEPLOY (via sandbox/scripts/deploy-sandbox.js on Anvil):
  1. MockAuToken (1M supply, deployer = feeCollector)
  2. MockAgToken (100M cap)
  3. DexSimulator(MockAgToken, MockAuToken)  [Ag/Au pair]
  4. SandboxLPToken(DexSimulator, AgToken, AuToken)
  5. MockStaking(LpToken, AuToken, AgToken, 0.001 Au/blk, 0.002 Ag/blk)
  6. MockPIDController(AgToken, Staking, 0.5, 0.01, 0.1, target=$1M, ...)
  7. MockTreasuryAMO(AgToken, AuToken, DexSimulator, 50 blocks, ...)
  8. MockGovernor(100 blocks voting, 50 blocks timelock, 1000 Ag threshold, 4%)

FUND:
  9. MockAgToken.mint(TreasuryAMO, 500,000 Ag)
  10. MockAuToken.mint(Staking, 100,000 Au) [rewards]
  11. Add liquidity: 50,000 Ag + 50,000 Au to SandboxLPToken
  12. Fund 100 bots: 1000 Ag each

INITIAL STATE:
  Ag supply: 500,000 (treasury) + 100,000 (bots) = 600,000
  Au supply: 1,000,000 (initial) + 100,000 (rewards) + 50,000 (liquidity) = 1,150,000
  DEX reserves: 50,000 Ag + 50,000 Au
  DEX price: 1 Ag = 1 Au
  TVL: 0 (no staked LP)
```

### 3.2 Sandbox: Bot Actions

```
BOT ENGINE (sandbox/bots/BotEngine.js):
  100 autonomous agents, each with personality traits

PERSONALITY TYPES:
  - Conservative: low risk, provides liquidity, claims rewards weekly
  - Aggressive: trades frequently, votes on governance, stakes maximum
  - Whale: large positions, influences price, creates proposals
  - Arbitrage: exploits price discrepancies, keeps DEX in balance
  - Passive: stakes and holds, minimal interaction

EACH BOT EVALUATES EVERY BLOCK:
  1. Check Au/Ag price on DEX
  2. Check staking APY
  3. Check buyback capacity
  4. Check governance proposals
  5. Decide action: swap, stake, vote, claim, propose
  6. Execute action
```

### 3.3 Sandbox: Full Cycle (30-Day Simulation)

```
BLOCK 0-100: Initial State
  DEX: 50,000 Ag / 50,000 Au (1:1)
  Staking: 0 LP staked
  PID: can emit, error = $1,000,000 - 0 = $1,000,000
  Treasury: 500,000 Ag

BLOCK 100-500: Early Adopters Enter
  - 20 bots add liquidity → mint LP tokens
  - 20 bots stake LP → TVL = 200,000 LP ($400,000)
  - PID.tick() executes every 10 blocks (cooldown=10)
  - PID mints Ag based on error: ~1,000 Ag per tick
  - Stakers claim Au + Ag rewards
  - Price impact: Ag supply increases → Ag price drops slightly

BLOCK 500-2,000: Growth Phase
  - More bots enter, add liquidity, stake
  - TVL grows: 400K → 1,500,000
  - PID error decreases: 1M → 500K
  - PID emission decreases: 1,000 → 500 Ag per tick
  - Au transfer fees accumulate in TreasuryAMO
  - First buyback triggered (TreasuryAMO has fees)
  - Buyback: 5,000 Ag spent → ~4,500 Au bought
  - Au price increases (less Au in DEX)

BLOCK 2,000-5,000: Maturity
  - TVL plateaus near target: ~$900,000
  - PID error: ~$100,000 (within deadband)
  - PID emission: minimal (~100 Ag per tick)
  - Buyback frequency increases (fees accumulated)
  - Governance proposals begin (bots propose parameter changes)
  - Bot trading volume increases (arbitrage active)

BLOCK 5,000-10,000: Equilibrium
  - TVL: $800,000-1,000,000 (near target)
  - Au price: stabilized
  - Ag supply: ~5,000,000 (5% of cap)
  - TreasuryAMO: accumulated fees + buybacks ongoing
  - DEX volume: high (bot trading)
  - Staking APY: moderate (Au + Ag yield)
```

---

## 4. Flywheel Feedback Loops

### 4.1 Negative Feedback (Stabilizing)

```
NEGATIVE FEEDBACK LOOP 1: TVL → PID → Ag Supply

TVL increases → PID error decreases → Ag emission decreases
→ Less staker yield → Slower TVL growth → Equilibrium

Example:
  TVL at target ($5M) → error = 0 → PID emits 0
  → No new Ag minted → Stakers earn only Au fees
  → TVL growth slows → Stability

NEGATIVE FEEDBACK LOOP 2: Au Price → Fees → Treasury

Au price drops → Users buy more Au (cheap) → More transfers
→ More fees → Treasury grows → More buyback capacity
→ Au price recovers → Equilibrium
```

### 4.2 Positive Feedback (Growth/Decline)

```
POSITIVE FEEDBACK LOOP 1: Growth Spiral

More users → More Au transfers → More fees
→ Treasury grows → More buybacks → Au price rises
→ Staking incentive increases → More staking → TVL grows
→ PID mints more Ag → Staker yield increases → More staking
→ TVL grows further → Attracts more users

POSITIVE FEEDBACK LOOP 2: Death Spiral

Users leave → Fewer Au transfers → Fewer fees
→ Treasury shrinks → Fewer buybacks → Au price drops
→ Staking incentive decreases → Less staking → TVL drops
→ PID mints less Ag → Staker yield decreases → Less staking
→ TVL drops further → Users leave → Continues
```

### 4.3 Reflexive Loop (Self-Reinforcing)

```
REFLEXIVE LOOP: Ag Multiplier

Stakers accumulate Ag → Multiplier increases (1x → 2.5x)
→ More rewards per staked LP → More staking demand
→ Less Ag in circulation (held for multiplier) → Ag price rises
→ Multiplier value increases → More rewards → More staking
→ Loop continues

RISK: Whale accumulates Ag early → Gets max multiplier
→ Earns disproportionate yield → Accumulates more Ag
→ Governance power centralizes → Sets favorable parameters
→ Extracts value from smaller stakers
```

---

## 5. Flywheel Metrics Summary

| Metric | Target | Current (Sim) | Status |
|--------|--------|---------------|--------|
| TVL | $5,000,000 | $4,303,430 | 86% (near target) |
| Au price stability | > 0.5 | 0.4893 | ⚠️ Below threshold |
| Ag utilization | 20-30% of cap | 11.7% | ✅ Conservative |
| Treasury growth | > 1.0x | 1.46x | ✅ Growing |
| Staking participation | > 60% of Ag | ~100% of stakers | ✅ Active |
| Buyback frequency | Continuous | Every ~24h | ✅ Active |
| Governance activity | > 1 proposal/month | Variable | ⚠️ Needs monitoring |

---

*Document: FLYWHEEL_TRACE.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
