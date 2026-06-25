// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IReceiver.sol";

/**
 * ═══════════════════════════════════════════════════════════════════
 * TreasuryFlashBuy — Flash Loan-Powered Treasury Buyback
 * ═══════════════════════════════════════════════════════════════════
 *
 * Simplified approach: The BotEngine calls this directly without
 * actual flash loans from the FlashLoan contract. Instead, this
 * contract holds Ag from the Treasury and performs buybacks by
 * swapping Ag for Au on the DEX, then sending Au to Treasury.
 *
 * This avoids the complex flash-loan-repayment-insame-token problem.
 * The TreasuryFlashBuy IS the flash loan beneficiary — it borrows Ag
 * from the FlashLoan contract, immediately swaps for Au via DEX,
 * and the FlashLoan contract accepts Au as repayment (with a premium).
 *
 * Actually, the simplest working model for the sandbox:
 * 1. TreasuryFlashBuy holds Ag (funded by Treasury)
 * 2. Anyone can call buybackAu to swap Ag→Au on DEX
 * 3. Au profit goes to Treasury
 * ═══════════════════════════════════════════════════════════════════
 */
contract TreasuryFlashBuy {
    address public immutable dex;
    address public immutable treasury;
    address public immutable agToken;
    address public immutable auToken;

    event BuybackExecuted(uint256 agSold, uint256 auReceived, address indexed caller);

    error TreasuryFlashBuy_SlippageExceeded();
    error TreasuryFlashBuy_ZeroAmount();

    constructor(
        address _dex,
        address _treasury,
        address _agToken,
        address _auToken
    ) {
        dex = _dex;
        treasury = _treasury;
        agToken = _agToken;
        auToken = _auToken;
    }

    /**
     * @notice Execute a buyback: swap Ag from this contract for Au, send to Treasury
     * @param agAmount Amount of Ag to sell
     * @param minAu Minimum Au to receive (slippage protection)
     */
    function buybackAu(uint256 agAmount, uint256 minAu) external {
        if (agAmount == 0) revert TreasuryFlashBuy_ZeroAmount();

        uint256 agBalance = IERC20(agToken).balanceOf(address(this));
        if (agAmount > agBalance) agAmount = agBalance;

        // Approve DEX to spend Ag
        IERC20(agToken).approve(dex, 0);
        IERC20(agToken).approve(dex, agAmount);

        // Swap Ag for Au on DEX
        // swapAforB(amountAIn, minAmountBOut, to)
        (bool success, bytes memory data) = dex.call(
            abi.encodeWithSignature("swapAforB(uint256,uint256,address)", agAmount, minAu, address(this))
        );
        require(success, "Swap failed");

        // Check Au received
        uint256 auReceived = IERC20(auToken).balanceOf(address(this));
        if (auReceived < minAu) revert TreasuryFlashBuy_SlippageExceeded();

        // Send Au to Treasury
        if (auReceived > 0) {
            IERC20(auToken).transfer(treasury, auReceived);
        }

        emit BuybackExecuted(agAmount, auReceived, msg.sender);
    }

    /**
     * @notice Fund this contract with Ag from Treasury
     */
    function fundAg(uint256 amount) external {
        IERC20(agToken).transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraw any token (governance)
     */
    function withdraw(address token) external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(treasury, balance);
        }
    }
}
