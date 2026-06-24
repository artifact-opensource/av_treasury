// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * Mock Tokens — Sandbox Deployment
 * ═══════════════════════════════════════════════════════════════════
 *
 * Mirrors the real protocol token model:
 *
 *   Au (Aurum)     — Utility token, 1B fixed supply, 9bps transfer fee
 *                   4.5bps burned, 4.5bps to feeCollector (treasury)
 *                   Deflationary, pausable, anti-whale
 *
 *   Ag (Artifact)  — Governance token, 100M fixed supply, no fees
 *                   Vote-elastic, mintable/burnable by GOVERNOR
 *                   Used for voting, staking multiplier, revenue share
 *
 * Note: Fees are tracked off-chain in the sandbox for gas efficiency.
 *       The fee logic is preserved in comments for accuracy.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ─────────────────────────────────────────────────────────────────────
// AuToken — Utility Token
// ─────────────────────────────────────────────────────────────────────

contract AuToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B
    uint256 public constant FEE_BPS = 9;                        // 9bps = 0.09%
    uint256 public constant BURN_BPS = 4;                       // 4.5bps burned
    uint256 public constant TREASURY_BPS = 4;                   // 4.5bps to treasury
    uint256 public constant MAX_TRANSFER_PERCENT = 500;         // 5% of supply
    uint256 public constant MAX_HOLDING_PERCENT = 1000;        // 10% of supply

    address public feeCollector;    // Treasury / timelock
    address public governance;      // GovernorContract

    uint256 public totalBurned;
    uint256 public totalFeesCollected;
    bool public paused;

    mapping(address => bool) public blacklisted;
    mapping(address => uint256) public lastSellTimestamp;
    uint256 public constant SELL_COOLDOWN = 1 minutes;

    event TransferFee(address indexed from, uint256 burnAmount, uint256 feeAmount);
    event Burned(uint256 amount);
    event FeeCollected(uint256 amount);

    constructor(address _feeCollector) ERC20("Aurum", "Au") Ownable(msg.sender) {
        feeCollector = _feeCollector;
        governance = msg.sender;
        // Mint initial supply to deployer (will be distributed)
        _mint(msg.sender, MAX_SUPPLY);
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "Only governance");
        governance = _governance;
    }

    function setFeeCollector(address _feeCollector) external {
        require(msg.sender == governance, "Only governance");
        feeCollector = _feeCollector;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Skip fee for mint (from == address(0)) and burn (to == address(0))
        if (from != address(0) && to != address(0)) {
            require(!blacklisted[from] && !blacklisted[to], "Blacklisted");
            require(!paused, "Paused");

            uint256 maxTransfer = (totalSupply() * MAX_TRANSFER_PERCENT) / 10000;
            require(value <= maxTransfer, "Max transfer exceeded");

            uint256 maxHolding = (totalSupply() * MAX_HOLDING_PERCENT) / 10000;
            require(balanceOf(to) + value <= maxHolding, "Max holding exceeded");

            // Calculate fee
            uint256 fee = (value * FEE_BPS) / 10000;
            uint256 burnAmount = (value * BURN_BPS) / 10000;
            uint256 feeAmount = (value * TREASURY_BPS) / 10000;

            uint256 netAmount = value - fee;

            super._update(from, to, netAmount);
            super._update(from, address(0), burnAmount);
            super._update(from, feeCollector, feeAmount);

            totalBurned += burnAmount;
            totalFeesCollected += feeAmount;

            emit TransferFee(from, burnAmount, feeAmount);
        } else {
            super._update(from, to, value);
        }
    }

    function pause() external {
        require(msg.sender == governance, "Only governance");
        paused = true;
    }

    function unpause() external {
        require(msg.sender == governance, "Only governance");
        paused = false;
    }

    function setBlacklist(address account, bool status) external {
        require(msg.sender == governance, "Only governance");
        blacklisted[account] = status;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == governance, "Only governance");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function withdrawETH() external {
        require(msg.sender == governance, "Only governance");
        payable(governance).transfer(address(this).balance);
    }

    function withdrawToken(address token) external {
        require(msg.sender == governance, "Only governance");
        IERC20(token).transfer(governance, IERC20(token).balanceOf(address(this)));
    }

    receive() external payable {}
}

// ─────────────────────────────────────────────────────────────────────
// AgToken — Governance Token
// ─────────────────────────────────────────────────────────────────────

contract AgToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M
    uint256 public constant VOTE_DURATION = 7 days;

    address public governance;      // GovernorContract
    address public pidController;   // PID emission controller

    // Vote-elastic: voting power scales with lock duration
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
    }
    mapping(address => LockInfo) public locks;

    uint256 public totalLocked;

    event LockCreated(address indexed user, uint256 amount, uint256 duration);
    event LockReleased(address indexed user, uint256 amount);

    constructor(address _governance) ERC20("Artifact Governance", "Ag") Ownable(msg.sender) {
        governance = _governance;
        // Mint initial supply to governance (will be distributed via PID)
        _mint(_governance, MAX_SUPPLY);
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "Only governance");
        governance = _governance;
    }

    function setPIDController(address _pid) external {
        require(msg.sender == governance, "Only governance");
        pidController = _pid;
    }

    function lock(uint256 amount, uint256 duration) external {
        require(amount > 0, "Zero amount");
        require(duration >= 1 days, "Min 1 day");
        require(duration <= VOTE_DURATION, "Max 7 days");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Transfer tokens to this contract
        _transfer(msg.sender, address(this), amount);

        locks[msg.sender] = LockInfo({
            amount: locks[msg.sender].amount + amount,
            unlockTime: block.timestamp + duration
        });

        totalLocked += amount;
        emit LockCreated(msg.sender, amount, duration);
    }

    function release() external {
        LockInfo storage userLock = locks[msg.sender];
        require(userLock.amount > 0, "No lock");
        require(block.timestamp >= userLock.unlockTime, "Still locked");

        uint256 amount = userLock.amount;
        totalLocked -= amount;
        locks[msg.sender] = LockInfo(0, 0);

        _transfer(address(this), msg.sender, amount);
        emit LockReleased(msg.sender, amount);
    }

    function votingPower(address user) external view returns (uint256) {
        LockInfo storage userLock = locks[user];
        if (userLock.amount == 0 || block.timestamp >= userLock.unlockTime) {
            return 0;
        }
        // Linear decay: full power at lock start, zero at unlock
        uint256 remaining = userLock.unlockTime - block.timestamp;
        return (userLock.amount * remaining) / VOTE_DURATION;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == pidController || msg.sender == governance, "Unauthorized");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        require(msg.sender == pidController || msg.sender == governance, "Unauthorized");
        _burn(msg.sender, amount);
    }
}
