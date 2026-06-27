// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Re-export for Hardhat contract factory resolution
contract ProxyHelper is ERC1967Proxy {
    constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {}

    function _unsafeAllowUninitialized() internal pure virtual override returns (bool) {
        return true;
    }
}
