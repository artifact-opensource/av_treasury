// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OracleFlashBuy
 * @notice FlashBuy with OracleWrapper integration — triggers buybacks when
 *         oracle reports Au trading below peg.
 * @dev Adds to TreasuryFlashBuy v1 logic:
 *      1. OracleWrapper price trigger
 *      2. Configurable trigger threshold (basis points below reference)
 *      3. Max buyback amount per trigger (governance-controlled)
 *      4. Cooldown between buyback executions
 *
 * TRIGGER LOGIC:
 *   When checkFlashBuyTrigger() returns true on the OracleWrapper:
 *   - Anyone can call executeBuyback()
 *   - Contract buys Au from the open market using Treasury surplus
 *   - Bought Au is held in this contract (governance can burn)
 *
 * SECURITY:
 *   - Only executes when oracle confirms below-peg price
 *   - Max buyback amount per execution (governance-set)
 *   - Cooldown period between executions
 *   - Governance can disable oracle trigger
 *   - Emergency pause
 */
contract OracleFlashBuy {
    using SafeERC20 for IERC20;

    // ============ IMMUTABLES ============
    address public immutable treasury;
    address public immutable auToken;
    address public immutable usdcToken;
    address public immutable dex;

    // ============ ORACLE INTEGRATION ============
    address public oracleWrapper;
    bool public oracleTriggerEnabled;
    uint256 public triggerBps;
    uint256 public constant DEFAULT_TRIGGER_BPS = 9800;

    // ============ GOVERNANCE ============
    address public governance;
    address public pendingGovernance;
    modifier onlyGovernance() {
        require(msg.sender == governance, "OFB: only governance");
        _;
    }

    // ============ BUYBACK LIMITS ============
    uint256 public maxBuybackPerExecution;
    uint256 public cooldown;
    uint256 public lastBuybackTimestamp;
    uint256 public totalBuybackVolume;
    uint256 public totalAuBoughtBack;

    // ============ EMERGENCY ============
    bool public paused;

    // ============ EVENTS ============
    event OracleWrapperUpdated(address indexed newOracleWrapper);
    event OracleTriggerToggled(bool enabled);
    event TriggerBpsUpdated(uint256 newTriggerBps);
    event BuybackExecuted(
        uint256 usdcSpent,
        uint256 auReceived,
        uint256 oraclePrice,
        address indexed executor
    );
    event MaxBuybackUpdated(uint256 newMaxBuyback);
    event CooldownUpdated(uint256 newCooldown);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event GovernanceProposed(address indexed newGovernance);
    event GovernanceAccepted(address indexed newGovernance);
    event Paused();
    event Unpaused();

    // ============ ERRORS ============
    error OFB_OnlyGovernance();
    error OFB_Paused();
    error OFB_CooldownActive();
    error OFB_NoBuybackNeeded();
    error OFB_ZeroAddress();
    error OFB_InvalidBps();

    // ============ CONSTRUCTOR ============
    constructor(
        address _treasury,
        address _auToken,
        address _usdcToken,
        address _dex,
        address _oracleWrapper,
        uint256 _maxBuybackPerExecution,
        uint256 _cooldown
    ) {
        if (_treasury == address(0)) revert OFB_ZeroAddress();
        if (_auToken == address(0)) revert OFB_ZeroAddress();
        if (_usdcToken == address(0)) revert OFB_ZeroAddress();
        if (_dex == address(0)) revert OFB_ZeroAddress();
        if (_oracleWrapper == address(0)) revert OFB_ZeroAddress();

        treasury = _treasury;
        auToken = _auToken;
        usdcToken = _usdcToken;
        dex = _dex;
        oracleWrapper = _oracleWrapper;
        governance = msg.sender;
        oracleTriggerEnabled = true;
        triggerBps = DEFAULT_TRIGGER_BPS;
        maxBuybackPerExecution = _maxBuybackPerExecution;
        cooldown = _cooldown;
    }

    // ============ GOVERNANCE ============

    function proposeGovernance(address _newGovernance) external onlyGovernance {
        if (_newGovernance == address(0)) revert OFB_ZeroAddress();
        pendingGovernance = _newGovernance;
        emit GovernanceProposed(_newGovernance);
    }

    function acceptGovernance() external {
        require(msg.sender == pendingGovernance, "OFB: only pending governance");
        governance = pendingGovernance;
        pendingGovernance = address(0);
        emit GovernanceAccepted(governance);
    }

    function setOracleWrapper(address _oracleWrapper) external onlyGovernance {
        if (_oracleWrapper == address(0)) revert OFB_ZeroAddress();
        oracleWrapper = _oracleWrapper;
        emit OracleWrapperUpdated(_oracleWrapper);
    }

    function setOracleTriggerEnabled(bool _enabled) external onlyGovernance {
        oracleTriggerEnabled = _enabled;
        emit OracleTriggerToggled(_enabled);
    }

    function setTriggerBps(uint256 _triggerBps) external onlyGovernance {
        if (_triggerBps < 9000 || _triggerBps > 10000) revert OFB_InvalidBps();
        triggerBps = _triggerBps;
        emit TriggerBpsUpdated(_triggerBps);
    }

    function setMaxBuyback(uint256 _maxBuyback) external onlyGovernance {
        maxBuybackPerExecution = _maxBuyback;
        emit MaxBuybackUpdated(_maxBuyback);
    }

    function setCooldown(uint256 _cooldown) external onlyGovernance {
        cooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    function pause() external onlyGovernance {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyGovernance {
        paused = false;
        emit Unpaused();
    }

    // ============ CORE LOGIC ============

    /**
     * @notice Check if buyback should trigger based on oracle price
     * @return shouldTrigger True if Au is below trigger threshold
     */
    function shouldBuyback() public view returns (bool) {
        if (!oracleTriggerEnabled) return false;

        (bool success, bytes memory data) = oracleWrapper.staticcall(
            abi.encodeWithSignature("checkFlashBuyTrigger()")
        );

        if (!success) return false;

        (bool trigger, , ) = abi.decode(data, (bool, uint256, uint256));
        return trigger;
    }

    /**
     * @notice Execute buyback — anyone can call when oracle trigger is active
     * @param _usdcAmount Amount of USDC to spend
     */
    function executeBuyback(uint256 _usdcAmount) external {
        if (paused) revert OFB_Paused();
        if (block.timestamp < lastBuybackTimestamp + cooldown) revert OFB_CooldownActive();
        if (!shouldBuyback()) revert OFB_NoBuybackNeeded();

        uint256 amount = _usdcAmount;
        if (amount > maxBuybackPerExecution) {
            amount = maxBuybackPerExecution;
        }

        // Transfer USDC from Treasury
        IERC20(usdcToken).safeTransferFrom(treasury, address(this), amount);

        // Approve DEX (OZ v5: use increaseAllowance)
        IERC20(usdcToken).safeIncreaseAllowance(dex, amount);

        // Swap USDC → Au
        (bool success, bytes memory data) = dex.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address)",
                amount,
                0,
                _getPath(),
                address(this)
            )
        );

        if (!success) revert("OFB: swap failed");

        uint256 auReceived = abi.decode(data, (uint256[]))[1];

        // Update state
        lastBuybackTimestamp = block.timestamp;
        totalBuybackVolume += amount;
        totalAuBoughtBack += auReceived;

        // Get oracle price for event
        (bool priceSuccess, bytes memory priceData) = oracleWrapper.staticcall(
            abi.encodeWithSignature("getAuPriceForFlashBuy()")
        );
        uint256 oraclePrice = 0;
        if (priceSuccess) {
            (oraclePrice, ) = abi.decode(priceData, (uint256, uint8));
        }

        emit BuybackExecuted(amount, auReceived, oraclePrice, msg.sender);
    }

    /**
     * @notice Emergency buyback without oracle check — governance only
     * @param _usdcAmount Amount of USDC to spend
     */
    function emergencyBuyback(uint256 _usdcAmount) external onlyGovernance {
        uint256 amount = _usdcAmount;
        if (amount > maxBuybackPerExecution) {
            amount = maxBuybackPerExecution;
        }

        IERC20(usdcToken).safeTransferFrom(treasury, address(this), amount);
        IERC20(usdcToken).safeIncreaseAllowance(dex, amount);

        (bool success, bytes memory data) = dex.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address)",
                amount,
                0,
                _getPath(),
                address(this)
            )
        );

        if (!success) revert("OFB: swap failed");

        uint256 auReceived = abi.decode(data, (uint256[]))[1];
        totalBuybackVolume += amount;
        totalAuBoughtBack += auReceived;

        emit BuybackExecuted(amount, auReceived, 0, msg.sender);
    }

    /**
     * @notice Get swap path USDC → Au
     */
    function _getPath() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = usdcToken;
        path[1] = auToken;
    }

    // ============ VIEW FUNCTIONS ============

    function getTreasuryBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(treasury);
    }

    function getThisBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
    }

    function getAuBalance() external view returns (uint256) {
        return IERC20(auToken).balanceOf(address(this));
    }

    function timeUntilNextBuyback() external view returns (uint256) {
        if (lastBuybackTimestamp + cooldown <= block.timestamp) return 0;
        return (lastBuybackTimestamp + cooldown) - block.timestamp;
    }

    // ============ EMERGENCY ============

    function emergencyWithdraw(address _token) external onlyGovernance {
        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(governance, bal);
        emit EmergencyWithdraw(_token, bal);
    }
}
