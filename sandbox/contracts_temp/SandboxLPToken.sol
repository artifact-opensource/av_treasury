// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * SandboxLPToken — ERC20 LP token wrapper for DexSimulator
 * ═══════════════════════════════════════════════════════════════════
 *
 * The DexSimulator tracks LP internally. This wrapper provides an
 * ERC20 interface so MockStaking can interact with standard
 * transfer/approve/transferFrom.
 *
 * Minting is controlled by calling DexSimulator.addLiquidity().
 * Burning is controlled by calling DexSimulator.removeLiquidity().
 */



import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DexSimulator.sol";
import "./Interfaces.sol";

contract SandboxLPToken {
    IDexSimulator public dex;
    address public tokenA;
    address public tokenB;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address _dex, address _tokenA, address _tokenB) {
        dex = IDexSimulator(_dex);
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /**
     * @notice Add liquidity to DEX and mint LP tokens
     */
    function mint(uint256 amountAIn, uint256 amountBIn) external returns (uint256 lpShares) {
        // Transfer tokens to this contract first
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountAIn);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBIn);

        // Use actual balances after any transfer fees
        uint256 actualBalA = IERC20(tokenA).balanceOf(address(this));
        uint256 actualBalB = IERC20(tokenB).balanceOf(address(this));

        // Approve DEX to spend tokens (use actual balance, not requested amount)
        IERC20(tokenA).approve(address(dex), actualBalA);
        IERC20(tokenB).approve(address(dex), actualBalB);

        // Add liquidity to DEX (DEX pulls tokens from this contract)
        lpShares = dex.addLiquidity(actualBalA, actualBalB);

        // Mint LP tokens
        balanceOf[msg.sender] += lpShares;
        totalSupply += lpShares;

        emit Transfer(address(0), msg.sender, lpShares);
        return lpShares;
    }

    /**
     * @notice Add one-sided liquidity (tokenA only)
     */
    function mintOneSidedA(uint256 amountAIn) external returns (uint256 lpShares) {
        // Transfer tokens to this contract first
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountAIn);
        uint256 actualBal = IERC20(tokenA).balanceOf(address(this));
        IERC20(tokenA).approve(address(dex), actualBal);
        lpShares = dex.addOneSidedA(actualBal);

        balanceOf[msg.sender] += lpShares;
        totalSupply += lpShares;

        emit Transfer(address(0), msg.sender, lpShares);
        return lpShares;
    }

    /**
     * @notice Add one-sided liquidity (tokenB only)
     */
    function mintOneSidedB(uint256 amountBIn) external returns (uint256 lpShares) {
        // Transfer tokens to this contract first
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBIn);
        uint256 actualBal = IERC20(tokenB).balanceOf(address(this));
        IERC20(tokenB).approve(address(dex), actualBal);
        lpShares = dex.addOneSidedB(actualBal);

        balanceOf[msg.sender] += lpShares;
        totalSupply += lpShares;

        emit Transfer(address(0), msg.sender, lpShares);
        return lpShares;
    }

    /**
     * @notice Burn LP tokens and withdraw liquidity
     */
    function burn(uint256 lpShares) external returns (uint256 amountA, uint256 amountB) {
        require(balanceOf[msg.sender] >= lpShares, "Insufficient LP");
        require(lpShares > 0, "Zero shares");

        address user = msg.sender;
        balanceOf[user] -= lpShares;
        totalSupply -= lpShares;

        emit Transfer(user, address(0), lpShares);

        // Remove liquidity from DEX (tokens come back to this contract)
        if (lpShares > 0) {
            dex.removeLiquidity(lpShares);
            // Forward actual balances to user (accounts for Au transfer fee)
            uint256 agBal = IERC20(tokenA).balanceOf(address(this));
            uint256 auBal = IERC20(tokenB).balanceOf(address(this));
            if (agBal > 0) IERC20(tokenA).transfer(user, agBal);
            if (auBal > 0) IERC20(tokenB).transfer(user, auBal);
        }
    }

    // ============ Standard ERC20 ============

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        require(to != address(0), "Zero address");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        require(to != address(0), "Zero address");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);
        return true;
    }
}
