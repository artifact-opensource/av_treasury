// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @notice Interface for contracts that can receive flash loans
 */
interface IReceiver {
    /**
     * @notice Called by FlashLoan after transferring the borrowed tokens
     * @param token The token that was borrowed
     * @param amount The amount borrowed
     * @param fee The fee that must be repaid
     * @param data Arbitrary data passed by the caller
     */
    function receiveFlashLoan(
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external;
}
