// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockDEX
 * @notice Simple mock DEX for testing FlashBuy execution
 * @dev Swaps USDC for AG at a fixed rate
 */
contract MockDEX {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    IERC20 public ag;
    uint256 public rate; // AG per USDC (18 decimals)

    event Swap(address indexed sender, uint256 usdcIn, uint256 agOut, address recipient);

    constructor(address _usdc, address _ag, uint256 _rate) {
        usdc = IERC20(_usdc);
        ag = IERC20(_ag);
        rate = _rate;
    }

    /**
     * @notice Swap USDC for AG
     * @param usdcIn Amount of USDC to swap
     * @param minAgOut Minimum AG to accept
     * @param recipient Where to send AG
     * @return agOut Amount of AG sent
     */
    function swap(
        uint256 usdcIn,
        uint256 minAgOut,
        address recipient
    ) external returns (uint256 agOut) {
        // Calculate output: usdcIn * rate (adjust for decimals)
        // USDC has 6 decimals, AG has 18 decimals
        agOut = (usdcIn * rate * 1e12); // 6→18 decimal adjustment already in rate

        require(agOut >= minAgOut, "MockDEX: slippage");

        // Transfer USDC from sender
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        // Transfer AG to recipient
        ag.safeTransfer(recipient, agOut);

        emit Swap(msg.sender, usdcIn, agOut, recipient);
    }

    function setRate(uint256 _rate) external {
        rate = _rate;
    }
}
