// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MockAvOracle
 * @notice Minimal mock of AvOracle for testing OracleGuardian + FlashBuy stack
 * @dev Reimplements the getPrice return signature from AvOracle
 */
contract MockAvOracle {
    enum PriceSource { None, TWAP, Oracle, Both, Fixed }

    struct PriceData {
        uint256 price;
        PriceSource source;
        uint256 timestamp;
    }

    mapping(address => PriceData) public prices;

    function setPrice(address token, uint256 price, uint8 source) external {
        prices[token] = PriceData({
            price: price,
            source: PriceSource(source),
            timestamp: block.timestamp
        });
    }

    function getPrice(address token) external view returns (uint256 price, PriceSource source) {
        PriceData memory data = prices[token];
        return (data.price, data.source);
    }
}
