// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MockTreasuryAMO
 * @notice Minimal mock of TreasuryAMO for testing — exposes twapPrice()
 */
contract MockTreasuryAMO {
    uint256 public twapPrice;

    function setTwapPrice(uint256 _price) external {
        twapPrice = _price;
    }

    /// @notice Get Au price (same as twapPrice for simplicity)
    function getAuPrice() external view returns (uint256, uint8) {
        return (twapPrice, 2); // source = TWAP
    }
}
