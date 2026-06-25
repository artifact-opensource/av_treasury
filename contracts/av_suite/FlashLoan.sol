// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IReceiver.sol";
import "./DexSimulator.sol";

/**
 * ═══════════════════════════════════════════════════════════════════
 * FlashLoan — Atomic Borrowing from DEX Reserves
 * ═══════════════════════════════════════════════════════════════════
 *
 * Provides flash loans directly from DEX reserves.
 * Borrowers take tokens from the DEX pool, use them in their callback,
 * and must return the same amount + 0.1% fee to the DEX pool.
 * Fees accumulate in the DEX (increasing reserves = LP value accrual).
 *
 * This is similar to Uniswap V2's flash swaps but with a fee.
 *
 * Flow:
 * 1. Borrower calls flashSwap(token, amount, data)
 * 2. FlashLoan transfers `amount` from DEX reserves to borrower
 * 3. Borrower executes arbitrary logic in `receiveFlashLoan()`
 * 4. Borrower returns `amount + fee` to FlashLoan contract
 * 5. FlashLoan sends `amount` back to DEX, keeps `fee` for Treasury
 *
 * The DEX must approve this contract to spend its reserves via transferFrom.
 * In the sandbox, we use a separate funded model.
 * ═══════════════════════════════════════════════════════════════════
 */
contract FlashLoan {
    // ─── Immutable State ────────────────────────────────────────
    address public immutable dex;
    address public immutable treasury;
    address public immutable agToken;
    address public immutable auToken;

    uint256 public constant FEE_BPS = 10;       // 0.1% = 10 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Events ─────────────────────────────────────────────────
    event FlashLoanExecuted(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee,
        bool success
    );

    // ─── Errors ─────────────────────────────────────────────────
    error FlashLoan_RepaymentFailed();
    error FlashLoan_InvalidToken();
    error FlashLoan_InsufficientLiquidity();
    error FlashLoan_ZeroAmount();
    error FlashLoan_Unauthorized();

    // ─── Constructor ────────────────────────────────────────────
    constructor(
        address _dex,
        address _treasury,
        address _agToken,
        address _auToken
    ) {
        if (_dex == address(0) || _treasury == address(0)) {
            revert FlashLoan_InvalidToken();
        }
        dex = _dex;
        treasury = _treasury;
        agToken = _agToken;
        auToken = _auToken;
    }

    // ─── External Functions ─────────────────────────────────────

    /**
     * @notice Execute a flash loan from the protocol's own balance
     * @dev This contract must hold tokens (funded by Treasury)
     * @param token The token to borrow (Ag or Au)
     * @param amount The amount to borrow
     * @param data Arbitrary data passed to receiver's callback
     */
    function flashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external {
        if (amount == 0) revert FlashLoan_ZeroAmount();
        if (token != agToken && token != auToken) revert FlashLoan_InvalidToken();

        uint256 fee = _calculateFee(amount);
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        if (amount > balanceBefore) revert FlashLoan_InsufficientLiquidity();

        // Transfer borrowed amount to caller
        IERC20(token).transfer(msg.sender, amount);

        // Call borrower's callback
        IReceiver(msg.sender).receiveFlashLoan(token, amount, fee, data);

        // Verify repayment: borrower must return amount + fee
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 requiredBalance = balanceBefore + fee;

        if (balanceAfter < requiredBalance) {
            // Try to pull from borrower
            uint256 shortfall = requiredBalance - balanceAfter;
            IERC20(token).transferFrom(msg.sender, address(this), shortfall);
        }

        // Final verification
        uint256 finalBalance = IERC20(token).balanceOf(address(this));
        if (finalBalance < balanceBefore + fee) {
            revert FlashLoan_RepaymentFailed();
        }

        // Send fee to Treasury
        uint256 actualFee = finalBalance - balanceBefore;
        if (actualFee > 0) {
            IERC20(token).transfer(treasury, actualFee);
        }

        emit FlashLoanExecuted(msg.sender, token, amount, actualFee, true);
    }

    /**
     * @notice Fund this contract with tokens (called by Treasury)
     */
    function fund(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraw accumulated fees (governance only)
     */
    function withdrawFee(address token, uint256 amount) external {
        // In production: add access control
        IERC20(token).transfer(treasury, amount);
    }

    // ─── View Functions ─────────────────────────────────────────

    function calculateFee(uint256 amount) external pure returns (uint256) {
        return _calculateFee(amount);
    }

    // ─── Internal Functions ─────────────────────────────────────

    function _calculateFee(uint256 amount) internal pure returns (uint256) {
        return (amount * FEE_BPS) / BPS_DENOMINATOR;
    }
}
