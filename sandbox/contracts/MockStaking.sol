// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * MockStaking — LP staking + dual-token yield for sandbox
 * ═══════════════════════════════════════════════════════════════════
 *
 * Production: AVLPStaking_v2.sol (403 lines)
 * Sandbox:    Simplified staking with Au + Ag yield distribution
 *
 * Flywheel: LP tokens → stake → earn Au + Ag yield
 *          → more LP demand → more TVL → PID mints more Ag
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function mint(address to, uint256 amount) external;
}

contract MockStaking {
    // ============ State ============
    IERC20 public lpToken;    // SandboxLPToken (ERC20 wrapper)
    IERC20 public auToken;    // Au — reward token 1
    IERC20 public agToken;    // Ag — reward token 2 (PID minted)

    uint256 public totalStaked;
    uint256 public rewardRateAu;     // Au per block per staked token
    uint256 public rewardRateAg;     // Ag per block per staked token

    // Reward accounting
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public rewardDebtAu;
    mapping(address => uint256) public rewardDebtAg;
    uint256 public accRewardPerTokenAu;
    uint256 public accRewardPerTokenAg;
    uint256 public lastRewardBlock;

    // ============ Events ============
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 auAmount, uint256 agAmount);

    // ============ Errors ============
    error ZeroAmount();
    error InsufficientStake();
    error ZeroAddress();

    // ============ Constructor ============
    constructor(
        address _lpToken,
        address _auToken,
        address _agToken,
        uint256 _rewardRateAu,
        uint256 _rewardRateAg
    ) {
        if (_lpToken == address(0)) revert ZeroAddress();
        if (_auToken == address(0)) revert ZeroAddress();
        if (_agToken == address(0)) revert ZeroAddress();

        lpToken = IERC20(_lpToken);
        auToken = IERC20(_auToken);
        agToken = IERC20(_agToken);
        rewardRateAu = _rewardRateAu;
        rewardRateAg = _rewardRateAg;
        lastRewardBlock = block.number;
    }

    // ============ TVL Interface ============

    /**
     * @notice Get total TVL (staked LP balance)
     * Implements ITvlSource for AvOracle/PID
     */
    function getTvl() external view returns (uint256) {
        return totalStaked;
    }

    // ============ Core Staking ============

    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        _updateRewards();

        // Transfer LP tokens
        lpToken.transferFrom(msg.sender, address(this), amount);

        // Claim any pending rewards before updating stake
        _claimRewards(msg.sender);

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert InsufficientStake();

        _updateRewards();

        // Claim pending rewards
        _claimRewards(msg.sender);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        // Return LP tokens
        lpToken.transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function claimRewards() external {
        _updateRewards();
        _claimRewards(msg.sender);
    }

    // ============ Reward Calculation ============

    function _updateRewards() internal {
        if (block.number <= lastRewardBlock) return;
        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 blocksElapsed = block.number - lastRewardBlock;

        // Au rewards
        uint256 auReward = (blocksElapsed * rewardRateAu * 10**18) / totalStaked;
        accRewardPerTokenAu += auReward;

        // Ag rewards
        uint256 agReward = (blocksElapsed * rewardRateAg * 10**18) / totalStaked;
        accRewardPerTokenAg += agReward;

        lastRewardBlock = block.number;
    }

    function _claimRewards(address user) internal {
        uint256 staked = stakedBalance[user];
        if (staked == 0) {
            rewardDebtAu[user] = accRewardPerTokenAu;
            rewardDebtAg[user] = accRewardPerTokenAg;
            return;
        }

        // Au owed
        uint256 auOwed = (staked * accRewardPerTokenAu) / 10**18 - rewardDebtAu[user];
        if (auOwed > 0) {
            auToken.transfer(user, auOwed);
        }
        rewardDebtAu[user] = (staked * accRewardPerTokenAu) / 10**18;

        // Ag owed
        uint256 agOwed = (staked * accRewardPerTokenAg) / 10**18 - rewardDebtAg[user];
        if (agOwed > 0) {
            // Mint Ag if not enough balance
            uint256 agBal = agToken.balanceOf(address(this));
            if (agOwed > agBal) {
                agToken.mint(address(this), agOwed - agBal);
            }
            agToken.transfer(user, agOwed);
        }
        rewardDebtAg[user] = (staked * accRewardPerTokenAg) / 10**18;

        if (auOwed > 0 || agOwed > 0) {
            emit RewardsClaimed(user, auOwed, agOwed);
        }
    }

    // ============ Views ============

    function pendingRewards(address user) external view returns (uint256 auAmount, uint256 agAmount) {
        uint256 staked = stakedBalance[user];
        if (staked == 0) return (0, 0);

        // Estimate current accumulated rewards
        uint256 currentBlock = block.number;
        uint256 blocksElapsed = currentBlock > lastRewardBlock ? currentBlock - lastRewardBlock : 0;

        uint256 estAccAu = accRewardPerTokenAu;
        uint256 estAccAg = accRewardPerTokenAg;

        if (totalStaked > 0 && blocksElapsed > 0) {
            estAccAu += (blocksElapsed * rewardRateAu * 10**18) / totalStaked;
            estAccAg += (blocksElapsed * rewardRateAg * 10**18) / totalStaked;
        }

        auAmount = (staked * estAccAu) / 10**18 - rewardDebtAu[user];
        agAmount = (staked * estAccAg) / 10**18 - rewardDebtAg[user];
    }

    // ============ Admin ============

    function setRewardRates(uint256 _auRate, uint256 _agRate) external {
        _updateRewards();
        rewardRateAu = _auRate;
        rewardRateAg = _agRate;
    }
}
