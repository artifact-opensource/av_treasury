// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * MockTreasuryAMO — Buyback engine for sandbox dual-token testing
 * ═══════════════════════════════════════════════════════════════════
 *
 * Production: TreasuryAMO.sol — uses reserveToken (ETH/USDC) to buy Au
 * Sandbox:    Uses Ag (tokenA) to buy Au (tokenB) on DexSimulator
 *
 * Flywheel: Au transfer fees → this contract → buy Au on DEX
 *          → Au price supported → stakers earn yield → more TVL
 *          → PID mints more Ag → more buyback capacity → spiral up
 */



import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DexSimulator.sol";
import "./Interfaces.sol";

contract MockTreasuryAMO {
    // ============ State ============
    IERC20 public agToken;    // Ag — used as reserve for buybacks
    IERC20 public auToken;    // Au — token to buyback
    IDexSimulator public dex;

    uint256 public cooldown;
    uint256 public lastBuybackBlock;
    uint256 public maxSlippageBps;
    uint256 public maxBuybackPerEpochBps;
    uint256 public runway;

    uint256 public totalBuybacksExecuted;
    uint256 public totalAuBought;
    uint256 public totalAgSpent;

    // ============ Events ============
    event BuybackExecuted(
        address indexed executor,
        uint256 agAmount,
        uint256 auReceived,
        uint256 blockNumber
    );

    event ParamsUpdated(string param, uint256 oldValue, uint256 newValue);

    // ============ Errors ============
    error CooldownActive(uint256 remainingBlocks);
    error ExceedsEpochCap(uint256 requested, uint256 maxAllowed);
    error BelowRunway(uint256 wouldLeave, uint256 runway);
    error SlippageExceeded(uint256 received, uint256 minimum);
    error ZeroAddress();
    error ZeroAmount();

    // ============ Constructor ============
    constructor(
        address _agToken,
        address _auToken,
        address _dex,
        uint256 _cooldownBlocks,
        uint256 _maxSlippageBps,
        uint256 _maxBuybackPerEpochBps,
        uint256 _runway
    ) {
        if (_agToken == address(0)) revert ZeroAddress();
        if (_auToken == address(0)) revert ZeroAddress();
        if (_dex == address(0)) revert ZeroAddress();

        agToken = IERC20(_agToken);
        auToken = IERC20(_auToken);
        dex = IDexSimulator(_dex);

        cooldown = _cooldownBlocks;
        maxSlippageBps = _maxSlippageBps;
        maxBuybackPerEpochBps = _maxBuybackPerEpochBps;
        runway = _runway;
        lastBuybackBlock = 0;
    }

    // ============ Core Buyback ============

    /**
     * @notice Execute buyback: spend Ag to buy Au on DEX
     * @param agAmount Amount of Ag to spend
     * @param minAuOut Minimum Au tokens to receive
     */
    function executeBuyback(
        uint256 agAmount,
        uint256 minAuOut
    ) external {
        if (agAmount == 0) revert ZeroAmount();

        // Cooldown check
        if (block.number < lastBuybackBlock + cooldown) {
            revert CooldownActive(lastBuybackBlock + cooldown - block.number);
        }

        // Epoch cap
        uint256 currentAgBalance = agToken.balanceOf(address(this));
        uint256 maxEpochAmount = (currentAgBalance * maxBuybackPerEpochBps) / 10_000;
        if (agAmount > maxEpochAmount) {
            revert ExceedsEpochCap(agAmount, maxEpochAmount);
        }

        // Runway check
        uint256 balanceAfter = currentAgBalance - agAmount;
        if (balanceAfter < runway) {
            revert BelowRunway(balanceAfter, runway);
        }

        // Estimate output
        uint256 expectedOutput = _getExpectedOutput(agAmount);
        uint256 slippageMinOut = expectedOutput - (expectedOutput * maxSlippageBps) / 10_000;
        uint256 finalMinOut = minAuOut > slippageMinOut ? minAuOut : slippageMinOut;

        // Transfer Ag from caller
        agToken.transferFrom(msg.sender, address(this), agAmount);

        // Approve DEX
        agToken.approve(address(dex), agAmount);

        // Swap Ag (tokenA) → Au (tokenB)
        uint256 auReceived = dex.swapAforB(agAmount, 0, address(this));

        // Clear approval
        agToken.approve(address(dex), 0);

        // Slippage check
        if (auReceived < finalMinOut) {
            revert SlippageExceeded(auReceived, finalMinOut);
        }

        // Update state
        lastBuybackBlock = block.number;
        totalBuybacksExecuted += 1;
        totalAuBought += auReceived;
        totalAgSpent += agAmount;

        emit BuybackExecuted(msg.sender, agAmount, auReceived, block.number);
    }

    // ============ Internal ============

    function _getExpectedOutput(uint256 agAmount) internal view returns (uint256) {
        uint256 reserveA = dex.getReserveA(); // Ag reserve
        uint256 reserveB = dex.getReserveB(); // Au reserve
        if (reserveA == 0 || reserveB == 0) return 0;
        return (agAmount * reserveB) / reserveA;
    }

    // ============ Views ============

    function canExecute() external view returns (bool) {
        return block.number >= lastBuybackBlock + cooldown;
    }

    function cooldownRemaining() external view returns (uint256) {
        if (block.number >= lastBuybackBlock + cooldown) return 0;
        return lastBuybackBlock + cooldown - block.number;
    }

    function maxBuybackAmount() external view returns (uint256) {
        uint256 currentAg = agToken.balanceOf(address(this));
        uint256 maxEpoch = (currentAg * maxBuybackPerEpochBps) / 10_000;
        uint256 excess = currentAg > runway ? currentAg - runway : 0;
        return maxEpoch < excess ? maxEpoch : excess;
    }

    // ============ Admin ============

    function setCooldown(uint256 _cooldown) external {
        emit ParamsUpdated("cooldown", cooldown, _cooldown);
        cooldown = _cooldown;
    }

    function setMaxSlippage(uint256 _bps) external {
        emit ParamsUpdated("maxSlippageBps", maxSlippageBps, _bps);
        maxSlippageBps = _bps;
    }

    function setMaxBuybackPerEpoch(uint256 _bps) external {
        emit ParamsUpdated("maxBuybackPerEpochBps", maxBuybackPerEpochBps, _bps);
        maxBuybackPerEpochBps = _bps;
    }

    function setRunway(uint256 _runway) external {
        emit ParamsUpdated("runway", runway, _runway);
        runway = _runway;
    }
}
