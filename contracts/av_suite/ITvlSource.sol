// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title ITvlSource
 * @notice Interface for contracts that report TVL to AvOracle
 * @dev Implemented by staking contracts, liquidity pools, etc.
 */
interface ITvlSource {
    /**
     * @notice Get the total value locked in this source
     * @return tvl TVL in 18 decimals (USD)
     */
    function getTvl() external view returns (uint256 tvl);
}
