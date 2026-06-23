// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AVLPStaking_v2 — v3
 * @notice Stake LP NFTs, earn Au + Ag rewards. UUPS upgradeable.
 * @dev Ag-based multiplier: 1x to 2.5x based on staker's Ag holdings.
 * @dev Deployed v2 on Base: 0x3e26b061eC20392b32dE712132c41bbE43f52556
 *
 * @author Artifact Virtual DAO
 *
 * @dev CRITICAL v3 FIX:
 * - Ag multiplier now reads staker's Ag balance dynamically (was missing in v2)
 * - Formula: multiplier = 10000 + (15000 * agBalance) / agThreshold
 * - At threshold (5000 Ag): multiplier = 25000 (2.5x)
 *
 * @custom:compiler-version 0.8.26
 * @custom:optimizer-runs 200
 * @custom:evm-version cancun
 */
contract AVLPStaking_v2 is
    AccessControlUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public auToken;
    IERC20 public agToken;
    IERC721 public lpNFT;

    uint256 public auRewardPerBlock;
    uint256 public agRewardPerBlock;

    // Rate caps
    uint256 public constant MAX_AU_RATE = 1000 * 1e18;
    uint256 public constant MAX_AG_RATE = 100 * 1e18;
    uint256 public constant RATE_DELAY = 48 hours;

    // Rate change timelock
    uint256 public rateChangeScheduledAt;
    uint256 public pendingAuRate;
    uint256 public pendingAgRate;

    // Upgrade
    uint256 public constant UPGRADE_DELAY = 7 days;
    uint256 public upgradeScheduledAt;
    address public pendingImplementation;

    // Staking state
    uint256 public totalWeights;
    uint256 public accAuPerWeight;
    uint256 public accAgPerWeight;
    uint256 public lastRewardBlock;

    mapping(uint256 => uint256) public _stakedWeights;
    mapping(uint256 => address) public _stakeOwner;
    mapping(address => uint256[]) public _ownerStakes;
    mapping(uint256 => uint256) public _pendingAu;
    mapping(uint256 => uint256) public _pendingAg;
    mapping(uint256 => uint256) public _debtAu;
    mapping(uint256 => uint256) public _debtAg;
    mapping(uint256 => uint256) public _stakedAt;

    // Dust accumulator
    uint256 public dustAu;
    uint256 public dustAg;

    // Ag multiplier config
    uint256 public agThreshold; // Ag balance for max multiplier (5000 Ag)
    uint256 public constant MULTIPLIER_DENOMINATOR = 10_000;
    uint256 public constant MAX_MULTIPLIER = 25_000; // 2.5x (v3.1: Au price stability)

    // Minimum stake duration (1 day)
    uint256 public minStakeDuration = 1 days;

    // ============ STRUCTS ============
    struct Stake {
        address owner;
        uint256 tokenId;
        uint256 weight;
        uint256 depositedAt;
    }

    // ============ ERRORS ============
    error Staking_ZeroAddress();
    error Staking_ZeroWeight();
    error Staking_AlreadyStaked();
    error Staking_NotOwner();
    error Staking_AuRateExceedsCap(uint256 provided, uint256 maxAllowed);
    error Staking_AgRateExceedsCap(uint256 provided, uint256 maxAllowed);
    error Staking_TimelockActive(uint256 remaining);
    error Staking_NoUpgradeAnnounced();
    error Staking_InvalidImplementation();
    error Staking_NoStake();
    error Staking_MinStakeDurationNotMet(uint256 remaining);

    // ============ EVENTS ============
    event StakedNFT(address indexed user, uint256 tokenId, uint256 weight);
    event UnstakedNFT(address indexed user, uint256 tokenId);
    event RewardsClaimed(address indexed user, uint256 auAmount, uint256 agAmount);
    event RewardRatesUpdated(uint256 auRate, uint256 agRate);
    event RateChangeScheduled(uint256 auRate, uint256 agRate, uint256 executableAt);
    event NFTRecovered(uint256 tokenId, address to);
    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
    event UpgradeExecuted(address indexed newImplementation);
    event UpgradeCancelled(address indexed cancelledImplementation);

    // ============ INITIALIZER ============
    function initialize(
        address _auToken,
        address _agToken,
        address _lpNFT
    ) public initializer {
        if (_auToken == address(0) || _agToken == address(0) || _lpNFT == address(0)) {
            revert Staking_ZeroAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        auToken = IERC20(_auToken);
        agToken = IERC20(_agToken);
        lpNFT = IERC721(_lpNFT);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        lastRewardBlock = block.number;
        agThreshold = 5_000 * 1e18; // 5000 Ag for max multiplier
    }

    // ============ UPGRADE TIMELOCK ============
    function announceUpgrade(address newImplementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newImplementation == address(0)) revert Staking_ZeroAddress();
        require(newImplementation.code.length > 0, "Staking: not a contract");
        pendingImplementation = newImplementation;
        upgradeScheduledAt = block.timestamp;
        emit UpgradeAnnounced(newImplementation, block.timestamp + UPGRADE_DELAY);
    }

    function cancelUpgrade() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit UpgradeCancelled(pendingImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pendingImplementation == address(0)) revert Staking_NoUpgradeAnnounced();
        if (newImplementation != pendingImplementation) revert Staking_InvalidImplementation();
        require(block.timestamp >= upgradeScheduledAt + UPGRADE_DELAY, "Staking: timelock active");
        emit UpgradeExecuted(newImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    // ============ RATE MANAGEMENT (48h timelock) ============
    function scheduleRateChange(uint256 _auRate, uint256 _agRate) external onlyRole(ADMIN_ROLE) {
        if (_auRate > MAX_AU_RATE) revert Staking_AuRateExceedsCap(_auRate, MAX_AU_RATE);
        if (_agRate > MAX_AG_RATE) revert Staking_AgRateExceedsCap(_agRate, MAX_AG_RATE);
        pendingAuRate = _auRate;
        pendingAgRate = _agRate;
        rateChangeScheduledAt = block.timestamp;
        emit RateChangeScheduled(_auRate, _agRate, block.timestamp + RATE_DELAY);
    }

    function executeRateChange() external onlyRole(ADMIN_ROLE) {
        if (block.timestamp < rateChangeScheduledAt + RATE_DELAY) {
            revert Staking_TimelockActive(rateChangeScheduledAt + RATE_DELAY - block.timestamp);
        }
        _distributeRewards();
        auRewardPerBlock = pendingAuRate;
        agRewardPerBlock = pendingAgRate;
        emit RewardRatesUpdated(auRewardPerBlock, agRewardPerBlock);
    }

    function setRewardRates(uint256 _auRate, uint256 _agRate) external onlyRole(ADMIN_ROLE) {
        if (_auRate > MAX_AU_RATE) revert Staking_AuRateExceedsCap(_auRate, MAX_AU_RATE);
        if (_agRate > MAX_AG_RATE) revert Staking_AgRateExceedsCap(_agRate, MAX_AG_RATE);
        _distributeRewards();
        pendingAuRate = _auRate;
        pendingAgRate = _agRate;
        rateChangeScheduledAt = block.timestamp;
        emit RateChangeScheduled(_auRate, _agRate, block.timestamp + RATE_DELAY);
    }

    // ============ AG MULTIPLIER (v3 CRITICAL FIX) ============
    /**
     * @notice Calculate Ag-based multiplier for a staker
     * @param staker Address to calculate multiplier for
     * @return multiplier in basis points (10000 = 1x, 25000 = 2.5x)
     */
    function getAgMultiplier(address staker) public view returns (uint256) {
        uint256 agBalance = agToken.balanceOf(staker);
        if (agBalance >= agThreshold) {
            return MAX_MULTIPLIER;
        }
        // multiplier = 10000 + (15000 * agBalance) / agThreshold
        return MULTIPLIER_DENOMINATOR + (5_000 * agBalance) / agThreshold;
    }

    // ============ STAKING ============
    function stake(uint256 tokenId, uint256 weight) external nonReentrant whenNotPaused {
        if (weight == 0) revert Staking_ZeroWeight();
        if (_stakeOwner[tokenId] != address(0)) revert Staking_AlreadyStaked();

        _distributeRewards();

        _stakedWeights[tokenId] = weight;
        _stakeOwner[tokenId] = msg.sender;
        _ownerStakes[msg.sender].push(tokenId);
        totalWeights += weight;

        _pendingAu[tokenId] = 0;
        _pendingAg[tokenId] = 0;
        _debtAu[tokenId] = weight * accAuPerWeight;
        _debtAg[tokenId] = weight * accAgPerWeight;
        _stakedAt[tokenId] = block.timestamp;

        lpNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        emit StakedNFT(msg.sender, tokenId, weight);
    }

    function unstake(uint256 tokenId) external nonReentrant whenNotPaused {
        address owner = _stakeOwner[tokenId];
        if (owner != msg.sender) revert Staking_NotOwner();

        // M-3 fix: Enforce minimum stake duration
        if (block.timestamp < _stakedAt[tokenId] + minStakeDuration) {
            revert Staking_MinStakeDurationNotMet(_stakedAt[tokenId] + minStakeDuration - block.timestamp);
        }

        _distributeRewards();

        uint256 pendingAu = _pendingAu[tokenId] + (_stakedWeights[tokenId] * accAuPerWeight) - _debtAu[tokenId];
        uint256 pendingAg = _pendingAg[tokenId] + (_stakedWeights[tokenId] * accAgPerWeight) - _debtAg[tokenId];

        totalWeights -= _stakedWeights[tokenId];
        delete _stakedWeights[tokenId];
        delete _stakeOwner[tokenId];
        delete _pendingAu[tokenId];
        delete _pendingAg[tokenId];
        delete _debtAu[tokenId];
        delete _debtAg[tokenId];
        delete _stakedAt[tokenId];

        // Remove from owner's list
        uint256[] storage stakes = _ownerStakes[msg.sender];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i] == tokenId) {
                stakes[i] = stakes[stakes.length - 1];
                stakes.pop();
                break;
            }
        }

        lpNFT.safeTransferFrom(address(this), msg.sender, tokenId);

        if (pendingAu > 0) auToken.safeTransfer(msg.sender, pendingAu);
        if (pendingAg > 0) agToken.safeTransfer(msg.sender, pendingAg);

        emit UnstakedNFT(msg.sender, tokenId);
        emit RewardsClaimed(msg.sender, pendingAu, pendingAg);
    }

    function claimRewards(uint256 tokenId) external nonReentrant whenNotPaused {
        address owner = _stakeOwner[tokenId];
        if (owner != msg.sender) revert Staking_NotOwner();

        _distributeRewards();

        uint256 pendingAu = _pendingAu[tokenId] + (_stakedWeights[tokenId] * accAuPerWeight) - _debtAu[tokenId];
        uint256 pendingAg = _pendingAg[tokenId] + (_stakedWeights[tokenId] * accAgPerWeight) - _debtAg[tokenId];

        _debtAu[tokenId] = _stakedWeights[tokenId] * accAuPerWeight;
        _debtAg[tokenId] = _stakedWeights[tokenId] * accAgPerWeight;
        _pendingAu[tokenId] = 0;
        _pendingAg[tokenId] = 0;

        if (pendingAu > 0) auToken.safeTransfer(msg.sender, pendingAu);
        if (pendingAg > 0) agToken.safeTransfer(msg.sender, pendingAg);

        emit RewardsClaimed(msg.sender, pendingAu, pendingAg);
    }

    // ============ REWARD DISTRIBUTION ============
    function _distributeRewards() internal {
        if (totalWeights == 0) return;

        uint256 blocksElapsed = block.number - lastRewardBlock;
        if (blocksElapsed == 0) return;

        uint256 auEarned = auRewardPerBlock * blocksElapsed;
        uint256 agEarned = agRewardPerBlock * blocksElapsed;

        if (auEarned > 0) {
            uint256 delta = (auEarned * 1e18) / totalWeights;
            if (delta > 0) {
                accAuPerWeight += delta;
            } else {
                dustAu += auEarned;
            }
        }
        if (agEarned > 0) {
            uint256 delta = (agEarned * 1e18) / totalWeights;
            if (delta > 0) {
                accAgPerWeight += delta;
            } else {
                dustAg += agEarned;
            }
        }
        lastRewardBlock = block.number;
    }

    function distributeDust() external {
        require(dustAu > 0 || dustAg > 0, "Staking: no dust");
        if (dustAu > 0 && totalWeights > 0) {
            uint256 delta = (dustAu * 1e18) / totalWeights;
            if (delta > 0) accAuPerWeight += delta;
            dustAu = 0;
        }
        if (dustAg > 0 && totalWeights > 0) {
            uint256 delta = (dustAg * 1e18) / totalWeights;
            if (delta > 0) accAgPerWeight += delta;
            dustAg = 0;
        }
    }

    // ============ NFT RECOVERY ============
    function recoverNFT(uint256 tokenId, address to) external onlyRole(ADMIN_ROLE) {
        if (_stakeOwner[tokenId] == address(0)) revert Staking_NoStake();
        if (to == address(0)) revert Staking_ZeroAddress();

        address owner = _stakeOwner[tokenId];
        uint256 weight = _stakedWeights[tokenId];

        totalWeights -= weight;
        delete _stakedWeights[tokenId];
        delete _stakeOwner[tokenId];
        delete _pendingAu[tokenId];
        delete _pendingAg[tokenId];
        delete _debtAu[tokenId];
        delete _debtAg[tokenId];
        delete _stakedAt[tokenId];

        // Remove from owner's list
        uint256[] storage stakes = _ownerStakes[owner];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i] == tokenId) {
                stakes[i] = stakes[stakes.length - 1];
                stakes.pop();
                break;
            }
        }

        lpNFT.safeTransferFrom(address(this), to, tokenId);
        emit NFTRecovered(tokenId, to);
    }

    // ============ VIEW ============
    function pendingRewards(uint256 tokenId) external view returns (uint256 auAmount, uint256 agAmount) {
        uint256 weight = _stakedWeights[tokenId];
        if (weight == 0) return (0, 0);
        auAmount = _pendingAu[tokenId] + (weight * accAuPerWeight) - _debtAu[tokenId];
        agAmount = _pendingAg[tokenId] + (weight * accAgPerWeight) - _debtAg[tokenId];
    }

    function getStakes(address user) external view returns (uint256[] memory) {
        return _ownerStakes[user];
    }

    // ============ PAUSE ============
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ IERC721Receiver ============
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
