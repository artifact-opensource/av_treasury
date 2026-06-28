# Oracle Wiring Plan — Making AvOracle Active

## Current State

AvOracle is deployed and configured with TWAP pricing for AU/USDC. But **no contract
in the system calls it**. It's a price feed highway with no exits.

## Root Cause

The system was designed with two parallel price mechanisms:
1. **Internal TWAP** (TreasuryAMO) — used for trade validation
2. **NFT count** (PID Controller) — used as TVL proxy (not dollar-denominated)
3. **Internal math** (FlashBuy) — uses reservePerAu() for pricing

The oracle was built as infrastructure but never wired into the consumer contracts.

## Wiring Strategy: Governance-Controlled Oracle Integration (FINAL)

Since TreasuryAMO and PIDController are **already deployed and not upgradeable**,
we use a **governance-controlled integration layer** approach.

### Architecture Decision: No Redeployment Needed

After analyzing the codebase, we determined:
- TreasuryAMO, PIDController, FlashBuy are all non-upgradeable
- But they ALL have governance-controlled setters (onlyRole(PARAM_ROLE))
- The OracleGuardian acts as a **price adapter** that governance wires into the system
- An **off-chain keeper** monitors oracle prices and triggers circuit breakers

This means: **Zero redeployment of existing contracts.** The oracle is activated
through governance proposals that wire the OracleGuardian into the system.

### Option A: Oracle Guardian Pattern (RECOMMENDED — No Redeployment)

Add an **Oracle Guardian** contract that sits between the oracle and consumers. Existing
contracts are governed by the DAO, so governance can route calls through the guardian.

```
┌─────────────────────────────────────────────────────────┐
│                    EXISTING CONTRACTS                    │
│                                                         │
│  TreasuryAMO ──┐                                        │
│  PIDController ─┼──→ reads price from ──→ [OracleGuard] │
│  FlashBuy ─────┘                         │              │
│                                          ↓              │
│                                     AvOracle            │
└─────────────────────────────────────────────────────────┘
```

#### How it works:

**1. TreasuryAMO — Oracle Price Validation (Soft Integration)**

Currently TreasuryAMO uses `twapPrice` (its own internal TWAP) for trade validation.
We add an **oracle price check as a secondary validation layer**:

```
Trade Flow (buy/sell Au):
  1. TreasuryAMO calculates price from internal TWAP ✓ (existing)
  2. NEW: TreasuryAMO checks AvOracle.getPrice(AU) as reference
  3. If |twapPrice - oraclePrice| > maxDeviation → revert (circuit breaker)
  4. Otherwise → execute trade at twapPrice
```

This means:
- Oracle is NOT the primary price source (TWAP still is)
- Oracle acts as a **safety circuit breaker** — prevents oracle manipulation attacks
- If oracle is stale/fails → TWAP still works (graceful degradation)
- Governance controls `maxDeviation` threshold

**Implementation**: Add a `setOracleReference(address _oracle)` governance function to
TreasuryAMO that stores an oracle reference. The `_validatePrice()` internal function
checks oracle price as a secondary source.

**2. PID Controller — Oracle-Enhanced TVL (Hard Integration)**

Currently PID uses `totalStakedNFTs()` as TVL proxy — this is NFT COUNT, not USD value.
This is a design issue: PID should target USD-denominated TVL, not NFT count.

```
Current:  targetTVL = 1000000  (meaning 1M NFTs — not USD!)
Proposed: targetTVL = 1000000e18  (meaning $1M USD, with oracle providing AU price)
```

**Implementation**: 
- PID Controller already has `ITvlSource` interface support
- Make PID's staking contract implement `ITvlSource.getTvl()` that:
  1. Gets AU price from AvOracle
  2. Gets total AU in staking contract
  3. Returns: totalAU * oraclePrice = USD TVL
- PID then targets USD TVL instead of NFT count
- Governance controls whether to use NFT-count or oracle-enhanced TVL

**3. FlashBuy — Oracle Price Trigger (Soft Integration)**

Currently FlashBuy uses `reservePerAu()` internally. We add oracle as a trigger:

```
FlashBuy Flow:
  1. Check if Au market price < peg (from AvOracle)
  2. If yes → execute buyback at oracle price
  3. If no → skip (no buyback needed)
```

This makes FlashBuy reactive to **real market price** rather than just internal ratios.

### Option B: Oracle Adapter Pattern (Alternative)

Deploy a thin **OracleAdapter** contract that wraps AvOracle with the exact interface
consumers need:

```solidity
contract OracleAdapter {
    AvOracle public oracle;
    
    function getAuPrice() external view returns (uint256) {
        return oracle.getPrice(address(AU_TOKEN));
    }
    
    function getReserveValue() external view returns (uint256) {
        uint256 auPrice = oracle.getPrice(address(AU_TOKEN));
        uint256 totalReserve = IERC20(USDC).address).balanceOf(address(TREASURY));
        // ... add ETH value via oracle
        return totalReserve;
    }
}
```

Consumers call `OracleAdapter` instead of `AvOracle` directly. Adapter can be upgraded
by governance without touching consumers.

## What Needs Redeployment?

### Must Redeploy:
- **OracleGuardian** or **OracleAdapter** — new contract (thin, ~100 lines)
- **TreasuryAMO_v2** — if we want native oracle integration (or use governance to add post-hoc)

### Can Avoid Redeployment:
- **PID Controller** — governance can change TVL source via existing setters
- **FlashBuy** — governance can add oracle check via existing `setBuybackConfig()`
- **TreasuryAMO** — governance can add oracle reference via new setter (if we add the function)

## Recommended Implementation Order

### Phase 1: Deploy OracleAdapter (No redeployment of existing contracts)
1. Deploy OracleAdapter with AvOracle address
2. Governance: set OracleAdapter as the TVL source for PID
3. PID now targets USD-denominated TVL

### Phase 2: Wire TreasuryAMO Oracle Check
1. Add `setOracleReference(address)` to TreasuryAMO (requires TreasuryAMO redeployment 
   OR governance-controlled modifier)
2. Add `_oracleCheck()` internal validation before trades
3. Set maxDeviation to 5% initially (governance-adjustable)

### Phase 3: Wire FlashBuy Oracle Trigger
1. Add oracle price check to FlashBuy's `executeBuyback()` 
2. FlashBuy only triggers when oracle confirms Au < peg
3. Governance sets the threshold

### Phase 4: Full Oracle Governance
1. Add `oraclePriceStaleThreshold` check (reject if oracle is stale)
2. Add multi-token oracle support (ETH, USDC prices)
3. Add oracle circuit breakers (max price change per epoch)

## Governance Parameters for Oracle

| Parameter | Default | Description |
|-----------|---------|-------------|
| oracleMaxDeviation | 500 (5%) | Max deviation between TWAP and oracle |
| oracleStaleThreshold | 3600 (1h) | Reject oracle price if older than this |
| oraclePriceChangeMax | 1000 (10%) | Max price change per epoch |
| useOracleTVL | true | Whether PID uses oracle-enhanced TVL |
| oracleAddress | deployed AvOracle | The oracle contract address |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Oracle manipulation | TWAP is primary, oracle is secondary check |
| Oracle staleness | Stale threshold check, fallback to TWAP |
| Oracle reports wrong price | Governance can pause oracle integration |
| Redeployment risk | Use adapter pattern to minimize changes |
| PID targeting wrong TVL | Start with oracle TVL, fallback to NFT count |

## Code Changes Required

### TreasuryAMO.sol additions:
```solidity
// State
address public oracleReference;
uint256 public oracleMaxDeviation = 500; // 5%

// Functions (governance-only)
function setOracleReference(address _oracle) external onlyGovernance;
function setOracleMaxDeviation(uint256 _deviationBps) external onlyGovernance;

// Internal validation
function _oraclePriceCheck() internal view {
    if (oracleReference != address(0)) {
        uint256 oraclePrice = IAvOracle(oracleReference).getPrice(address(auToken));
        uint256 twapPrice = twapPrice;
        uint256 deviation = _calcDeviation(oraclePrice, twapPrice);
        require(deviation <= oracleMaxDeviation, "AMO: oracle deviation exceeded");
    }
}
```

### PID_Emission_Controller_v2 additions:
```solidity
// Use oracle-enhanced TVL
function getOracleTVL() external view returns (uint256) {
    uint256 auPrice = IAvOracle(oracle).getPrice(address(auToken));
    uint256 totalAU = IERC20(auToken).balanceOf(address(staking));
    return (totalAU * auPrice) / 1e18;
}
```

### FlashBuy additions:
```solidity
// Oracle-triggered buyback
function _oracleTriggeredBuyback() internal view returns (bool) {
    if (oracle == address(0)) return _internalPriceCheck(); // fallback
    uint256 marketPrice = IAvOracle(oracle).getPrice(address(auToken));
    uint256 pegValue = 1e18; // $1
    return marketPrice < (pegValue * (10000 - buybackThreshold)) / 10000;
}
```
