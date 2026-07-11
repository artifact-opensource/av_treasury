// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock USDC for local testnet (6 decimals like real USDC).
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}
