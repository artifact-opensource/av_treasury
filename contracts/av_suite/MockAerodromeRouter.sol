// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * MockAerodromeRouter — minimal constant-product AMM exposing the Aerodrome
 * router interface used by TreasuryAMO / TreasuryFlashBuy:
 *   getAmountsOut(uint256 amountIn, address[] path) -> uint256[] memory
 *   swapExactTokensForTokens(uint,uint,path,to,uint) -> uint256[] amounts
 * Pools are seeded via addLiquidity(tokenA, tokenB, resA, resB).
 * Enough to let the flywheel execute real buy/sell swaps on local testnet.
 */
interface IAerodromeRouter {
    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory);
    function swapExactTokensForTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path,
        address to, uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract MockAerodromeRouter is IAerodromeRouter {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public reserve0; // tokenA=>tokenB=>balA
    mapping(address => mapping(address => uint256)) public reserve1; // tokenA=>tokenB=>balB

    event Swap(address indexed tokenIn, address indexed tokenOut, uint256 amtIn, uint256 amtOut, address to);

    function _pairKey(address a, address b) internal pure returns (address, address) {
        return a < b ? (a, b) : (b, a);
    }

    function addLiquidity(address a, address b, uint256 ra, uint256 rb) external {
        (address ta, address tb) = _pairKey(a, b);
        IERC20(a).safeTransferFrom(msg.sender, address(this), ra);
        IERC20(b).safeTransferFrom(msg.sender, address(this), rb);
        // Store reserves in SORTED order so reserve0 = min-token reserve,
        // reserve1 = max-token reserve. Keeps swapExactTokensForTokens'
        // aIsTa mapping correct for any token ordering.
        if (a < b) { reserve0[ta][tb] = ra; reserve1[ta][tb] = rb; }
        else { reserve0[ta][tb] = rb; reserve1[ta][tb] = ra; }
    }

    function getReserves(address a, address b) public view returns (uint256, uint256) {
        (address ta, address tb) = _pairKey(a, b);
        return (reserve0[ta][tb], reserve1[ta][tb]);
    }

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory) {
        require(path.length >= 2, "bad path");
        uint256[] memory out = new uint256[](path.length);
        out[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            (uint256 r0, uint256 r1) = getReserves(path[i], path[i + 1]);
            require(r0 > 0 && r1 > 0, "no pool");
            out[i + 1] = (out[i] * r1 * 997) / (r0 * 1000 + out[i] * 997);
        }
        return out;
    }

    /// @notice Quote output for swapping `amountIn` of `tokenIn` for `tokenOut` (1-hop)
    function quoteOut(address tokenIn, address tokenOut, uint256 amountIn)
        external view returns (uint256 amountOut)
    {
        (uint256 r0, uint256 r1) = getReserves(tokenIn, tokenOut);
        require(r0 > 0 && r1 > 0, "no pool");
        (address ta, ) = _pairKey(tokenIn, tokenOut);
        uint256 rIn = (tokenIn == ta) ? r0 : r1;
        uint256 rOut = (tokenIn == ta) ? r1 : r0;
        amountOut = (amountIn * rOut * 997) / (rIn * 1000 + amountIn * 997);
    }

    function swapExactTokensForTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path,
        address to, uint256 /*deadline*/
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "bad path");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address ta, address tb) = _pairKey(path[i], path[i + 1]);
            uint256 balIn = reserve0[ta][tb] > 0 ? reserve0[ta][tb] : reserve1[ta][tb];
            bool aIsTa = (path[i] == ta);
            uint256 rIn = aIsTa ? reserve0[ta][tb] : reserve1[ta][tb];
            uint256 rOut = aIsTa ? reserve1[ta][tb] : reserve0[ta][tb];
            uint256 amtOut = (amounts[i] * rOut * 997) / (rIn * 1000 + amounts[i] * 997);
            require(amtOut >= amountOutMin || i == path.length - 2, "slippage");
            amounts[i + 1] = amtOut;
            if (aIsTa) { reserve0[ta][tb] += amounts[i]; reserve1[ta][tb] -= amtOut; }
            else { reserve1[ta][tb] += amounts[i]; reserve0[ta][tb] -= amtOut; }
            IERC20(path[i + 1]).safeTransfer(to, amtOut);
            emit Swap(path[i], path[i + 1], amounts[i], amtOut, to);
        }
        return amounts;
    }
}
