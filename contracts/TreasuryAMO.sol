// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IAerodromeRouter
 * @notice Interface for Aerodrome DEX router (Base chain primary DEX)
 */
interface IAerodromeRouter {
    function getAmountsOut(uint256 amountIn, address[] memory path)
        external
        view
        returns (uint256[] memory);
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory);
}

/**
 * @title IUniswapV2Router
 * @notice Interface for Uniswap V2 router (backup DEX)
 */
interface IUniswapV2Router {
    function getAmountsOut(uint256 amountIn, address[] memory path)
        external
        view
        returns (uint256[] memory);
    function swapExactTokensForTokensSupportingTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/**
 * @title TreasuryAMO
 * @notice Automated Market Operations contract for AV Treasury v3 DAO
 * @dev Handles autonomous buybacks of Au tokens using reserve tokens
 *      with TWAP validation, slippage protection, and runway safeguards.
 *      Non-upgradeable. Uses AccessControl for role-based permissions,
 *      ReentrancyGuard for reentrancy protection, and Pausable for emergency stops.
 */
contract TreasuryAMO is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================================
    //                         CONSTANTS
    // ============================================================

    /// @notice Basis points denominator (100% = 10000 bps)
    uint256 internal constant BPS_DENOMINATOR = 10000;

    /// @notice Maximum deadline extension from current block timestamp
    uint256 internal constant MAX_DEADLINE_EXTENSION = 1 hours;

    /// @notice AMO reserve runway in months (minimum months of reserves to maintain)
    uint256 public constant AMO_RESERVE_RUNWAY_MONTHS = 12;

    /// @notice AMO buyback percentage of excess reserves (out of 100)
    uint256 public constant AMO_BUYBACK_PCT = 10;

    /// @notice Minimum buyback amount in USD equivalent (scaled to reserve token decimals)
    uint256 public constant MIN_BUYBACK_USD = 500;

    // ============================================================
    //                          ROLES
    // ============================================================

    /// @notice Role allowed to execute buybacks
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    /// @notice Role allowed to update protocol parameters
    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");

    // ============================================================
    //                       CUSTOM ERRORS
    // ============================================================

    /// @notice Caller is not the executor
    error NotExecutor(address caller);

    /// @notice Operation is still within cooldown period
    error CooldownActive(uint256 currentTime, uint256 availableAt);

    /// @notice Spend amount would violate minimum runway reserve
    error RunwayViolation(uint256 balance, uint256 spendAmount, uint256 minRunway);

    /// @notice Deadline is in the past
    error DeadlineInPast(uint256 deadline, uint256 currentTime);

    /// @notice Deadline is too far in the future
    error DeadlineTooFar(uint256 deadline, uint256 maxDeadline);

    /// @notice Reserve amount is zero
    error ZeroReserveAmount();

    /// @notice Buyback exceeds per-epoch cap
    error ExceedsEpochCap(uint256 amount, uint256 maxAllowed);

    /// @notice Buyback amount is below the minimum floor
    error BelowBuybackFloor(uint256 amount, uint256 minRequired);

    /// @notice TWAP price deviation exceeds maximum
    error TWAPDeviationExceeded(uint256 expectedPrice, uint256 actualPrice, uint256 maxDeviationBps);

    /// @notice TWAP price is stale (outside TWAP window)
    error TWAPStale(uint256 lastUpdate, uint256 currentTime, uint256 twapWindow);

    /// @notice Slippage exceeded minimum output
    error SlippageExceeded(uint256 received, uint256 minimum);

    /// @notice Invalid address (zero address)
    error ZeroAddress();

    /// @notice Invalid parameter value
    error InvalidParameter(string param, uint256 value);

    /// @notice Emergency withdraw failed
    error WithdrawFailed();

    /// @notice Insufficient contract balance for withdraw
    error InsufficientBalance(uint256 requested, uint256 available);

    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Emitted when a buyback is successfully executed
    /// @param executor Address that executed the buyback
    /// @param reserveAmount Amount of reserve tokens spent
    /// @param auAmount Amount of Au tokens received
    /// @param useAerodrome Whether Aerodrome (true) or Uniswap V2 (false) was used
    /// @param timestamp Block timestamp of execution
    event BuybackExecuted(
        address indexed executor,
        uint256 reserveAmount,
        uint256 auAmount,
        bool useAerodrome,
        uint256 timestamp
    );

    /// @notice Emitted when TWAP price is updated
    /// @param price The new TWAP price (reserve per Au token, scaled by 1e18)
    /// @param timestamp Block timestamp of update
    event TWAPUpdated(uint256 price, uint256 timestamp);

    /// @notice Emitted when cooldown period is updated
    /// @param oldCooldown Previous cooldown duration
    /// @param newCooldown New cooldown duration
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    /// @notice Emitted when max slippage is updated
    /// @param oldSlippage Previous max slippage in bps
    /// @param newSlippage New max slippage in bps
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    /// @notice Emitted when minimum runway reserve is updated
    /// @param oldRunway Previous minimum runway reserve
    /// @param newRunway New minimum runway reserve
    event RunwayUpdated(uint256 oldRunway, uint256 newRunway);

    /// @notice Emitted when a DEX router is updated
    /// @param routerType "aerodrome" or "uniswap"
    /// @param oldRouter Previous router address
    event RouterUpdated(string routerType, address oldRouter, address newRouter);

    // ============================================================
    //                        STATE VARIABLES
    // ============================================================

    /// @notice Au token (the token being bought back)
    IERC20 public immutable auToken;

    /// @notice Reserve token (e.g., USDC, cbBTC used for buybacks)
    IERC20 public immutable reserveToken;

    /// @notice Aerodrome DEX router (primary)
    IAerodromeRouter public aerodromeRouter;

    /// @notice Uniswap V2 router (backup)
    IUniswapV2Router public uniswapRouter;

    /// @notice Minimum time between operations
    uint256 public cooldown;

    /// @notice Maximum slippage in basis points (50 = 0.5%)
    uint256 public maxSlippageBps;

    /// @notice Maximum TWAP price deviation in basis points (500 = 5%)
    uint256 public maxPriceDeviationBps;

    /// @notice Maximum TWAP update deviation per single update (500 = 5%)
    uint256 public maxUpdateDeviationBps;

    /// @notice Minimum time between TWAP updates (1 hour)
    uint256 public minTwapUpdateInterval;

    /// @notice Maximum buyback per epoch as % of total reserve in bps (500 = 5%)
    uint256 public maxBuybackPerEpochBps;

    /// @notice TWAP window for price staleness check
    uint256 public twapWindow;

    /// @notice Minimum runway reserve that must be maintained
    uint256 public minRunwayReserve;

    /// @notice Timestamp of last operation
    uint256 public lastOperationTime;

    /// @notice Total number of buybacks executed
    uint256 public totalBuybacksExecuted;

    /// @notice Total Au tokens bought across all operations
    uint256 public totalAuBought;

    /// @notice Total reserve tokens spent across all operations
    uint256 public totalReserveSpent;

    /// @notice Last recorded TWAP price (reserve per Au, 1e18 scaled)
    uint256 public twapPrice;

    /// @notice Timestamp of last TWAP update
    uint256 public twapLastUpdate;

    // ============================================================
    //                         MODIFIERS
    // ============================================================

    /// @notice Restricts caller to EXECUTOR_ROLE holders
    modifier onlyExecutor() {
        if (!hasRole(EXECUTOR_ROLE, msg.sender)) {
            revert NotExecutor(msg.sender);
        }
        _;
    }

    /// @notice Enforces cooldown between operations
    modifier respectsCooldown() {
        uint256 availableAt = lastOperationTime + cooldown;
        if (block.timestamp < availableAt) {
            revert CooldownActive(block.timestamp, availableAt);
        }
        _;
    }

    /// @notice Ensures runway reserve is maintained after spend
    modifier respectsRunway(uint256 spendAmount) {
        uint256 balance = reserveToken.balanceOf(address(this));
        if (balance < spendAmount + minRunwayReserve) {
            revert RunwayViolation(balance, spendAmount, minRunwayReserve);
        }
        _;
    }

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /**
     * @notice Initializes the TreasuryAMO contract
     * @param _auToken Address of the Au token to buy back
     * @param _reserveToken Address of the reserve token (USDC, cbBTC, etc.)
     * @param _aerodromeRouter Address of the Aerodrome DEX router
     * @param _admin Address to receive all roles
     */
    constructor(
        address _auToken,
        address _reserveToken,
        address _aerodromeRouter,
        address _admin
    ) {
        if (_auToken == address(0)) revert ZeroAddress();
        if (_reserveToken == address(0)) revert ZeroAddress();
        if (_aerodromeRouter == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        auToken = IERC20(_auToken);
        reserveToken = IERC20(_reserveToken);
        aerodromeRouter = IAerodromeRouter(_aerodromeRouter);

        // Grant all roles to admin
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
        _grantRole(PARAM_ROLE, _admin);

        // Set default parameters
        cooldown = 24 hours;
        maxSlippageBps = 50;        // 0.5%
        maxPriceDeviationBps = 500; // 5%
        maxUpdateDeviationBps = 500; // 5% max deviation per TWAP update
        minTwapUpdateInterval = 1 hours; // minimum time between TWAP updates
        maxBuybackPerEpochBps = 500; // 5%
        twapWindow = 1 hours;
    }

    // ============================================================
    //                    CORE BUYBACK FUNCTION
    // ============================================================

    /**
     * @notice Executes a buyback of Au tokens using reserve tokens
     * @param reserveAmount Amount of reserve tokens to spend
     * @param minAuOut Minimum amount of Au tokens to receive (slippage protection)
     * @param useAerodrome If true, use Aerodrome; if false, use Uniswap V2
     * @param deadline Transaction deadline timestamp
     */
    function executeBuyback(
        uint256 reserveAmount,
        uint256 minAuOut,
        bool useAerodrome,
        uint256 deadline
    )
        external
        onlyExecutor
        nonReentrant
        whenNotPaused
        respectsCooldown
        respectsRunway(reserveAmount)
    {
        // Validate inputs
        if (reserveAmount == 0) revert ZeroReserveAmount();
        if (deadline < block.timestamp) revert DeadlineInPast(deadline, block.timestamp);
        if (deadline > block.timestamp + MAX_DEADLINE_EXTENSION) {
            revert DeadlineTooFar(deadline, block.timestamp + MAX_DEADLINE_EXTENSION);
        }

        // Enforce per-epoch cap: max 5% of current reserve balance
        uint256 currentReserve = reserveToken.balanceOf(address(this));
        uint256 maxEpochAmount = (currentReserve * maxBuybackPerEpochBps) / BPS_DENOMINATOR;
        if (reserveAmount > maxEpochAmount) {
            revert ExceedsEpochCap(reserveAmount, maxEpochAmount);
        }

        // Enforce minimum buyback floor
        if (reserveAmount < MIN_BUYBACK_USD) {
            revert BelowBuybackFloor(reserveAmount, MIN_BUYBACK_USD);
        }

        // TWAP price validation
        _validateTWAPPrice(reserveAmount, minAuOut);

        // Calculate expected output for slippage reference
        uint256 expectedOutput = _getExpectedOutput(reserveAmount, useAerodrome);

        // Calculate minimum output based on slippage tolerance
        uint256 slippageMinOut = expectedOutput -
            (expectedOutput * maxSlippageBps) / BPS_DENOMINATOR;

        // Use the more conservative (higher) of minAuOut and slippage-based minimum
        uint256 finalMinOut = minAuOut > slippageMinOut ? minAuOut : slippageMinOut;

        // Execute swap
        uint256 auReceived;
        if (useAerodrome) {
            auReceived = _swapOnAerodrome(reserveAmount, finalMinOut, deadline);
        } else {
            auReceived = _swapOnUniswap(reserveAmount, finalMinOut, deadline);
        }

        // Final slippage check
        if (auReceived < minAuOut) {
            revert SlippageExceeded(auReceived, minAuOut);
        }

        // Update state
        lastOperationTime = block.timestamp;
        totalBuybacksExecuted += 1;
        totalAuBought += auReceived;
        totalReserveSpent += reserveAmount;

        emit BuybackExecuted(
            msg.sender,
            reserveAmount,
            auReceived,
            useAerodrome,
            block.timestamp
        );
    }

    // ============================================================
    //                      INTERNAL SWAP LOGIC
    // ============================================================

    /**
     * @notice Executes swap on Aerodrome DEX
     * @param reserveAmount Amount of reserve tokens to swap
     * @param minAuOut Minimum Au tokens to receive
     * @param deadline Transaction deadline
     * @return auAmount Amount of Au tokens received
     */
    function _swapOnAerodrome(
        uint256 reserveAmount,
        uint256 minAuOut,
        uint256 deadline
    ) internal returns (uint256 auAmount) {
        address[] memory path = new address[](2);
        path[0] = address(reserveToken);
        path[1] = address(auToken);

        // Approve router to spend reserve tokens
        reserveToken.forceApprove(address(aerodromeRouter), reserveAmount);

        uint256[] memory amounts = aerodromeRouter.swapExactTokensForTokens(
            reserveAmount,
            minAuOut,
            path,
            address(this),
            deadline
        );

        auAmount = amounts[amounts.length - 1];

        // Clear approval
        reserveToken.forceApprove(address(aerodromeRouter), 0);
    }

    /**
     * @notice Executes swap on Uniswap V2 DEX
     * @param reserveAmount Amount of reserve tokens to swap
     * @param minAuOut Minimum Au tokens to receive
     * @param deadline Transaction deadline
     * @return auAmount Amount of Au tokens received
     */
    function _swapOnUniswap(
        uint256 reserveAmount,
        uint256 minAuOut,
        uint256 deadline
    ) internal returns (uint256 auAmount) {
        address[] memory path = new address[](2);
        path[0] = address(reserveToken);
        path[1] = address(auToken);

        // Approve router to spend reserve tokens
        reserveToken.forceApprove(address(uniswapRouter), reserveAmount);

        // Capture balance before swap to prevent donation attack (C-1 fix)
        uint256 balanceBefore = auToken.balanceOf(address(this));

        uniswapRouter.swapExactTokensForTokensSupportingTransferTokens(
            reserveAmount,
            minAuOut,
            path,
            address(this),
            deadline
        );

        // Calculate received amount from balance delta (not total balance)
        auAmount = auToken.balanceOf(address(this)) - balanceBefore;

        // Clear approval
        reserveToken.forceApprove(address(uniswapRouter), 0);
    }

    // ============================================================
    //                    TWAP VALIDATION LOGIC
    // ============================================================

    /**
     * @notice Validates the current TWAP price against expected output
     * @param reserveAmount Amount of reserve tokens being spent
     * @param minAuOut Minimum expected Au tokens
     */
    function _validateTWAPPrice(uint256 reserveAmount, uint256 minAuOut) internal view {
        // Skip TWAP validation if no TWAP price has been set
        if (twapPrice == 0) return;

        // Check TWAP staleness
        if (block.timestamp > twapLastUpdate + twapWindow) {
            revert TWAPStale(twapLastUpdate, block.timestamp, twapWindow);
        }

        // Calculate expected Au amount based on TWAP price
        // twapPrice is reserve per Au scaled by 1e18
        // expectedAu = reserveAmount * 1e18 / twapPrice
        uint256 expectedAuFromTWAP = (reserveAmount * 1e18) / twapPrice;

        // Check if minAuOut deviates from TWAP price beyond allowed threshold
        // We check: is minAuOut within maxPriceDeviationBps of expectedAuFromTWAP?
        // This protects against buying at significantly above market price
        if (minAuOut > expectedAuFromTWAP) {
            // minAuOut is higher than TWAP expects — not a problem for buyer
            // but we still check it's not unreasonably high
            uint256 deviation = ((minAuOut - expectedAuFromTWAP) * BPS_DENOMINATOR) /
                expectedAuFromTWAP;
            if (deviation > maxPriceDeviationBps) {
                revert TWAPDeviationExceeded(expectedAuFromTWAP, minAuOut, maxPriceDeviationBps);
            }
        } else {
            // minAuOut is lower than TWAP expects — check it's not too low
            // (would indicate buying at a bad price)
            uint256 deviation = ((expectedAuFromTWAP - minAuOut) * BPS_DENOMINATOR) /
                expectedAuFromTWAP;
            if (deviation > maxPriceDeviationBps) {
                revert TWAPDeviationExceeded(expectedAuFromTWAP, minAuOut, maxPriceDeviationBps);
            }
        }
    }

    // ============================================================
    //                   PARAMETER MANAGEMENT
    // ============================================================

    /**
     * @notice Updates the cooldown period between operations
     * @param newCooldown New cooldown duration in seconds
     */
    function setCooldown(uint256 newCooldown) external onlyRole(PARAM_ROLE) {
        if (newCooldown == 0) revert InvalidParameter("cooldown", newCooldown);
        uint256 oldCooldown = cooldown;
        cooldown = newCooldown;
        emit CooldownUpdated(oldCooldown, newCooldown);
    }

    /**
     * @notice Updates the maximum slippage tolerance
     * @param newMaxSlippageBps New max slippage in basis points
     */
    function setMaxSlippage(uint256 newMaxSlippageBps) external onlyRole(PARAM_ROLE) {
        if (newMaxSlippageBps > BPS_DENOMINATOR) {
            revert InvalidParameter("maxSlippage", newMaxSlippageBps);
        }
        uint256 oldSlippage = maxSlippageBps;
        maxSlippageBps = newMaxSlippageBps;
        emit SlippageUpdated(oldSlippage, newMaxSlippageBps);
    }

    /**
     * @notice Updates the maximum TWAP price deviation
     * @param newMaxDeviationBps New max deviation in basis points
     */
    function setMaxPriceDeviation(uint256 newMaxDeviationBps) external onlyRole(PARAM_ROLE) {
        if (newMaxDeviationBps > BPS_DENOMINATOR) {
            revert InvalidParameter("maxDeviation", newMaxDeviationBps);
        }
        maxPriceDeviationBps = newMaxDeviationBps;
    }

    /**
     * @notice Updates the minimum runway reserve
     * @param newMinRunwayReserve New minimum runway reserve amount
     */
    function setMinRunwayReserve(uint256 newMinRunwayReserve) external onlyRole(PARAM_ROLE) {
        uint256 oldRunway = minRunwayReserve;
        minRunwayReserve = newMinRunwayReserve;
        emit RunwayUpdated(oldRunway, newMinRunwayReserve);
    }

    /**
     * @notice Updates the maximum buyback per epoch
     * @param newMaxBuybackBps New max buyback in basis points of reserve
     */
    function setMaxBuybackPerEpoch(uint256 newMaxBuybackBps) external onlyRole(PARAM_ROLE) {
        if (newMaxBuybackBps > BPS_DENOMINATOR) {
            revert InvalidParameter("maxBuybackPerEpoch", newMaxBuybackBps);
        }
        maxBuybackPerEpochBps = newMaxBuybackBps;
    }

    /**
     * @notice Updates the Aerodrome router address
     */
    function setAerodromeRouter(address newRouter) external onlyRole(PARAM_ROLE) {
        if (newRouter == address(0)) revert ZeroAddress();
        address oldRouter = address(aerodromeRouter);
        aerodromeRouter = IAerodromeRouter(newRouter);
        emit RouterUpdated("aerodrome", oldRouter, newRouter);
    }

    /**
     * @notice Updates the Uniswap V2 router address
     */
    function setUniswapRouter(address newRouter) external onlyRole(PARAM_ROLE) {
        if (newRouter == address(0)) revert ZeroAddress();
        address oldRouter = address(uniswapRouter);
        uniswapRouter = IUniswapV2Router(newRouter);
        emit RouterUpdated("uniswap", oldRouter, newRouter);
    }

    /**
     * @notice Updates the TWAP price (can be called by executor or param role)
     * @param newPrice New TWAP price (reserve per Au, 1e18 scaled)
     */
    function updateTWAPPrice(uint256 newPrice) external {
        if (
            !hasRole(EXECUTOR_ROLE, msg.sender) &&
            !hasRole(PARAM_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert NotExecutor(msg.sender);
        }

        // Enforce minimum time between TWAP updates
        if (block.timestamp < twapLastUpdate + minTwapUpdateInterval) {
            revert CooldownActive(block.timestamp, twapLastUpdate + minTwapUpdateInterval);
        }

        // Enforce maximum deviation per update (if previous price exists)
        if (twapPrice > 0 && newPrice > 0) {
            uint256 deviation;
            if (newPrice > twapPrice) {
                deviation = ((newPrice - twapPrice) * BPS_DENOMINATOR) / twapPrice;
            } else {
                deviation = ((twapPrice - newPrice) * BPS_DENOMINATOR) / twapPrice;
            }
            if (deviation > maxUpdateDeviationBps) {
                revert TWAPDeviationExceeded(twapPrice, newPrice, maxUpdateDeviationBps);
            }
        }

        twapPrice = newPrice;
        twapLastUpdate = block.timestamp;
        emit TWAPUpdated(newPrice, block.timestamp);
    }

    // ============================================================
    //                    EMERGENCY FUNCTIONS
    // ============================================================

    /**
     * @notice Pauses all buyback operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses buyback operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal of tokens when paused
     * @param token Address of token to withdraw
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        if (token == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;

        if (withdrawAmount > balance) {
            revert InsufficientBalance(withdrawAmount, balance);
        }

        IERC20(token).safeTransfer(msg.sender, withdrawAmount);
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Returns the time remaining until next operation is allowed
     * @return Time in seconds until next operation (0 if ready)
     */
    function timeUntilNextOperation() external view returns (uint256) {
        uint256 availableAt = lastOperationTime + cooldown;
        if (block.timestamp >= availableAt) {
            return 0;
        }
        return availableAt - block.timestamp;
    }

    /**
     * @notice Returns the current reserve token balance of the contract
     * @return Reserve token balance
     */
    function getReserveBalance() external view returns (uint256) {
        return reserveToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the current Au token balance of the contract
     * @return Au token balance
     */
    function getAuBalance() external view returns (uint256) {
        return auToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the expected Au output for a given reserve input
     * @param reserveAmount Amount of reserve tokens to swap
     * @param useAerodrome Whether to query Aerodrome or Uniswap
     * @return expectedAu Expected Au tokens to receive
     */
    function getExpectedOutput(
        uint256 reserveAmount,
        bool useAerodrome
    ) external view returns (uint256 expectedAu) {
        return _getExpectedOutput(reserveAmount, useAerodrome);
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    /**
     * @notice Internal helper to get expected output from DEX
     * @param reserveAmount Amount of reserve tokens
     * @param useAerodrome Which DEX to query
     * @return Expected Au token output
     */
    function _getExpectedOutput(
        uint256 reserveAmount,
        bool useAerodrome
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(reserveToken);
        path[1] = address(auToken);

        uint256[] memory amounts;
        if (useAerodrome) {
            amounts = aerodromeRouter.getAmountsOut(reserveAmount, path);
        } else {
            amounts = uniswapRouter.getAmountsOut(reserveAmount, path);
        }

        return amounts[amounts.length - 1];
    }
}
