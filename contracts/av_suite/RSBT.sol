// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RSBT (Reissuable Soulbound Token)
 * @notice Wraps LP NFTs into soulbound tokens with in-game debt tracking and multiplier-based reward boost.
 * @dev Users deposit LP NFTs and receive non-transferable RSBT tokens. Each RSBT encodes:
 *      - LP token ID
 *      - LP token value at stake time (in auToken terms)
 *      - In-game debt (tracked by external game server)
 *      - Multiplier (based on user's AgToken balance at stake time)
 *
 * Formula: multiplier = 10000 + (15000 * agBalance) / agThreshold
 *          clamped to [10000, 25000]  (1.0x to 2.5x)
 *
 * Redemption: 7-day cooldown. User gets back LP NFT + accrued rewards - debt.
 *
 * Reference: docs/technical/RSBT_architecture.md
 */
contract RSBT is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Multiplier precision (10000 = 1.0x)
    uint256 public constant MULTIPLIER_PRECISION = 10000;
    /// @notice Minimum multiplier (1.0x)
    uint256 public constant MIN_MULTIPLIER = 10000;
    /// @notice Maximum multiplier (2.5x)
    uint256 public constant MAX_MULTIPLIER = 25000;
    /// @notice Numerator for multiplier boost calculation
    uint256 public constant MULTIPLIER_NUMERATOR = 15000;
    /// @notice Redemption cooldown period
    uint256 public constant COOLDOWN_PERIOD = 7 days;

    // ============ Immutable References ============

    /// @notice LP NFT contract (Uniswap V3 position NFT)
    IERC721 public immutable lpNFT;
    /// @notice AgToken (Artifact Governance — governance/staking)
    IERC20 public immutable agToken;
    /// @notice AuToken (Artifact Utility — utility token)
    IERC20 public immutable auToken;

    // ============ State ============

    /// @notice Total RSBT tokens minted
    uint256 public totalSupply;

    /// @notice AgToken threshold for max multiplier
    uint256 public agThreshold;

    /// @notice RSBT token ID => RSBT position
    mapping(uint256 => RSBTPosition) public positions;

    /// @notice LP NFT token ID => RSBT token ID (to prevent double-staking)
    mapping(uint256 => uint256) public lpToRSBT;

    /// @notice RSBT token ID => redemption request
    mapping(uint256 => RedemptionRequest) public redemptions;

    // ============ Structs ============

    struct RSBTPosition {
        uint256 lpTokenId;       // LP NFT token ID
        address owner;           // Current owner (can change via redemption)
        uint256 lpValueAtStake;  // LP token value at stake time (auToken terms, scaled 1e18)
        uint256 multiplier;      // Reward multiplier (10000-25000)
        uint256 stakedAt;        // Timestamp of stake
        bool exists;             // Whether position exists
    }

    struct RedemptionRequest {
        uint256 rsbtTokenId;     // RSBT token being redeemed
        uint256 cooldownEnd;     // Timestamp when cooldown expires
        bool active;             // Whether redemption is active
    }

    // ============ Events ============

    event Staked(address indexed user, uint256 indexed rsbtTokenId, uint256 lpTokenId, uint256 lpValue, uint256 multiplier);
    event RedemptionInitiated(address indexed user, uint256 indexed rsbtTokenId, uint256 cooldownEnd);
    event Redeemed(address indexed user, uint256 indexed rsbtTokenId, uint256 lpTokenId);
    event AgThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event LPValueUpdated(uint256 indexed rsbtTokenId, uint256 newValue);
    event DebtUpdated(uint256 indexed rsbtTokenId, uint256 newDebt);

    // ============ Errors ============

    error RSBT__NotLPNFTOwner();
    error RSBT__LPNFTAlreadyStaked();
    error RSBT__InvalidToken();
    error RSBT__NotOwner();
    error RSBT__CooldownNotExpired();
    error RSBT__NoActiveRedemption();
    error RSBT__PositionNotExists();
    error RSBT__InvalidAddress();
    error RSBT__ZeroValue();
    error RSBT__InvalidThreshold();

    // ============ Constructor ============

    constructor(
        address _lpNFT,
        address _agToken,
        address _auToken,
        uint256 _agThreshold
    ) Ownable(msg.sender) {
        if (_lpNFT == address(0) || _agToken == address(0) || _auToken == address(0)) {
            revert RSBT__InvalidAddress();
        }
        if (_agThreshold == 0) revert RSBT__InvalidThreshold();

        lpNFT = IERC721(_lpNFT);
        agToken = IERC20(_agToken);
        auToken = IERC20(_auToken);
        agThreshold = _agThreshold;
    }

    // ============ Staking ============

    /**
     * @notice Stake an LP NFT to mint RSBT
     * @param lpTokenId LP NFT token ID to stake
     * @param lpValue LP token value at stake time (auToken terms, scaled 1e18)
     * @return rsbtTokenId The minted RSBT token ID
     */
    function stake(uint256 lpTokenId, uint256 lpValue) external nonReentrant returns (uint256) {
        if (lpValue == 0) revert RSBT__ZeroValue();
        if (lpToRSBT[lpTokenId] != 0) revert RSBT__LPNFTAlreadyStaked();
        if (lpNFT.ownerOf(lpTokenId) != msg.sender) revert RSBT__NotLPNFTOwner();

        // Transfer LP NFT to this contract
        lpNFT.safeTransferFrom(msg.sender, address(this), lpTokenId);

        // Calculate multiplier based on user's AgToken balance
        uint256 agBalance = agToken.balanceOf(msg.sender);
        uint256 multiplier = _calculateMultiplier(agBalance);

        // Mint RSBT
        uint256 rsbtTokenId = ++totalSupply;

        positions[rsbtTokenId] = RSBTPosition({
            lpTokenId: lpTokenId,
            owner: msg.sender,
            lpValueAtStake: lpValue,
            multiplier: multiplier,
            stakedAt: block.timestamp,
            exists: true
        });

        lpToRSBT[lpTokenId] = rsbtTokenId;

        emit Staked(msg.sender, rsbtTokenId, lpTokenId, lpValue, multiplier);

        return rsbtTokenId;
    }

    // ============ Redemption ============

    /**
     * @notice Initiate redemption of RSBT (starts 7-day cooldown)
     * @param rsbtTokenId RSBT token ID to redeem
     */
    function initiateRedemption(uint256 rsbtTokenId) external nonReentrant {
        RSBTPosition storage pos = positions[rsbtTokenId];
        if (!pos.exists) revert RSBT__PositionNotExists();
        if (pos.owner != msg.sender) revert RSBT__NotOwner();
        if (redemptions[rsbtTokenId].active) revert RSBT__CooldownNotExpired();

        redemptions[rsbtTokenId] = RedemptionRequest({
            rsbtTokenId: rsbtTokenId,
            cooldownEnd: block.timestamp + COOLDOWN_PERIOD,
            active: true
        });

        emit RedemptionInitiated(msg.sender, rsbtTokenId, block.timestamp + COOLDOWN_PERIOD);
    }

    /**
     * @notice Complete redemption after cooldown expires
     * @param rsbtTokenId RSBT token ID to redeem
     * @dev Returns LP NFT to user. Debt is settled separately by game server.
     */
    function redeem(uint256 rsbtTokenId) external nonReentrant {
        RSBTPosition storage pos = positions[rsbtTokenId];
        if (!pos.exists) revert RSBT__PositionNotExists();
        if (pos.owner != msg.sender) revert RSBT__NotOwner();

        RedemptionRequest storage req = redemptions[rsbtTokenId];
        if (!req.active) revert RSBT__NoActiveRedemption();
        if (block.timestamp < req.cooldownEnd) revert RSBT__CooldownNotExpired();

        uint256 lpTokenId = pos.lpTokenId;
        address owner = pos.owner;

        // Clear state before transfer (checks-effects-interactions)
        delete positions[rsbtTokenId];
        delete redemptions[rsbtTokenId];
        delete lpToRSBT[lpTokenId];

        // Return LP NFT to user
        lpNFT.safeTransferFrom(address(this), owner, lpTokenId);

        emit Redeemed(owner, rsbtTokenId, lpTokenId);
    }

    // ============ View Functions ============

    /**
     * @notice Calculate multiplier based on AgToken balance
     * @param agBalance User's AgToken balance
     * @return multiplier Value between 10000 and 25000
     */
    function calculateMultiplier(uint256 agBalance) external view returns (uint256) {
        return _calculateMultiplier(agBalance);
    }

    /**
     * @notice Get full RSBT position details
     * @param rsbtTokenId RSBT token ID
     * @return position The RSBT position
     */
    function getPosition(uint256 rsbtTokenId) external view returns (RSBTPosition memory) {
        if (!positions[rsbtTokenId].exists) revert RSBT__PositionNotExists();
        return positions[rsbtTokenId];
    }

    /**
     * @notice Check if a redemption is ready
     * @param rsbtTokenId RSBT token ID
     * @return ready True if cooldown has expired
     */
    function isRedemptionReady(uint256 rsbtTokenId) external view returns (bool) {
        RedemptionRequest storage req = redemptions[rsbtTokenId];
        return req.active && block.timestamp >= req.cooldownEnd;
    }

    /**
     * @notice Get remaining cooldown time
     * @param rsbtTokenId RSBT token ID
     * @return remaining Seconds until cooldown expires (0 if expired or not active)
     */
    function getRemainingCooldown(uint256 rsbtTokenId) external view returns (uint256) {
        RedemptionRequest storage req = redemptions[rsbtTokenId];
        if (!req.active || block.timestamp >= req.cooldownEnd) return 0;
        return req.cooldownEnd - block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the AgToken threshold for max multiplier
     * @param newThreshold New threshold value
     */
    function setAgThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0) revert RSBT__InvalidThreshold();
        uint256 oldThreshold = agThreshold;
        agThreshold = newThreshold;
        emit AgThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Update LP value for a position (e.g., from oracle/game server)
     * @param rsbtTokenId RSBT token ID
     * @param lpValue New LP value
     */
    function updateLPValue(uint256 rsbtTokenId, uint256 lpValue) external onlyOwner {
        if (!positions[rsbtTokenId].exists) revert RSBT__PositionNotExists();
        positions[rsbtTokenId].lpValueAtStake = lpValue;
        emit LPValueUpdated(rsbtTokenId, lpValue);
    }

    /**
     * @notice Update in-game debt for a position (called by game server)
     * @param rsbtTokenId RSBT token ID
     * @param debtVal New debt value
     */
    function updateDebt(uint256 rsbtTokenId, uint256 debtVal) external onlyOwner {
        if (!positions[rsbtTokenId].exists) revert RSBT__PositionNotExists();
        // Debt is stored off-chain by game server; this event serves as a sync signal
        emit DebtUpdated(rsbtTokenId, debtVal);
    }

    /**
     * @notice Emergency withdraw LP NFT (only for unstaked LP tokens)
     * @param lpTokenId LP NFT token ID
     * @param to Recipient address
     */
    function emergencyWithdrawLP(uint256 lpTokenId, address to) external onlyOwner {
        if (to == address(0)) revert RSBT__InvalidAddress();
        // Only allow if no active RSBT position exists for this LP
        uint256 rsbtId = lpToRSBT[lpTokenId];
        if (rsbtId != 0 && positions[rsbtId].exists) revert RSBT__LPNFTAlreadyStaked();
        lpNFT.safeTransferFrom(address(this), to, lpTokenId);
    }

    // ============ IERC721Receiver ============

    /**
     * @notice Required for receiving LP NFTs via safeTransferFrom
     */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        // Only accept tokens from the staking function (msg.sender should be this contract)
        // External callers cannot directly transfer NFTs here
        if (msg.sender != address(this)) {
            revert RSBT__InvalidAddress();
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    // ============ Internal Functions ============

    /**
     * @dev Calculate multiplier: 10000 + (15000 * agBalance) / agThreshold, clamped to [10000, 25000]
     */
    function _calculateMultiplier(uint256 agBalance) internal view returns (uint256) {
        if (agThreshold == 0) return MIN_MULTIPLIER;

        uint256 boost = (MULTIPLIER_NUMERATOR * agBalance) / agThreshold;
        uint256 multiplier = MULTIPLIER_PRECISION + boost;

        // Clamp to max
        if (multiplier > MAX_MULTIPLIER) {
            multiplier = MAX_MULTIPLIER;
        }

        return multiplier;
    }

    /**
     * @dev Burn RSBT token (internal)
     */
    function _burn(uint256 rsbtTokenId) internal {
        RSBTPosition storage pos = positions[rsbtTokenId];
        if (!pos.exists) revert RSBT__PositionNotExists();

        delete positions[rsbtTokenId];
        // Note: totalSupply is NOT decremented (soulbound — burned tokens are gone forever)
    }
}
