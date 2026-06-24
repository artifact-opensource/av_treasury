// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

interface IDexSimulator {
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidity);
    function removeLiquidity(uint256 liquidity) external returns (uint256 amountA, uint256 amountB);
    function addOneSidedA(uint256 amountAIn) external returns (uint256 lpShares);
    function addOneSidedB(uint256 amountBIn) external returns (uint256 lpShares);
    function swapAforB(uint256 amountAIn, uint256 minAmountBOut, address to) external returns (uint256 amountBOut);
    function swapBforA(uint256 amountBIn, uint256 minAmountAOut, address to) external returns (uint256 amountAOut);
    function getReserveA() external view returns (uint256);
    function getReserveB() external view returns (uint256);
}
