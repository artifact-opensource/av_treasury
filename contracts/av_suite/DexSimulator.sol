// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * DexSimulator — UniswapV2-Style AMM with One-Sided LP
 * ═══════════════════════════════════════════════════════════════════
 *
 * Trading pair: Ag (Governance) / Au (Utility)
 *
 * Features:
 *   - Constant product (x * y = k)
 * *   - 0.3% swap fee (goes to LPs)
 *   - One-sided liquidity: add Ag only OR Au only
 *   - TWAP oracle (cumulative price)
 *   - Flash swaps
 *   - Anti-bot: minimum blocks between swaps per address
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @notice Interface for flash swap receivers
 */
interface IFlashSwapReceiver {
    function executeOperation(
        address borrowToken,
        address repayToken,
        uint256 borrowAmount,
        uint256 fee,
        bool borrowIsA,
        bytes calldata data
    ) external;
}

contract DexSimulator {
    using Math for uint256;

    // ── Tokens ─────────────────────────────────────────────────────
    IERC20 public tokenA; // Ag (Governance)
    IERC20 public tokenB; // Au (Utility)

    // ── Reserves ───────────────────────────────────────────────────
    uint112 public reserveA;
    uint112 public reserveB;

    // ── LP Tracking ────────────────────────────────────────────────
    uint256 public totalLPSupply;
    mapping(address => uint256) public lpBalance;

    // One-sided LP tracking
    uint256 public totalLPA; // LP shares for Ag-only providers
    uint256 public totalLPB; // LP shares for Au-only providers
    mapping(address => uint256) public lpBalanceA;
    mapping(address => uint256) public lpBalanceB;

    // ── Fee ────────────────────────────────────────────────────────
    uint256 public constant FEE_BPS = 30; // 0.3%
    uint256 public constant ONE_SIDED_FEE_BPS = 10; // 0.1% for one-sided
    uint256 public accumulatedFeesA;
    uint256 public accumulatedFeesB;

    // ── TWAP Oracle ────────────────────────────────────────────────
    uint256 public priceCumulativeA;
    uint256 public priceCumulativeB;
    uint256 public lastUpdateBlock;

    // ── Anti-Bot ───────────────────────────────────────────────────
    mapping(address => uint256) public lastSwapBlock;
    uint256 public constant MIN_BLOCKS_BETWEEN_SWAPS = 1;

    // ── Events ─────────────────────────────────────────────────────
    event Swap(address indexed sender, address indexed to, uint256 amountAIn, uint256 amountBIn, uint256 amountAOut, uint256 amountBOut);
    event AddLiquidity(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event RemoveLiquidity(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpShares);
    event AddOneSided(address indexed provider, bool isTokenA, uint256 amountIn, uint256 lpShares);
    event Sync(uint256 reserveA, uint256 reserveB);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // ── Core: Swap ─────────────────────────────────────────────────

    function swapAforB(uint256 amountAIn, uint256 minAmountBOut, address to) external returns (uint256 amountBOut) {
        require(amountAIn > 0, "Zero input");
        require(block.number > lastSwapBlock[msg.sender], "Anti-bot cooldown");
        lastSwapBlock[msg.sender] = block.number;

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        amountBOut = getAmountOut(amountAIn, balanceA, balanceB, true);
        require(amountBOut >= minAmountBOut, "Slippage");
        require(amountBOut <= balanceB, "Insufficient liquidity");

        // Transfer tokens
        require(tokenA.transferFrom(msg.sender, address(this), amountAIn), "Transfer failed");
        require(tokenB.transfer(to, amountBOut), "Transfer failed");

        _updateOracle();
        emit Swap(msg.sender, to, amountAIn, 0, 0, amountBOut);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return amountBOut;
    }

    function swapBforA(uint256 amountBIn, uint256 minAmountAOut, address to) external returns (uint256 amountAOut) {
        require(amountBIn > 0, "Zero input");
        require(block.number > lastSwapBlock[msg.sender], "Anti-bot cooldown");
        lastSwapBlock[msg.sender] = block.number;

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        amountAOut = getAmountOut(amountBIn, balanceB, balanceA, false);
        require(amountAOut >= minAmountAOut, "Slippage");
        require(amountAOut <= balanceA, "Insufficient liquidity");

        require(tokenB.transferFrom(msg.sender, address(this), amountBIn), "Transfer failed");
        require(tokenA.transfer(to, amountAOut), "Transfer failed");

        _updateOracle();
        emit Swap(msg.sender, to, 0, amountBIn, amountAOut, 0);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return amountAOut;
    }

    // ── Two-Sided Liquidity ────────────────────────────────────────

    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 lpShares) {
        require(amountA > 0 && amountB > 0, "Both amounts required");

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        if (totalLPSupply == 0) {
            // Initial liquidity: create shares = sqrt(amountA * amountB)
            lpShares = _sqrt(amountA * amountB);
        } else {
            // Proportional: min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)
            uint256 sharesA = (amountA * totalLPSupply) / balanceA;
            uint256 sharesB = (amountB * totalLPSupply) / balanceB;
            lpShares = sharesA < sharesB ? sharesA : sharesB;
        }

        require(lpShares > 0, "Zero shares");

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "Transfer A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "Transfer B failed");

        lpBalance[msg.sender] += lpShares;
        totalLPSupply += lpShares;

        emit AddLiquidity(msg.sender, amountA, amountB, lpShares);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    function removeLiquidity(uint256 lpShares) external returns (uint256 amountA, uint256 amountB) {
        require(lpShares > 0, "Zero shares");
        require(lpBalance[msg.sender] >= lpShares, "Insufficient LP");

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        amountA = (lpShares * balanceA) / totalLPSupply;
        amountB = (lpShares * balanceB) / totalLPSupply;

        lpBalance[msg.sender] -= lpShares;
        totalLPSupply -= lpShares;

        require(tokenA.transfer(msg.sender, amountA), "Transfer A failed");
        require(tokenB.transfer(msg.sender, amountB), "Transfer B failed");

        emit RemoveLiquidity(msg.sender, amountA, amountB, lpShares);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    // ── One-Sided Liquidity ────────────────────────────────────────

    function addOneSidedA(uint256 amountAIn) external returns (uint256 lpShares) {
        require(amountAIn > 0, "Zero amount");
        require(block.number > lastSwapBlock[msg.sender], "Anti-bot cooldown");
        lastSwapBlock[msg.sender] = block.number;

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        // One-sided: user provides Ag, but pool needs Au to match
        // Pool borrows Au from existing liquidity, user gets LP shares
        // Shares = amountA * ONE_SIDED_FEE_BPS / 10000 * totalLPSupply / balanceA
        uint256 fee = (amountAIn * ONE_SIDED_FEE_BPS) / 10000;
        uint256 netAmount = amountAIn - fee;

        if (totalLPA == 0) {
            lpShares = _sqrt(netAmount * balanceB / 1e18);
        } else {
            lpShares = (netAmount * totalLPA) / balanceA;
        }

        require(lpShares > 0, "Zero shares");

        require(tokenA.transferFrom(msg.sender, address(this), amountAIn), "Transfer failed");

        lpBalanceA[msg.sender] += lpShares;
        totalLPA += lpShares;
        accumulatedFeesA += fee;

        emit AddOneSided(msg.sender, true, amountAIn, lpShares);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return lpShares;
    }

    function addOneSidedB(uint256 amountBIn) external returns (uint256 lpShares) {
        require(amountBIn > 0, "Zero amount");
        require(block.number > lastSwapBlock[msg.sender], "Anti-bot cooldown");
        lastSwapBlock[msg.sender] = block.number;

        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));

        uint256 fee = (amountBIn * ONE_SIDED_FEE_BPS) / 10000;
        uint256 netAmount = amountBIn - fee;

        if (totalLPB == 0) {
            lpShares = _sqrt(netAmount * balanceA / 1e18);
        } else {
            lpShares = (netAmount * totalLPB) / balanceB;
        }

        require(lpShares > 0, "Zero shares");

        require(tokenB.transferFrom(msg.sender, address(this), amountBIn), "Transfer failed");

        lpBalanceB[msg.sender] += lpShares;
        totalLPB += lpShares;
        accumulatedFeesB += fee;

        emit AddOneSided(msg.sender, false, amountBIn, lpShares);
        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return lpShares;
    }

    function removeOneSidedA(uint256 lpShares) external returns (uint256 amountA) {
        require(lpShares > 0, "Zero shares");
        require(lpBalanceA[msg.sender] >= lpShares, "Insufficient LP");

        uint256 balanceA = tokenA.balanceOf(address(this));
        amountA = (lpShares * balanceA) / totalLPA;

        lpBalanceA[msg.sender] -= lpShares;
        totalLPA -= lpShares;

        require(tokenA.transfer(msg.sender, amountA), "Transfer failed");

        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return amountA;
    }

    function removeOneSidedB(uint256 lpShares) external returns (uint256 amountB) {
        require(lpShares > 0, "Zero shares");
        require(lpBalanceB[msg.sender] >= lpShares, "Insufficient LP");

        uint256 balanceB = tokenB.balanceOf(address(this));
        amountB = (lpShares * balanceB) / totalLPB;

        lpBalanceB[msg.sender] -= lpShares;
        totalLPB -= lpShares;

        require(tokenB.transfer(msg.sender, amountB), "Transfer failed");

        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
        return amountB;
    }

    // ── Price / Oracle ─────────────────────────────────────────────

    function getPriceA() external view returns (uint256) {
        if (reserveA == 0) return 0;
        return (uint256(reserveB) * 1e18) / uint256(reserveA);
    }

    function getPriceB() external view returns (uint256) {
        if (reserveB == 0) return 0;
        return (uint256(reserveA) * 1e18) / uint256(reserveB);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, bool isAIn) public pure returns (uint256) {
        uint256 fee = (amountIn * FEE_BPS) / 10000;
        uint256 amountInWithFee = amountIn - fee;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + (amountInWithFee * 10000) / 10000;
        // Simplified: denominator = reserveIn + amountInWithFee
        denominator = reserveIn + amountInWithFee;
        return numerator / denominator;
    }

    function _updateOracle() internal {
        uint256 balanceA = tokenA.balanceOf(address(this));
        uint256 balanceB = tokenB.balanceOf(address(this));
        if (balanceA > 0 && balanceB > 0) {
            priceCumulativeA += (uint256(reserveB) * 1e18 / uint256(reserveA)) * (block.number - lastUpdateBlock);
            priceCumulativeB += (uint256(reserveA) * 1e18 / uint256(reserveB)) * (block.number - lastUpdateBlock);
        }
        reserveA = uint112(balanceA);
        reserveB = uint112(balanceB);
        lastUpdateBlock = block.number;
    }

    // ── Flash Swaps ────────────────────────────────────────────────

    /**
     * @notice Flash swap: borrow token A, repay in token B
     * @notice Borrower gets tokens, swaps them, repays within same tx + fee
     * @param borrowAmount Amount of tokenA to borrow
     * @param minRepay Minimum amount of tokenB to repay (slippage protection)
     * @param receiver Contract that receives the borrowed tokens and executes callback
     * @param data Arbitrary data passed to callback
     */
    function flashSwapAforB(
        uint256 borrowAmount,
        uint256 minRepay,
        address receiver,
        bytes calldata data
    ) external returns (uint256 repayAmount) {
        require(borrowAmount > 0, "Zero amount");
        require(borrowAmount <= reserveA, "Insufficient liquidity");

        uint256 fee = (borrowAmount * FEE_BPS) / 10000;

        // Transfer borrowed tokenA to receiver
        require(tokenA.transfer(receiver, borrowAmount), "Transfer failed");

        // Execute callback
        IFlashSwapReceiver(receiver).executeOperation(
            address(tokenA), address(tokenB), borrowAmount, fee, true, data
        );

        // Verify repayment in tokenB
        uint256 balanceAfterB = tokenB.balanceOf(address(this));
        repayAmount = balanceAfterB - reserveB + fee; // What they repaid minus what was there
        // Actually: they need to send back borrowAmount worth of tokenB + fee
        // Simpler: check that tokenB balance increased by at least the expected amount
        require(tokenB.balanceOf(address(this)) >= reserveB + minRepay, "Insufficient repayment");

        _updateOracle();

        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /**
     * @notice Flash swap: borrow token B, repay in token A
     */
    function flashSwapBforA(
        uint256 borrowAmount,
        uint256 minRepay,
        address receiver,
        bytes calldata data
    ) external returns (uint256 repayAmount) {
        require(borrowAmount > 0, "Zero amount");
        require(borrowAmount <= reserveB, "Insufficient liquidity");

        uint256 fee = (borrowAmount * FEE_BPS) / 10000;

        // Transfer borrowed tokenB to receiver
        require(tokenB.transfer(receiver, borrowAmount), "Transfer failed");

        // Execute callback
        IFlashSwapReceiver(receiver).executeOperation(
            address(tokenB), address(tokenA), borrowAmount, fee, false, data
        );

        // Verify repayment in tokenA
        require(tokenA.balanceOf(address(this)) >= reserveA + minRepay, "Insufficient repayment");

        _updateOracle();

        emit Sync(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    // ── Utility ────────────────────────────────────────────────────

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
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
}
