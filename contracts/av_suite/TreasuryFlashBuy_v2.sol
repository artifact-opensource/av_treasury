// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TreasuryFlashBuy_v2
 * @notice Flash-buy mechanism for buying back AG tokens when Au price drops below peg
 * @dev Uses OracleGuardian as the price oracle wrapper
 *
 * Flow:
 *   1. Au price drops below peg (detected by OracleGuardian)
 *   2. Treasury approves USDC to DEX
 *   3. FlashBuy swaps USDC → AG on DEX
 *   4. AG is sent to Treasury (or burned)
 *
 * Oracle integration:
 *   When checkFlashBuyTrigger() returns true on the OracleWrapper:
 *     - OracleGuardian confirms Au < peg
 *     - FlashBuy executes the swap
 */
contract TreasuryFlashBuy_v2 is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    //                             ROLES
    // =========================================================================

    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");

    // =========================================================================
    //                             STATE
    // =========================================================================

    /// @notice Treasury contract (receives bought-back AG)
    address public treasury;

    /// @notice Oracle wrapper (OracleGuardian)
    address public oracleWrapper;

    /// @notice USDC token
    IERC20 public usdcToken;

    /// @notice AG token
    IERC20 public agToken;

    /// @notice Au token
    IERC20 public auToken;

    /// @notice DEX router
    address public dex;

    /// @notice Max USDC to spend per buyback
    uint256 public maxUsdcPerBuyback;

    /// @notice Min AG to receive per buyback (slippage protection)
    uint256 public minAgOut;

    /// @notice Whether flash buy is active
    bool public active;

    /// @notice Total USDC spent on buybacks
    uint256 public totalUsdcSpent;

    /// @notice Total AG bought back
    uint256 public totalAgBought;

    // =========================================================================
    //                             EVENTS
    // =========================================================================

    event BuybackExecuted(
        address indexed executor,
        uint256 usdcIn,
        uint256 agOut,
        uint256 timestamp
    );

    event OracleWrapperUpdated(address indexed newWrapper);
    event DexUpdated(address indexed newDex);
    event ParamsUpdated(uint256 maxUsdc, uint256 minAg);
    event TreasuryUpdated(address indexed newTreasury);
    event BuybackToggled(bool active);

    // =========================================================================
    //                             ERRORS
    // =========================================================================

    error NotActive();
    error TriggerNotMet();
    error SlippageExceeded();
    error MaxUsdcExceeded();
    error ZeroAddress();
    error TransferFailed();

    // =========================================================================
    //                           CONSTRUCTOR
    // =========================================================================

    constructor(
        address _treasury,
        address _oracleWrapper,
        address _usdcToken,
        address _agToken,
        address _auToken,
        address _dex,
        uint256 _maxUsdcPerBuyback,
        uint256 _minAgOut,
        address _admin
    ) {
        if (
            _treasury == address(0) ||
            _oracleWrapper == address(0) ||
            _usdcToken == address(0) ||
            _agToken == address(0) ||
            _auToken == address(0) ||
            _dex == address(0) ||
            _admin == address(0)
        ) revert ZeroAddress();

        treasury = _treasury;
        oracleWrapper = _oracleWrapper;
        usdcToken = IERC20(_usdcToken);
        agToken = IERC20(_agToken);
        auToken = IERC20(_auToken);
        dex = _dex;
        maxUsdcPerBuyback = _maxUsdcPerBuyback;
        minAgOut = _minAgOut;
        active = true;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
        _grantRole(PARAM_ROLE, _admin);
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    function setOracleWrapper(address _oracleWrapper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_oracleWrapper == address(0)) revert ZeroAddress();
        emit OracleWrapperUpdated(_oracleWrapper);
        oracleWrapper = _oracleWrapper;
    }

    function setDex(address _dex) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_dex == address(0)) revert ZeroAddress();
        emit DexUpdated(_dex);
        dex = _dex;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(_treasury);
        treasury = _treasury;
    }

    function setParams(
        uint256 _maxUsdcPerBuyback,
        uint256 _minAgOut
    ) external onlyRole(PARAM_ROLE) {
        emit ParamsUpdated(_maxUsdcPerBuyback, _minAgOut);
        maxUsdcPerBuyback = _maxUsdcPerBuyback;
        minAgOut = _minAgOut;
    }

    function setActive(bool _active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (paused()) revert("FlashBuy: paused");
        emit BuybackToggled(_active);
        active = _active;
    }

    /// @notice Emergency pause — stops all buyback execution
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause — resumes buyback execution
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                         CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Check if buyback should be triggered
     * @dev Calls OracleGuardian.checkFlashBuyTrigger() via staticcall
     * @return shouldTrigger Whether buyback should execute
     */
    function shouldBuyback() public view returns (bool shouldTrigger) {
        if (!active) return false;

        (bool success, bytes memory data) = oracleWrapper.staticcall(
            abi.encodeWithSignature("checkFlashBuyTrigger()")
        );

        if (!success || data.length < 96) return false;

        // Decode (bool trigger, uint256 oraclePrice, uint256 twapPrice)
        (shouldTrigger, , ) = abi.decode(data, (bool, uint256, uint256));
    }

    /**
     * @notice Get Au price from oracle wrapper for FlashBuy
     * @return price Au price in USD (18 decimals)
     * @return source Price source identifier
     */
    function getAuPriceFromOracle() public view returns (uint256 price, uint8 source) {
        (bool success, bytes memory data) = oracleWrapper.staticcall(
            abi.encodeWithSignature("getAuPriceForFlashBuy()")
        );

        if (!success || data.length < 64) return (0, 0);

        (price, source) = abi.decode(data, (uint256, uint8));
    }

    /**
     * @notice Execute buyback: swap USDC for AG via DEX
     * @param usdcAmount Amount of USDC to spend
     * @param minAgMinimum Minimum AG to accept (slippage)
     * @param dexData Encoded DEX swap data (path, router call, etc.)
     */
    /// @dev SPECTRE FIX C3: Track USDC balance before swap to measure actual output.
    /// Prevents reentrancy attacks where attacker manipulates balanceOf readings.
    function executeBuyback(
        uint256 usdcAmount,
        uint256 minAgMinimum,
        bytes calldata dexData
    ) external nonReentrant whenNotPaused onlyRole(EXECUTOR_ROLE) {
        if (!active) revert NotActive();
        if (usdcAmount > maxUsdcPerBuyback) revert MaxUsdcExceeded();

        // Verify trigger is still met
        if (!shouldBuyback()) revert TriggerNotMet();

        // SPECTRE FIX C3: Snapshot balances before any external calls
        uint256 usdcBefore = usdcToken.balanceOf(address(this));
        uint256 agBefore = agToken.balanceOf(address(this));

        // Transfer USDC from Treasury to this contract
        usdcToken.safeTransferFrom(treasury, address(this), usdcAmount);

        // Verify USDC actually arrived (prevents transferFrom callback manipulation)
        uint256 usdcAfter = usdcToken.balanceOf(address(this));
        if (usdcAfter - usdcBefore != usdcAmount) revert TransferFailed();

        // Approve DEX to spend USDC
        usdcToken.approve(dex, 0);
        usdcToken.approve(dex, usdcAmount);

        // Execute DEX swap via low-level call
        (bool success, bytes memory returnData) = dex.call(dexData);
        if (!success) {
            revert TransferFailed();
        }

        // SPECTRE FIX C3: Use balance delta, not absolute balance
        uint256 agAfter = agToken.balanceOf(address(this));
        uint256 agReceived = agAfter - agBefore;
        if (agReceived < minAgMinimum) revert SlippageExceeded();

        // CEI: Update state BEFORE external transfer
        totalUsdcSpent += usdcAmount;
        totalAgBought += agReceived;

        // Transfer AG to Treasury (external call after state update)
        agToken.safeTransfer(treasury, agReceived);

        emit BuybackExecuted(msg.sender, usdcAmount, agReceived, block.timestamp);
    }

    /**
     * @notice Rescue stuck tokens (governance only)
     */
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }
}
