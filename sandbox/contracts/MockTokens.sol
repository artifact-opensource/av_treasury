// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Mock agUSD — stablecoin for sandbox testing
 */
contract MockAgUSD is ERC20 {
    constructor() ERC20("Agora USD", "agUSD") {
        _mint(msg.sender, 1_000_000_000 * 1e18);  // 1B initial supply
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title Mock AVAX — volatile asset for sandbox testing
 */
contract MockAVAX is ERC20 {
    constructor() ERC20("Avalanche", "AVAX") {
        _mint(msg.sender, 100_000_000 * 1e18);  // 100M initial supply
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title Mock USDC — alternative stablecoin
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals = 6;

    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 500_000_000 * 1e6);  // 500M initial supply
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
