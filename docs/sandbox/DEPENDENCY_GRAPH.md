---
title: Contract Dependency Graph
date: 2026-06-29
status: canonical
description: ASCII and Mermaid dependency graphs for all 14 AV Treasury contracts.
category: sandbox
related: [sandbox/CONTRACT_INVENTORY.md, sandbox/CRITICAL_PATH.md, sandbox/DEPLOYMENT_READINESS.md]
---

# AV TREASURY — Contract Dependency Graph

**Date:** 2026-06-24  
**Scope:** All 14 contracts — Production + Sandbox  
**Format:** ASCII + Mermaid diagrams  

---

## 1. Production Layer — Full Dependency Graph

### 1.1 Mermaid Diagram

```mermaid
graph TD
    subgraph Tokens
        AgToken[AgToken.sol<br/>Governance/Elastic]
        AuToken[AuToken.sol<br/>Utility/Deflationary]
    end

    subgraph Core
        PID[PID_Emission_Controller_v2<br/>Emission Brain]
        Staking[AVLPStaking_v2<br/>LP NFT Staking]
        TreasuryAMO[TreasuryAMO<br/>Buyback Engine]
    end

    subgraph Governance
        Governor[GovernorContract<br/>DAO Governance]
        Timelock[ArtifactTimelock<br/>48h Gate]
    end

    subgraph Oracle
        AvOracle[AvOracle<br/>Multi-source Oracle]
        ITvlSource[ITvlSource<br/>Interface]
    end

    subgraph Sandbox
        MockLPNFT[MockLPNFT<br/>Placeholder NFT]
        DexSimulator[DexSimulator<br/>AMM]
        MockTokens[MockTokens<br/>Sandbox Tokens]
    end

    %% Token interactions
    AuToken -->|fee accumulation| TreasuryAMO
    AgToken -.->|mint authority| PID
    PID -->|mint Ag to| Staking
    Staking -->|rewards| AuToken
    Staking -->|rewards| AgToken

    %% TVL data flow
    Staking -->|totalStakedNFTs()| PID
    Staking -.->|getTvl()| ITvlSource
    AvOracle -.->|getTvl()| ITvlSource

    %% Buyback flow
    TreasuryAMO -->|buy Au| AuToken
    TreasuryAMO -->|swap on| DexSimulator

    %% Governance
    Governor -->|controls| Timelock
    Timelock -->|admin| AgToken
    Timelock -->|admin| AuToken
    Timelock -->|admin| Staking
    Timelock -->|admin| PID
    Timelock -->|admin| TreasuryAMO
    Timelock -->|admin| AvOracle

    %% Staking interactions
    Staking -->|holds LP| MockLPNFT
    Staking -->|reads Ag balance| AgToken

    %% Sandbox
    DexSimulator -->|trades| AgToken
    DexSimulator -->|trades| AuToken
    MockTokens -->|wraps| AgToken
    MockTokens -->|wraps| AuToken
```

### 1.2 ASCII Dependency Graph

```
═══════════════════════════════════════════════════════════════════════════
                    PRODUCTION DEPENDENCY GRAPH
═══════════════════════════════════════════════════════════════════════════

                              ┌─────────────────┐
                              │  GovernorContract│
                              │  (DAO)           │
                              └────────┬────────┘
                                       │ proposes/votes/executes
                                       ▼
                              ┌─────────────────┐
                              │ArtifactTimelock │
                              │  (48h gate)      │
                              └────────┬────────┘
                                       │ admin over all
           ┌───────────────────────────┼───────────────────────────┐
           │               │               │               │       │
           ▼               ▼               ▼               ▼       ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ ┌────────┐
    │  AgToken   │  │  AuToken   │  │  Staking   │  │   PID    │ │Treasury│
    │ (govern)   │  │ (utility)  │  │ (TVL eng)  │  │ (brain)  │ │  AMO   │
    └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └────┬─────┘ └───┬────┘
           │               │               │              │           │
           │               │ fee           │ stake        │ mint Ag   │ buy Au
           │               ▼               ▼              ▼           ▼
           │          ┌─────────┐    ┌──────────┐    ┌─────────┐  ┌────────┐
           │          │Treasury │    │MockLPNFT │    │ Staking │  │AuToken│
           │          │  AMO    │    │ (collateral)  │(receives)│  │(target)│
           │          └────┬────┘    └──────────┘    └─────────┘  └────────┘
           │               │
           │               │ swap
           │               ▼
           │          ┌───────────┐
           │          │DexSimulator│
           │          │  (DEX)     │
           │          └─────┬─────┘
           │                │ trades
           └────────────────┘

    ┌─────────────────────────────────────────────┐
    │              AvOracle (NOT WIRED)            │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │Chainlink │  │   TWAP   │  │TVL Agg   │  │
    │  │(primary) │  │(fallback)│  │(multi-src│  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    │                    │                         │
    │              ITvlSource (interface)          │
    │                    │                         │
    │     ┌──────────────┼──────────────┐          │
    │     ▼              ▼              ▼          │
    │  Staking       Future         Future        │
    │  .totalStaked  Pool1         Pool2          │
    └─────────────────────────────────────────────┘
```

---

## 2. Sandbox Layer — Full Dependency Graph

### 2.1 Mermaid Diagram

```mermaid
graph TD
    subgraph Tokens
        MockAu[MockAuToken<br/>1M supply, 9bps]
        MockAg[MockAgToken<br/>100M cap]
    end

    subgraph DEX
        DexSim[DexSimulator<br/>Ag/Au AMM]
        LPToken[SandboxLPToken<br/>ERC20 wrapper]
    end

    subgraph Core
        MockStake[MockStaking<br/>LP → Au+Ag yield]
        MockPID[MockPIDController<br/>PID emission]
        MockAMO[MockTreasuryAMO<br/>Ag→Au buyback]
    end

    subgraph DAO
        MockGov[MockGovernor<br/>propose→vote→queue→exec]
    end

    %% Token flow
    MockAu -->|fee reserve| MockAMO
    MockAg -->|PID mint| MockPID
    MockPID -->|mint to| MockStake
    MockStake -->|rewards| MockAu
    MockStake -->|rewards| MockAg

    %% DEX flow
    MockAg -->|tokenA| DexSim
    MockAu -->|tokenB| DexSim
    LPToken -->|wraps LP| DexSim
    MockStake -->|stakes| LPToken

    %% PID reads TVL
    MockStake -->|getTvl()| MockPID

    %% Buyback
    MockAMO -->|swap Ag→Au| DexSim

    %% Governance
    MockGov -->|controls| MockPID
    MockGov -->|controls| MockAMO
    MockGov -->|controls| MockStake
```

### 2.2 ASCII Dependency Graph

```
═══════════════════════════════════════════════════════════════════════════
                    SANDBOX DEPENDENCY GRAPH
═══════════════════════════════════════════════════════════════════════════

                         ┌─────────────────┐
                         │  MockGovernor   │
                         │  (DAO over all) │
                         └────────┬────────┘
                                  │ controls
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌────────────┐     ┌────────────┐     ┌────────────┐
       │ MockPID    │     │MockTreasury│     │MockStaking │
       │ Controller │     │    AMO     │     │            │
       └──────┬─────┘     └──────┬─────┘     └──────┬─────┘
              │                  │                   │
              │ mint Ag          │ swap Ag→Au        │ stake LP
              ▼                  ▼                   ▼
       ┌────────────┐     ┌────────────┐     ┌────────────┐
       │ MockAgToken│     │ DexSimulator│     │SandboxLP   │
       │ (minted)   │     │ (Ag/Au AMM) │     │  Token     │
       └────────────┘     └──────┬─────┘     └────────────┘
                                 │
                                 │ trades
                                 ▼
                          ┌────────────┐
                          │ MockAuToken│
                          │ (buyback   │
                          │  target)   │
                          └────────────┘
```

---

## 3. Cross-Layer Dependencies

### 3.1 Production ↔ Sandbox Mapping

```
PRODUCTION                          SANDBOX
──────────                          ───────
AgToken.sol              ←→    MockAgToken (in MockTokens.sol)
AuToken.sol              ←→    MockAuToken (in MockTokens.sol)
AVLPStaking_v2.sol       ←→    MockStaking.sol
PID_Emission_Controller  ←→    MockPIDController.sol
TreasuryAMO.sol          ←→    MockTreasuryAMO.sol
GovernorContract.sol     ←→    MockGovernor.sol
ArtifactTimelock.sol     ←→    (not needed)
AvOracle.sol             ←→    (not needed — DexSimulator provides TWAP)
ITvlSource.sol           ←→    (implemented by MockStaking.getTvl())
MockLPNFT.sol            ←→    SandboxLPToken.sol
DexSimulator.sol         ←→    DexSimulator.sol (identical copy)
```

### 3.2 Interface Compatibility

| Interface | Production Implementer | Sandbox Implementer | Compatible? |
|-----------|----------------------|--------------------|-------------|
| ITvlSource.getTvl() | AVLPStaking_v2.totalStakedNFTs() | MockStaking.totalStaked | ⚠️ Different signatures |
| IAgToken.mint() | AgToken.mint() | MockAgToken.mint() | ✅ Compatible |
| IStaking.totalStakedNFTs() | AVLPStaking_v2 | MockStaking (no NFTs) | ⚠️ Different model |
| IDexSimulator | DexSimulator (prod) | DexSimulator (sandbox) | ✅ Identical |

### 3.3 Key Interface Differences

**ITvlSource:**
```
Production: AVLPStaking_v2.totalStakedNFTs() returns sum of NFT weights
Sandbox:    MockStaking.totalStaked returns sum of LP token amounts
            → Different units (weight-based vs amount-based)
```

**IDexSimulator (TreasuryAMO ↔ DEX):**
```
Production TreasuryAMO: swapExactTokensForTokens(amountIn, minOut, path, to, deadline)
Sandbox DexSimulator:   swapAforB(uint256 amountAIn) → returns amountBOut
            → Different signature (no path, no to, no deadline)
```

---

## 4. Data Flow — Complete Map

### 4.1 Primary Data Flows

```
FLOW 1: Fee Collection
  User → AuToken.transfer() → 9bps fee
    → 4.5bps → AuToken._update(from, address(0), burnAmount) [BURN]
    → 4.5bps → AuToken._update(from, treasury, feeAmount) [ACCUMULATE]
  Treasury → AuToken.withdrawFees() → mint Au to TreasuryAMO

FLOW 2: Buyback
  Keeper → TreasuryAMO.executeBuyback(reserveAmount, minAuOut)
    → _validateTWAPPrice() [check < 5% deviation]
    → _getExpectedOutput() [query DEX]
    → swapExactTokensForTokens(reserveToken → Au)
    → balanceBefore pattern [prevent donation attack]
    → Update: lastOperationTime, totals

FLOW 3: TVL Oracle
  Stakers → AVLPStaking_v2.stake(tokenId, weight) → totalWeights += weight
  PID → staking.totalStakedNFTs() → returns sum of all weights
    → TWATVL update: (99 * old + 1 * new) / 100
    → effectiveTVL = TWATVL

FLOW 4: Ag Emission
  PID.executeEmission() → reads TVL → PID calculation
    → If output > 0: AgToken.mint(staking, emissionAmount)
    → Stakers receive Ag in reward pool

FLOW 5: Reward Distribution
  Staking._distributeRewards() → accRewardPerTokenAu/Ag += delta
  Staking.claimRewards(tokenId) → calculate owed → transfer

FLOW 6: Governance
  Governor.propose() → voting period (30 days)
    → If passed: queue() → timelock (48h)
    → After timelock: execute() → call target contract
    → Can modify: PID params, buyback %, emission caps, staking rates
```

### 4.2 Reflexive Data Loops

```
LOOP 1: PID → Ag → Stakers → TVL → PID (negative feedback)
  PID mints Ag → stakers earn more → more staking → TVL ↑
  → PID error ↓ → less Ag minted → equilibrium

LOOP 2: TreasuryAMO → Au buyback → Au price → fees → TreasuryAMO (positive feedback)
  TreasuryAMO buys Au → Au supply ↓ → Au price ↑
  → Fee value ↑ → more buyback capacity → spiral up
  OR: Au price ↓ → less fee revenue → less buyback → spiral down

LOOP 3: Ag multiplier → yield → staking → TVL → PID → Ag supply → Ag price
  More Ag → higher multiplier → more yield → more staking → TVL ↑
  → PID mints more Ag → Ag supply ↑ → Ag price → affects multiplier value
```

---

## 5. External Dependencies

### 5.1 OpenZeppelin Contracts

| Package | Version | Used By |
|---------|---------|---------|
| @openzeppelin/contracts-upgradeable | v5.6.1 | AgToken, AuToken, AVLPStaking_v2 |
| @openzeppelin/contracts | v5.6.1 | GovernorContract, ArtifactTimelock, AvOracle, TreasuryAMO, PID, MockLPNFT, DexSimulator, MockTokens |

### 5.2 Key OpenZeppelin Modules

| Module | Purpose | Contracts Using |
|--------|---------|----------------|
| UUPSUpgradeable | Proxy pattern | AgToken, AuToken, AVLPStaking_v2 |
| AccessControl | Role-based permissions | AgToken, AuToken, PID, TreasuryAMO, AvOracle |
| ReentrancyGuard | Reentrancy protection | AuToken, AVLPStaking_v2, TreasuryAMO, PID |
| Pausable | Emergency pause | AgToken, AuToken, AVLPStaking_v2, PID, TreasuryAMO |
| Governor | DAO governance | GovernorContract |
| TimelockController | Timelock | ArtifactTimelock |
| ERC20Votes | On-chain voting | AgToken |
| ERC20Permit | Gasless approvals | AgToken, AuToken |
| ERC20FlashMint | Flash loans | AuToken |

### 5.3 Network Dependencies

| Dependency | Network | Purpose |
|------------|---------|---------|
| Aerodrome Router | Base (mainnet) | Primary DEX for buybacks |
| Uniswap V2 Router | Base (mainnet) | Backup DEX for buybacks |
| Chainlink Aggregator | Base (mainnet) | Price feeds (future via AvOracle) |
| USDC | Base (mainnet) | Reserve token for buybacks |

---

## 6. Deployment Dependencies

### 6.1 Constructor Dependencies

```
AgToken.initialize(admin)
  → admin = deployer (later transferred to timelock)

AuToken.initialize(_treasury)
  → _treasury = deployer (later TreasuryAMO)

ArtifactTimelock(proposer, executor, canceler)
  → proposer = Governor
  → executor = Governor + multisig
  → canceler = emergency

GovernorContract(token, executor)
  → token = AgToken
  → executor = Timelock

AVLPStaking_v2.initialize(auToken, agToken, lpNFT)
  → auToken = AuToken
  → agToken = AgToken
  → lpNFT = deployer (placeholder, update via governance)

PID_Emission_Controller(admin, staking, agToken, targetTVL, kp, ki, kd)
  → admin = deployer (later timelock)
  → staking = AVLPStaking_v2
  → agToken = AgToken
  → targetTVL = 10,000,000 * 1e18

TreasuryAMO(auToken, reserveToken, aerodromeRouter, admin)
  → auToken = AuToken
  → reserveToken = USDC
  → aerodromeRouter = Aerodrome router
  → admin = deployer (later timelock)
```

### 6.2 Post-Deployment Configuration

```
1. Grant MINTER_ROLE on AgToken to PID
2. Grant MINTER_ROLE on AuToken to TreasuryAMO
3. Transfer AgToken admin to Timelock
4. Transfer PID admin to Timelock
5. Transfer TreasuryAMO admin to Timelock
6. Transfer AVLPStaking admin to Timelock
7. Fund TreasuryAMO with reserve tokens (USDC)
8. Set up keeper bot roles
```

---

*Document: DEPENDENCY_GRAPH.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
