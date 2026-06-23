# AV Treasury — Technical Architecture

*Contract-by-contract breakdown with function signatures, storage layout, access control, and deployment wiring.*

**Solidity:** 0.8.20 | **Chain:** Base (8453) | **Upgradeability:** UUPS | **License:** MIT

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Contract Dependency Graph](#2-contract-dependency-graph)
3. [AuToken](#3-autoken)
4. [AgToken](#4-agtoken)
5. [ArtifactTimelock](#5-artifacttimelock)
6. [AVLPStaking_v2](#6-avlpstaking_v2)
7. [PID_Emission_Controller_v2](#7-pid_emission_controller_v2)
8. [TreasuryAMO](#8-treasuryamo)
9. [GovernorContract](#9-governorcontract)
10. [MockLPNFT](#10-mocklpnft)
11. [Access Control Matrix](#11-access-control-matrix)
12. [Upgrade Flow](#12-upgrade-flow)
13. [Deployment Order & Wiring](#13-deployment-order--wiring)
14. [Gas Considerations](#14-gas-considerations)
15. [Wiring Diagram (ASCII)](#15-wiring-diagram-ascii)

---

## 1. Architecture Overview

The AV Treasury system consists of 8 core contracts deployed behind UUPS proxy patterns where upgradeability is required. The architecture separates concerns into four layers:

```
┌─────────────────────────────────────────────────────────┐
│                    GOVERNANCE LAYER                      │
│  GovernorContract ─── ArtifactTimelock                   │
│         │                   │                            │
│         │              48h delay                         │
│         ▼                   ▼                            │
├─────────────────────────────────────────────────────────┤
│                    ECONOMIC LAYER                        │
│  TreasuryAMO ◄──── PID_Emission_Controller_v2            │
│         │                   │                            │
│    buybacks            Ag mint                           │
│         │                   │                            │
│         ▼                   ▼                            │
├─────────────────────────────────────────────────────────┤
│                    STAKING LAYER                         │
│  AVLPStaking_v2 ◄──── MockLPNFT (or real Aerodrome NFT)  │
│         │                                                │
│    Au + Ag rewards                                       │
│    Ag-based multiplier                                   │
│         │                                                │
│         ▼                                                │
├─────────────────────────────────────────────────────────┤
│                    TOKEN LAYER                           │
│  AuToken (ERC20+Permit+FlashMint)                        │
│  AgToken (ERC20+Permit+Votes)                            │
│         │           │                                    │
│    9 bps fee     PID emission                            │
│    burn + accum  no genesis mint                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Contract Dependency Graph

```
AuToken ◄─────────────── No dependencies
AgToken ◄─────────────── No dependencies
MockLPNFT ◄───────────── No dependencies
ArtifactTimelock ◄────── No dependencies
         │
         ▼
AVLPStaking_v2 ◄──────── Depends on: AuToken, AgToken, MockLPNFT
         │
         ▼
PID_Emission_Controller_v2 ◄── Depends on: AgToken, AVLPStaking_v2 (for TVL)
         │
         ▼
TreasuryAMO ◄─────────── Depends on: AuToken, reserveToken, DEX router
         │
         ▼
GovernorContract ◄────── Depends on: AgToken, ArtifactTimelock
```

---

## 3. AuToken

**File:** `contracts/av_suite/AuToken.sol`
**Inherits:** ERC20Upgradeable, ERC20PermitUpgradeable, ERC20FlashMintUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable

### Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `_balances` | `mapping(address => uint256)` | ERC20 balances |
| 1 | `_allowances` | `mapping(address => mapping(address => uint256))` | ERC20 allowances |
| 2 | `_totalSupply` | `uint256` | Total Au supply |
| 3 | `_name` | `string` | Token name |
| 4 | `_symbol` | `string` | Token symbol |
| 5 | `_roles` | `mapping(bytes32 => RoleData)` | AccessControl roles |
| 6 | `_paused` | `bool` | Pausable state |
| 7 | `feeBasisPoints` | `uint256` | Current fee in bps (default: 9) |
| 8 | `maxFeeBasisPoints` | `uint256` | Max fee cap in bps (default: 500) |
| 9 | `accumulatedFees` | `uint256` | Fees collected for treasury |
| 10 | `blockedAddresses` | `mapping(address => bool)` | Blocklist |
| 11 | `cooldownPeriod` | `uint256` | Anti-bot sell cooldown |
| 12 | `lastSellTimestamp` | `mapping(address => uint256)` | Last sell time per address |
| 13 | `maxTransactionAmount` | `uint256` | 1% of supply |
| 14 | `maxWalletAmount` | `uint256` | 1% of supply |
| 15 | `feesEnabled` | `bool` | Fee toggle |

### Key Functions

```solidity
/// @notice Initialize the AuToken proxy
/// @param deployer The deployer address (receives MINTER_ROLE, ANTI_BOT_ROLE, DEFAULT_ADMIN_ROLE)
function initialize(address deployer) external initializer;

/// @notice Override transfer to apply fee logic
function _transfer(address from, address to, uint256 amount) internal override;

/// @notice Calculate flash mint fee (9 bps)
function _flashFee(address token, uint256 amount) internal view override returns (uint256);

/// @notice Execute flash mint with fee
function flashLoan(IERC3156FlashBorrower receiver, address token, uint256 amount, bytes calldata data) external override returns (bool);

/// @notice Set fee basis points (governance only, capped at maxFeeBasisPoints)
function setFeeBasisPoints(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Toggle fee on/off (admin only)
function setFeesEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Block an address (anti-bot)
function blockAddress(address account) external onlyRole(ANTI_BOT_ROLE);

/// @notice Unblock an address
function unblockAddress(address account) external onlyRole(ANTI_BOT_ROLE);

/// @notice Set cooldown period (max 7 days)
function setCooldownPeriod(uint256 period) external onlyRole(ANTI_BOT_ROLE);

/// @notice Withdraw accumulated fees to treasury
function withdrawAccumulatedFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Emergency pause
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Unpause
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Override _beforeTokenTransfer for blocklist, cooldown, max tx/wallet checks
function _beforeTokenTransfer(address from, address to, uint256 amount) internal override;

/// @notice On-chain SVG tokenURI
function tokenURI(uint256 id) public view override returns (string memory);

/// @notice UUPS upgrade authorization
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

### Fee Logic (in `_transfer`)

```solidity
if (feesEnabled && !isExcluded[from] && !isExcluded[to]) {
    uint256 fee = (amount * feeBasisPoints) / 10000;
    uint256 burnAmount = fee / 2;        // 50% burned
    uint256 accumAmount = fee - burnAmount; // 50% accumulated
    super._transfer(from, address(0), burnAmount);
    accumulatedFees += accumAmount;
    amount -= fee;
}
super._transfer(from, to, amount);
```

---

## 4. AgToken

**File:** `contracts/av_suite/AgToken.sol`
**Inherits:** ERC20Upgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable

### Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `_balances` | `mapping(address => uint256)` | ERC20 balances |
| 1 | `_allowances` | `mapping(address => mapping(address => uint256))` | ERC20 allowances |
| 2 | `_totalSupply` | `uint256` | Total Ag supply |
| 3 | `_name` | `string` | Token name |
| 4 | `_symbol` | `string` | Token symbol |
| 5 | `_roles` | `mapping(bytes32 => RoleData)` | AccessControl roles |
| 6 | `_checkpoints` | `mapping(address => Checkpoint[])` | ERC20Votes checkpoints |
| 7 | `_delegates` | `mapping(address => address)` | Delegation mapping |
| 8 | `_totalSupplyCheckpoints` | `Checkpoint[]` | Total supply checkpoints |

### Key Functions

```solidity
/// @notice Initialize the AgToken proxy
/// @param deployer The deployer address (receives DEFAULT_ADMIN_ROLE)
function initialize(address deployer) external initializer;

/// @notice Mint Ag tokens (restricted to MINTER_ROLE: Staking + PID only)
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE);

/// @notice Burn Ag tokens
function burn(address from, uint256 amount) external;

/// @notice Override _mint for ERC20Votes checkpoint support
function _mint(address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);

/// @notice Override _burn for ERC20Votes checkpoint support
function _burn(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);

/// @notice Override _afterTokenTransfer for ERC20Votes checkpoint support
function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);

/// @notice Delegate voting power
function delegate(address delegatee) external;

/// @notice Delegate by signature (EIP-2612 style)
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;

/// @notice Get current votes for an account
function getVotes(address account) public view override returns (uint256);

/// @notice Get prior votes for an account at a block number
function getPriorVotes(address account, uint256 blockNumber) public view override returns (uint256);

/// @notice UUPS upgrade authorization
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

---

## 5. ArtifactTimelock

**File:** `contracts/av_suite/TimelockController.sol`
**Inherits:** TimelockController (OpenZeppelin)

### Configuration

| Parameter | Value |
|---|---|
| MIN_DELAY | 48 hours |
| MAX_DELAY | 30 days |
| GRACE_PERIOD | 14 days |

### Key Functions

```solidity
/// @notice Initialize timelock
/// @param proposer Address that can propose operations
/// @param canceler Address that can cancel operations
/// @param executor Address that can execute operations
function initialize(address proposer, address canceler, address executor) external;

/// @notice Schedule an operation
function schedule(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt, uint256 delay) external;

/// @notice Execute an operation (after timelock expires)
function execute(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt) external;

/// @notice Cancel a scheduled operation
function cancel(bytes32 id) external;
```

---

## 6. AVLPStaking_v2

**File:** `contracts/av_suite/AVLPStaking_v2.sol`
**Inherits:** AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable, IERC721ReceiverUpgradeable

### Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `auToken` | `AuToken` | Au token contract |
| 1 | `agToken` | `AgToken` | Ag token contract |
| 2 | `lpNFT` | `IERC721` | LP NFT contract |
| 3 | `rewardPerWeightStored` | `uint256` | Accumulated reward per weight |
| 4 | `auRewardRate` | `uint256` | Au reward per block (default: 0.001 Au) |
| 5 | `agRewardRate` | `uint256` | Ag reward per block (default: 0.0001 Ag) |
| 6 | `totalWeight` | `uint256` | Total staked weight |
| 7 | `stakes` | `mapping(uint256 => Stake)` | TokenId → Stake info |
| 8 | `userRewardPerWeightPaid` | `mapping(address => uint256)` | User's last reward checkpoint |
| 9 | `pendingRewards` | `mapping(address => uint256)` | Pending reward amounts |
| 10 | `rateChangeTimestamp` | `uint256` | When rate was last changed |
| 11 | `pendingRateAu` | `uint256` | Pending Au rate (after timelock) |
| 12 | `pendingRateAg` | `uint256` | Pending Ag rate (after timelock) |
| 13 | `agThreshold` | `uint256` | Ag balance for max multiplier (5000) |

### Stake Struct

```solidity
struct Stake {
    address owner;
    uint256 tokenId;
    uint256 weight;
    uint256 depositedAt;
}
```

### Key Functions

```solidity
/// @notice Initialize staking contract
function initialize(address auToken, address agToken, address lpNFT) external initializer;

/// @notice Stake an LP NFT
function stake(uint256 tokenId) external nonReentrant whenNotPaused;

/// @notice Unstake an LP NFT
function unstake(uint256 tokenId) external nonReentrant;

/// @notice Claim pending Au + Ag rewards
function claimRewards() external nonReentrant;

/// @notice Calculate Ag-based multiplier for a staker
/// @param staker The address to calculate multiplier for
/// @return multiplier in basis points (10000 = 1x, 25000 = 2.5x)
function getAgMultiplier(address staker) public view returns (uint256);

/// @notice Set reward rates (48h timelock)
function setRewardRates(uint256 auRate, uint256 agRate) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Apply pending reward rates (after 48h timelock)
function applyRewardRates() external;

/// @notice Recover stuck NFT (admin only)
function recoverNFT(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Calculate pending rewards for an address
function earned(address account) public view returns (uint256 auAmount, uint256 agAmount);

/// @notice UUPS upgrade authorization
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

### Ag Multiplier Formula

```solidity
function getAgMultiplier(address staker) public view returns (uint256) {
    uint256 agBalance = agToken.balanceOf(staker);
    // multiplier = 10000 + (15000 * agBalance) / threshold
    // At threshold (5000 Ag): multiplier = 10000 + 15000 = 25000 (2.5x)
    return 10000 + (15000 * agBalance) / agThreshold;
}
```

---

## 7. PID_Emission_Controller_v2

**File:** `contracts/av_suite/PID_Emission_Controller_v2.sol`
**Inherits:** AccessControl, ReentrancyGuard, Pausable

### Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `agToken` | `AgToken` | Ag token contract |
| 1 | `stakingContract` | `AVLPStaking_v2` | Staking contract (TVL source) |
| 2 | `targetTVL` | `uint256` | Target TVL (default: 10,000,000) |
| 3 | `kp` | `int256` | Proportional gain |
| 4 | `ki` | `int256` | Integral gain |
| 5 | `kd` | `int256` | Derivative gain |
| 6 | `integral` | `int256` | Accumulated integral term |
| 7 | `lastError` | `int256` | Previous error (for derivative) |
| 8 | `lastUpdate` | `uint256` | Last update timestamp |
| 9 | `dailyEmitted` | `uint256` | Ag emitted today |
| 10 | `dailyResetTime` | `uint256` | When daily counter resets |
| 11 | `emergencyStopped` | `bool` | Emergency stop flag |
| 12 | `pendingAdmin` | `address` | Two-step admin transfer |
| 13 | `maxIntegral` | `uint256` | Max integral value (1e24) |

### Key Functions

```solidity
/// @notice Initialize PID controller
function initialize(address admin) external;

/// @notice Calculate and emit Ag based on PID output
function updateEmission() external nonReentrant whenNotPaused;

/// @notice Get current TVL from staking contract
function getCurrentTVL() public view returns (uint256);

/// @notice Set target TVL
function setTargetTVL(uint256 newTarget) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Set PID parameters (bounded: 1e12 to 1e18)
function setPIDParams(uint256 kp, uint256 ki, uint256 kd) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Set staking contract reference
function setStakingContract(address staking) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Emergency stop toggle
function setEmergencyStop(bool stopped) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Two-step admin transfer: initiate
function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Two-step admin transfer: accept
function acceptAdmin() external;

/// @notice Pause
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Unpause
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
```

### PID Algorithm

```solidity
function _calculateEmission() internal returns (uint256) {
    uint256 currentTVL = getCurrentTVL();
    int256 error = int256(targetTVL) - int256(currentTVL);

    // Proportional
    int256 proportional = kp * error;

    // Integral with decay
    integral = (integral * 99) / 100; // Decay
    integral += ki * error;
    if (integral > int256(maxIntegral)) integral = int256(maxIntegral);
    if (integral < -int256(maxIntegral)) integral = -int256(maxIntegral);

    // Derivative
    int256 derivative = kd * (error - lastError);
    lastError = error;

    // PID output
    int256 output = proportional + integral + derivative;

    // Clamp to emission bounds
    if (output <= 0) return 0;
    if (output > int256(MAX_SINGLE_EMISSION)) return MAX_SINGLE_EMISSION;

    // Check daily cap
    if (dailyEmitted >= MAX_DAILY_EMISSION) return 0;

    uint256 emission = uint256(output);
    if (dailyEmitted + emission > MAX_DAILY_EMISSION) {
        emission = MAX_DAILY_EMISSION - dailyEmitted;
    }

    dailyEmitted += emission;
    return emission;
}
```

---

## 8. TreasuryAMO

**File:** `contracts/av_suite/TreasuryAMO.sol`
**Inherits:** AccessControl, ReentrancyGuard, Pausable

### Storage Layout

| Slot | Variable | Type | Description |
|---|---|---|---|
| 0 | `auToken` | `AuToken` | Au token contract |
| 1 | `reserveToken` | `IERC20` | Reserve token (USDC, cbBTC, etc.) |
| 2 | `primaryRouter` | `address` | Aerodrome router |
| 3 | `backupRouter` | `address` | Uniswap router |
| 4 | `lastBuybackTime` | `uint256` | Last buyback timestamp |
| 5 | `buybackCooldown` | `uint256` | 24 hours |
| 6 | `buybackBps` | `uint256` | 20% of reserves above runway |
| 7 | `maxSlippageBps` | `uint256` | 0.5% max slippage |
| 8 | `twapDeviationBps` | `uint256` | 5% max TWAP deviation |
| 9 | `epochCapBps` | `uint256` | 5% of reserve per epoch |
| 10 | `runwayThreshold` | `uint256` | Minimum reserve to maintain |

### Key Functions

```solidity
/// @notice Initialize TreasuryAMO
function initialize(address auToken, address reserveToken, address primaryRouter, address backupRouter) external;

/// @notice Execute automated buyback
function executeBuyback() external nonReentrant whenNotPaused;

/// @notice Get buyback amount (20% of reserves above runway)
function getBuybackAmount() public view returns (uint256);

/// @notice Validate TWAP price (max 5% deviation)
function validateTWAP() public view returns (bool);

/// @notice Emergency withdraw (when paused)
function emergencyWithdraw(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Set buyback parameters
function setBuybackParams(uint256 bps, uint256 cooldown, uint256 slippage, uint256 twapDev, uint256 epochCap) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Set reserve token
function setReserveToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Pause
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);

/// @notice Unpause
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
```

### Buyback Logic

```solidity
function executeBuyback() external nonReentrant whenNotPaused {
    require(block.timestamp >= lastBuybackTime + buybackCooldown, "Cooldown active");
    require(validateTWAP(), "TWAP deviation too high");

    uint256 buybackAmount = getBuybackAmount();
    require(buybackAmount > 0, "Nothing to buyback");

    // Check epoch cap
    uint256 epochCap = (reserveBalance() * epochCapBps) / 10000;
    if (buybackAmount > epochCap) buybackAmount = epochCap;

    // Execute swap on primary router (Aerodrome)
    // Slippage check: max 0.5%
    // On failure, try backup router (Uniswap)

    lastBuybackTime = block.timestamp;
}
```

---

## 9. GovernorContract

**File:** `contracts/av_suite/GovernorContract.sol`
**Inherits:** Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl

### Configuration

| Parameter | Value |
|---|---|
| Voting Token | AgToken (ERC20Votes) |
| Voting Delay | 1 block |
| Voting Period | 216,000 blocks (~3 days at 12s/block) |
| Proposal Threshold | 100,000 Ag |
| Quorum | 4% of total supply |
| Standard Approval | 66% |
| Critical Approval | 80% |
| Timelock | 48 hours (via ArtifactTimelock) |

### Key Functions

```solidity
/// @notice Initialize governor
function initialize(address agToken, address timelock) external initializer;

/// @notice Create a proposal
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public override returns (uint256 proposalId);

/// @notice Cast vote on a proposal
function vote(uint256 proposalId, bool support) external;

/// @notice Cast vote with reason
function voteWithReason(uint256 proposalId, bool support, string calldata reason) external;

/// @notice Queue a passed proposal (enters timelock)
function queue(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public override returns (uint256 proposalId);

/// @notice Execute a queued proposal (after timelock)
function execute(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public payable override returns (uint256 proposalId);

/// @notice Cancel a proposal
function cancel(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public override returns (uint256 proposalId);

/// @notice Get proposal state
function state(uint256 proposalId) public view override returns (ProposalState);

/// @notice Check if proposal has quorum
function quorumReached(uint256 proposalId) public view override returns (bool);

/// @notice Check if proposal has sufficient votes
function voteSucceeded(uint256 proposalId) public view override returns (bool);
```

### Proposal States

```
Pending → Active → Canceled
                   → Defeated
                   → Succeeded → Queued → Executed
                                         → Expired
```

---

## 10. MockLPNFT

**File:** `contracts/av_suite/MockLPNFT.sol`
**Inherits:** ERC721, ERC721Enumerable, Ownable

### Key Functions

```solidity
/// @notice Mint a mock LP NFT (owner only, for testing)
function mint(address to, uint256 tokenId) external onlyOwner;

/// @notice Batch mint for bootstrapping
function batchMint(address to, uint256[] calldata tokenIds) external onlyOwner;

/// @notice Burn a token
function burn(uint256 tokenId) external;
```

**Note:** In production, this is replaced by real Aerodrome LP NFTs.

---

## 11. Access Control Matrix

| Role | Contract | Holders | Capability |
|---|---|---|---|
| `DEFAULT_ADMIN_ROLE` | AuToken | Deployer → DAO | Full admin, fee config, pause |
| `MINTER_ROLE` | AuToken | Deployer (renounced) | Mint Au (disabled after setup) |
| `ANTI_BOT_ROLE` | AuToken | Deployer → DAO | Blocklist, cooldown, max tx/wallet |
| `DEFAULT_ADMIN_ROLE` | AgToken | Deployer → DAO | Full admin, role management |
| `MINTER_ROLE` | AgToken | Staking + PID | Mint Ag (algorithmic only) |
| `UPGRADER_ROLE` | AgToken | DAO (Governor) | Execute upgrades |
| `PROPOSER_ROLE` | Timelock | GovernorContract | Schedule proposals |
| `EXECUTOR_ROLE` | Timelock | GovernorContract | Execute after timelock |
| `CANCELER_ROLE` | Timelock | Deployer → DAO | Cancel scheduled ops |
| `DEFAULT_ADMIN_ROLE` | Staking | Deployer → DAO | Rate changes, recovery |
| `DEFAULT_ADMIN_ROLE` | PID | Deployer → DAO | Params, emergency stop |
| `DEFAULT_ADMIN_ROLE` | TreasuryAMO | Deployer → DAO | Buyback params, emergency withdraw |
| `UPGRADER_ROLE` | Staking | DAO (Governor) | Execute upgrades |

### Role Separation Invariants

1. No single role can both mint and burn Au
2. No single role can both pause and unpause without timelock
3. Ag minting is restricted to algorithmic contracts only (Staking + PID)
4. Upgrade authority is held by DAO, not deployer (after transfer)
5. Two-step admin transfer for PID controller prevents single-tx compromise

---

## 12. Upgrade Flow

All upgradeable contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern.

### Upgrade Process

```
1. Deploy new implementation contract
2. Submit upgrade proposal via GovernorContract
3. Proposal enters 48h timelock (ArtifactTimelock)
4. After timelock, UPGRADER_ROLE calls proxy.upgradeTo(newImpl)
5. New implementation is active
```

### Storage Layout Preservation

When upgrading, the new implementation MUST preserve the storage layout of the existing contract:

- New variables can only be appended at the end
- Existing variable types and order cannot change
- Gap slots should be reserved for future additions

### Upgrade Authorization

```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

Only the `UPGRADER_ROLE` (held by the DAO/GovernorContract) can authorize upgrades.

---

## 13. Deployment Order & Wiring

### Deploy Order

```
Step 1: AuToken          (no dependencies)
Step 2: AgToken          (no dependencies)
Step 3: MockLPNFT        (no dependencies)
Step 4: ArtifactTimelock (configure proposer, canceler, executor)
Step 5: AVLPStaking_v2   (wire Au, Ag, NFT)
Step 6: PID_Emission     (set admin)
Step 7: TreasuryAMO      (wire Au, reserveToken, router)
Step 8: GovernorContract (wire Ag, Timelock)
```

### Wiring Steps

```solidity
// 1. Deploy AuToken
AuToken auToken = new AuToken();
auToken.initialize(deployer);

// 2. Deploy AgToken
AgToken agToken = new AgToken();
agToken.initialize(deployer);

// 3. Deploy MockLPNFT
MockLPNFT nft = new MockLPNFT();

// 4. Deploy Timelock
ArtifactTimelock timelock = new ArtifactTimelock();
timelock.initialize(deployer, deployer, deployer);

// 5. Deploy Staking
AVLPStaking_v2 staking = new AVLPStaking_v2();
staking.initialize(address(auToken), address(agToken), address(nft));

// 6. Deploy PID Controller
PID_Emission_Controller_v2 pid = new PID_Emission_Controller_v2();
pid.initialize(deployer);

// 7. Deploy TreasuryAMO
TreasuryAMO amo = new TreasuryAMO();
amo.initialize(address(auToken), reserveToken, aerodromeRouter, uniswapRouter);

// 8. Deploy Governor
GovernorContract governor = new GovernorContract();
governor.initialize(address(agToken), address(timelock));

// === WIRING ===

// Grant MINTER_ROLE on AgToken to Staking and PID
agToken.grantRole(MINTER_ROLE, address(staking));
agToken.grantRole(MINTER_ROLE, address(pid));

// Grant PROPOSER + EXECUTOR roles on Timelock to Governor
timelock.grantRole(PROPOSER_ROLE, address(governor));
timelock.grantRole(EXECUTOR_ROLE, address(governor));

// Set PID references
pid.setAuToken(address(auToken));
pid.setAgToken(address(agToken));
pid.setStakingContract(address(staking));
pid.setTargetTVL(10_000_000e18);

// Set initial staking reward rates
staking.setRewardRates(0.001e18, 0.0001e18);

// Transfer admin roles to DAO (after governance is live)
auToken.grantRole(DEFAULT_ADMIN_ROLE, address(governor));
agToken.grantRole(DEFAULT_ADMIN_ROLE, address(governor));
```

---

## 14. Gas Considerations

### Gas Optimization Strategies

| Strategy | Application |
|---|---|
| UUPS proxy | Cheaper than Transparent proxy (no admin overhead per call) |
| Custom errors | Used instead of require strings (saves ~50 gas per revert) |
| Unchecked math | Used where overflow is impossible (saves ~30 gas per op) |
| Calldata params | External functions use `calldata` instead of `memory` |
| Batch operations | Where possible, batch state changes in single tx |
| Optimizer runs | 200 runs (optimized for average call frequency) |

### Estimated Gas Costs

| Operation | Estimated Gas |
|---|---|
| Au transfer (with fee) | ~55,000 |
| Au transfer (excluded) | ~45,000 |
| Ag transfer | ~50,000 |
| Stake LP NFT | ~150,000 |
| Unstake LP NFT | ~120,000 |
| Claim rewards | ~80,000 |
| Propose (Governor) | ~200,000 |
| Vote | ~60,000 |
| Queue | ~80,000 |
| Execute | ~100,000+ (depends on proposal) |
| PID updateEmission | ~120,000 |
| TreasuryAMO buyback | ~200,000+ (depends on DEX swap) |

### Block Gas Limit Considerations

- Base L2 has a 30M gas per block limit
- Buyback operations should be split across multiple blocks if complex
- PID emission updates are designed to fit within a single block
- Governance operations (propose, vote, queue, execute) are each separate transactions

---

## 15. Wiring Diagram (ASCII)

```
                    ┌──────────────────────┐
                    │    GovernorContract   │
                    │  (OZ Governor +       │
                    │   TimelockControl)    │
                    └──────────┬───────────┘
                               │ PROPOSER_ROLE
                               │ EXECUTOR_ROLE
                               ▼
                    ┌──────────────────────┐
                    │  ArtifactTimelock     │
                    │  MIN_DELAY: 48h       │
                    │  MAX_DELAY: 30d       │
                    │  GRACE: 14d           │
                    └──────────────────────┘

┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│   AuToken    │    │   AgToken    │    │   MockLPNFT      │
│  ERC20+Permit│    │  ERC20+Votes │    │   ERC721         │
│  +FlashMint  │    │              │    │                  │
│  9bps fee    │    │  No genesis  │    │  (testing only)  │
│  burn+accum  │    │  PID mint    │    └────────┬─────────┘
└──────┬───────┘    └──────┬───────┘             │
       │                   │                     │
       │                   │ MINTER_ROLE         │
       │                   │                     │
       │            ┌──────┴─────────────────────┴──┐
       │            │      AVLPStaking_v2            │
       │            │  Stake LP NFTs                 │
       │            │  Earn Au + Ag per block        │
       │            │  Ag multiplier: 1x → 2.5x     │
       │            │  48h rate change timelock      │
       │            └──────┬─────────────────────────┘
       │                   │
       │                   │ TVL data
       │                   │
       │            ┌──────┴──────────────┐
       │            │ PID_Emission_v2      │
       │            │ kp, ki, kd           │
       │            │ target TVL           │
       │            │ daily cap: 100k Ag   │
       │            │ single cap: 10k Ag   │
       │            └──────┬──────────────┘
       │                   │
       │                   │ mints Ag
       │                   │
       ▼                   ▼
┌──────────────────────────────────────────┐
│              TreasuryAMO                  │
│  Automated buybacks                      │
│  20% of reserves above runway            │
│  24h cooldown                            │
│  TWAP validation (5% max deviation)      │
│  Slippage protection (0.5%)              │
│  Per-epoch cap (5% of reserve)           │
│  Dual DEX: Aerodrome + Uniswap          │
└──────────────────────────────────────────┘

        VALUE FLOW (Flywheel):

   Au transfer → 9bps fee
       ├── 4.5bps → BURNED (Au ↓)
       └── 4.5bps → Treasury
            │
            ▼
       TreasuryAMO buyback
       Reserve → DEX → Au
            │
            ▼
       Stakers earn Au + Ag
       Ag multiplier boosts yield
            │
            ▼
       PID adjusts Ag emission
       based on TVL vs target
            │
            ▼
       Ag holders govern
       Propose → Vote → Timelock → Execute
            │
            ▼
       System grows → More usage → More fees
            │
            ▼
       ══════ LOOP CLOSES ══════
```

---

*This document is the definitive technical reference for the AV Treasury system. For economic analysis, see TOKENOMICS.md. For security analysis, see SECURITY.md. For mathematical formalization, see research/FLYWHEEL_ANALYSIS.md.*
