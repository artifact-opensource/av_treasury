// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title DexSimulator
 * @dev UniswapV2-style AMM pool for stress testing TreasuryAMO buyback mechanism
 * 
 * Supports:
 * - Two-sided liquidity provision
 * - One-sided liquidity (simulating Aerodrome-style pools)
 * - Constant product formula x * y = k
 * - 0.3% swap fee
 * - Price oracle via cumulative price
 */
contract DexSimulator {
    using SafeMath for uint256;

    // ─── Tokens ───────────────────────────────────────────────
    IERC20 public tokenA;  // e.g., agUSD (stablecoin)
    IERC20 public tokenB;  // e.g., AVAX (volatile asset)

    // ─── Reserves ─────────────────────────────────────────────
    uint112 private reserveA;
    uint112 private reserveB;
    uint32 private blockTimestampLast;

    // ─── Price Oracle ─────────────────────────────────────────
    uint256 public priceCumulativeA;
    uint256 public priceCumulativeB;
    uint256 public priceA;  // Last reported price (scaled 1e18)
    uint256 public priceB;

    // ─── LP State ─────────────────────────────────────────────
    mapping(address => uint256) public liquidity;
    uint256 public totalLiquidity;
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_BPS = 30;  // 0.3% = 30 bps

    // ─── Events ───────────────────────────────────────────────
    event AddLiquidity(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event RemoveLiquidity(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Swap(address indexed swapper, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event Sync(uint112 reserveA, uint112 reserveB);
    event PriceUpdate(uint256 priceA, uint256 priceB);

    // ─── Constructor ──────────────────────────────────────────
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0), "invalid tokenA");
        require(_tokenB != address(0), "invalid tokenB");
        require(_tokenA != _tokenB, "identical tokens");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // ─── Mint (Add Liquidity) ────────────────────────────────
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidityOut) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        
        if (totalLiquidity == 0) {
            // First liquidity: geometric mean minus minimum lock
            liquidityOut = sqrt(amountA * amountB).sub(MINIMUM_LIQUIDITY);
            liquidity[address(0)] = MINIMUM_LIQUIDITY;  // permanently lock
            totalLiquidity = liquidityOut;
        } else {
            // Proportional to existing liquidity
            liquidityOut = min(
                amountA.mul(totalLiquidity).div(_reserveA),
                amountB.mul(totalLiquidity).div(_reserveB)
            );
            require(liquidityOut > 0, "insufficient liquidity");
            totalLiquidity = totalLiquidity.add(liquidityOut);
        }

        liquidity[msg.sender] = liquidity[msg.sender].add(liquidityOut);
        
        _updateReserves(
            uint256(_reserveA).add(amountA),
            uint256(_reserveB).add(amountB)
        );

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "transfer A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "transfer B failed");

        emit AddLiquidity(msg.sender, amountA, amountB, liquidityOut);
        emit Sync(reserveA, reserveB);
    }

    // ─── One-Sided Liquidity (Aerodrome-style) ───────────────
    /**
     * @notice Add only one token — pool accepts imbalanced deposits
     * @param amountA Amount of tokenA to deposit (set tokenB = 0)
     * @param amountB Amount of tokenB to deposit (set tokenA = 0)
     */
    function addOneSidedLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidityOut) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        require(amountA > 0 || amountB > 0, "must provide liquidity");
        require(amountA == 0 || amountB == 0, "one-sided: only one non-zero");

        if (totalLiquidity == 0) {
            // First deposit: accept any ratio, use geometric mean
            uint256 product = (amountA > 0 ? amountA : 1).mul(amountB > 0 ? amountB : 1);
            if (amountA > 0) {
                liquidityOut = sqrt(amountA * amountA);  // treat as equal
            } else {
                liquidityOut = sqrt(amountB * amountB);
            }
            liquidityOut = liquidityOut.sub(MINIMUM_LIQUIDITY);
            liquidity[address(0)] = MINIMUM_LIQUIDITY;
            totalLiquidity = liquidityOut;
        } else {
            // Proportional to whichever side is provided
            if (amountA > 0) {
                liquidityOut = amountA.mul(totalLiquidity).div(_reserveA);
            } else {
                liquidityOut = amountB.mul(totalLiquidity).div(_reserveB);
            }
            require(liquidityOut > 0, "insufficient liquidity");
            totalLiquidity = totalLiquidity.add(liquidityOut);
        }

        liquidity[msg.sender] = liquidity[msg.sender].add(liquidityOut);

        uint256 newReserveA = uint256(_reserveA).add(amountA);
        uint256 newReserveB = uint256(_reserveB).add(amountB);
        _updateReserves(newReserveA, newReserveB);

        if (amountA > 0) require(tokenA.transferFrom(msg.sender, address(this), amountA), "transfer A failed");
        if (amountB > 0) require(tokenB.transferFrom(msg.sender, address(this), amountB), "transfer B failed");

        emit AddLiquidity(msg.sender, amountA, amountB, liquidityOut);
        emit Sync(reserveA, reserveB);
    }

    // ─── Burn (Remove Liquidity) ─────────────────────────────
    function removeLiquidity(uint256 liquidityOut) external {
        uint256 liq = liquidity[msg.sender];
        require(liq >= liquidityOut, "insufficient LP");

        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        uint256 amountA = liquidityOut.mul(_reserveA).div(totalLiquidity);
        uint256 amountB = liquidityOut.mul(_reserveB).div(totalLiquidity);

        liquidity[msg.sender] = liq.sub(liquidityOut);
        totalLiquidity = totalLiquidity.sub(liquidityOut);

        _updateReserves(
            uint256(_reserveA).sub(amountA),
            uint256(_reserveB).sub(amountB)
        );

        require(tokenA.transfer(msg.sender, amountA), "transfer A failed");
        require(tokenB.transfer(msg.sender, amountB), "transfer B failed");

        emit RemoveLiquidity(msg.sender, amountA, amountB, liquidityOut);
        emit Sync(reserveA, reserveB);
    }

    // ─── Swap ────────────────────────────────────────────────
    function swapAforB(uint256 amountAIn) external returns (uint256 amountBOut) {
        require(amountAIn > 0, "insufficient input");
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();

        uint256 amountAInWithFee = amountAIn.mul(10000 - FEE_BPS).div(10000);
        uint256 numerator = amountAInWithFee.mul(_reserveB);
        uint256 denominator = uint256(_reserveA).mul(10000).add(amountAInWithFee.mul(10000));
        amountBOut = numerator / denominator;
        require(amountBOut > 0, "insufficient output");

        _updateReserves(
            uint256(_reserveA).add(amountAIn),
            uint256(_reserveB).sub(amountBOut)
        );

        require(tokenA.transferFrom(msg.sender, address(this), amountAIn), "transfer A failed");
        require(tokenB.transfer(msg.sender, amountBOut), "transfer B failed");

        emit Swap(msg.sender, address(tokenA), address(tokenB), amountAIn, amountBOut);
        emit Sync(reserveA, reserveB);
    }

    function swapBforA(uint256 amountBIn) external returns (uint256 amountAOut) {
        require(amountBIn > 0, "insufficient input");
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();

        uint256 amountBInWithFee = amountBIn.mul(10000 - FEE_BPS).div(10000);
        uint256 numerator = amountBInWithFee.mul(_reserveA);
        uint256 denominator = uint256(_reserveB).mul(10000).add(amountBInWithFee.mul(10000));
        amountAOut = numerator / denominator;
        require(amountAOut > 0, "insufficient output");

        _updateReserves(
            uint256(_reserveA).sub(amountAOut),
            uint256(_reserveB).add(amountBIn)
        );

        require(tokenB.transferFrom(msg.sender, address(this), amountBIn), "transfer B failed");
        require(tokenA.transfer(msg.sender, amountAOut), "transfer A failed");

        emit Swap(msg.sender, address(tokenB), address(tokenA), amountBIn, amountAOut);
        emit Sync(reserveA, reserveB);
    }

    // ─── View Functions ──────────────────────────────────────
    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserveA, reserveB, blockTimestampLast);
    }

    function getAmountsOut(uint256 amountIn, bool aToB) external view returns (uint256) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        uint256 rIn = aToB ? _reserveA : _reserveB;
        uint256 rOut = aToB ? _reserveB : _reserveA;
        uint256 amountInWithFee = amountIn.mul(10000 - FEE_BPS);
        uint256 numerator = amountInWithFee.mul(rOut);
        uint256 denominator = rIn.mul(10000).add(amountInWithFee);
        return numerator / denominator;
    }

    function getPriceA() external view returns (uint256) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        if (_reserveA == 0) return 0;
        return uint256(_reserveB).mul(1e18).div(_reserveA);
    }

    function getPriceB() external view returns (uint256) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        if (_reserveB == 0) return 0;
        return uint256(_reserveA).mul(1e18).div(_reserveB);
    }

    function k() external view returns (uint256) {
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        return uint256(_reserveA).mul(_reserveB);
    }

    // ─── Internal ────────────────────────────────────────────
    function _updateReserves(uint256 newReserveA, uint256 newReserveB) internal {
        reserveA = uint112(newReserveA);
        reserveB = uint112(newReserveB);
        blockTimestampLast = uint32(block.timestamp);

        // Update price oracle
        if (newReserveA > 0 && newReserveB > 0) {
            uint32 timeElapsed = 1;  // at least 1 second
            priceCumulativeA += uint256(reserveB).mul(1e18).mul(timeElapsed).div(reserveA);
            priceCumulativeB += uint256(reserveA).mul(1e18).mul(timeElapsed).div(reserveB);
            priceA = uint256(reserveB).mul(1e18).div(reserveA);
            priceB = uint256(reserveA).mul(1e18).div(reserveB);
            emit PriceUpdate(priceA, priceB);
        }
    }

    // ─── Math Helpers ────────────────────────────────────────
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }
}
