// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * MockPIDController — TVL-targeted Ag emission for sandbox
 * ═══════════════════════════════════════════════════════════════════
 *
 * Production: PID_Emission_Controller_v2.sol (936 lines)
 * Sandbox:    Simplified PID with same control logic, no multi-source TVL
 *
 * Flywheel: TVL above target → mint more Ag → stakers get more yield
 *          → more TVL → equilibrium. TVL below → reduce emission.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Interfaces.sol";

interface ITvlSource {
    function getTvl() external view returns (uint256 tvl);
}

contract MockPIDController {
    // ============ State ============
    IMintable public agToken;
    ITvlSource public tvlSource;

    // PID parameters
    int256 public kp;  // proportional gain
    int256 public ki;  // integral gain
    int256 public kd;  // derivative gain

    // PID state
    int256 public targetTvl;
    int256 public integral;
    int256 public prevError;
    uint256 public lastEmissionBlock;

    // Safety caps
    uint256 public maxDailyEmission;   // 100_000 * 1e18
    uint256 public maxSingleEmission;  // 10_000 * 1e18
    uint256 public emissionCooldown;  // blocks between emissions
    uint256 public dailyEmitted;      // tracks 24h emission
    uint256 public lastDailyReset;
    uint256 public totalEmitted;      // hard cap tracker

    // Integral windup protection
    int256 public maxIntegral;        // max integral value before clamping
    uint256 public integralDecayBps;  // decay per step (e.g., 9900 = 99%)

    // Circuit breaker
    uint256 public haltThresholdBps; // halt if TVL > this% of target (e.g., 15000 = 150%)

    // Deadband: don't emit if error is within ±this%
    uint256 public deadbandBps;  // e.g., 500 = 5%

    // ============ Events ============
    event Emission(
        address indexed emitter,
        uint256 agAmount,
        int256 error,
        uint256 currentTvl,
        uint256 targetTvl
    );

    event ParamsUpdated(string param, int256 oldValue, int256 newValue);

    // ============ Errors ============
    error ExceedsDailyCap(uint256 requested, uint256 remaining);
    error ExceedsSingleCap(uint256 requested, uint256 maxAllowed);
    error CooldownActive(uint256 remainingBlocks);
    error ZeroAddress();

    // ============ Constructor ============
    constructor(
        address _agToken,
        address _tvlSource,
        int256 _kp,
        int256 _ki,
        int256 _kd,
        int256 _targetTvl,
        uint256 _maxDailyEmission,
        uint256 _maxSingleEmission,
        uint256 _emissionCooldown,
        uint256 _deadbandBps
    ) {
        if (_agToken == address(0)) revert ZeroAddress();
        agToken = IMintable(_agToken);
        tvlSource = ITvlSource(_tvlSource);
        kp = _kp;
        ki = _ki;
        kd = _kd;
        targetTvl = _targetTvl;
        maxDailyEmission = _maxDailyEmission;
        maxSingleEmission = _maxSingleEmission;
        emissionCooldown = _emissionCooldown;
        deadbandBps = _deadbandBps;
        lastDailyReset = block.number;

        // Integral windup protection
        maxIntegral = _targetTvl > 0 ? int256(uint256(_targetTvl) / 10) : int256(0);
        integralDecayBps = 9900;  // 99% decay per step

        // Circuit breaker: halt if TVL exceeds 150% of target
        haltThresholdBps = 15000;
    }

    // ============ Core PID Logic ============

    /**
     * @notice Calculate PID output and emit Ag if TVL is below target
     * @return amount Amount of Ag minted (0 if no emission)
     */
    function tick() external returns (uint256 amount) {
        // Cooldown check
        if (block.number < lastEmissionBlock + emissionCooldown) {
            revert CooldownActive(emissionCooldown - (block.number - lastEmissionBlock));
        }

        // Reset daily cap every ~7200 blocks (≈24h)
        if (block.number > lastDailyReset + 7200) {
            dailyEmitted = 0;
            lastDailyReset = block.number;
        }

        // Get current TVL
        uint256 currentTvl = tvlSource.getTvl();
        int256 current = int256(currentTvl);
        int256 target = targetTvl;

        // Error
        int256 error = target - current;

        // Deadband check
        uint256 deadband = (uint256(target > 0 ? target : -target) * deadbandBps) / 10_000;
        if (uint256(error > 0 ? error : -error) < deadband) {
            return 0; // within deadband, no action
        }

        // Circuit breaker: halt if TVL exceeds haltThresholdBps% of target
        if (targetTvl > 0 && currentTvl > uint256(targetTvl) * haltThresholdBps / 10_000) {
            return 0;
        }

        // PID calculation with integral windup protection
        // 1. Apply integral decay (leaky integrator)
        integral = (integral * int256(integralDecayBps)) / 10_000;
        // 2. Accumulate error
        integral = integral + error;
        // 3. Clamp integral to prevent windup
        if (maxIntegral > 0) {
            if (integral > maxIntegral) {
                integral = maxIntegral;
            } else if (integral < -maxIntegral) {
                integral = -maxIntegral;
            }
        }

        int256 derivative = error - prevError;
        prevError = error;

        int256 adjustment = (kp * error) + (ki * integral) + (kd * derivative);

        // Only emit if TVL is below target (positive error = need more Ag)
        if (adjustment <= 0) {
            return 0;
        }

        amount = uint256(adjustment);

        // Apply caps
        if (amount > maxSingleEmission) {
            amount = maxSingleEmission;
        }

        uint256 dailyRemaining = maxDailyEmission - dailyEmitted;
        if (amount > dailyRemaining) {
            amount = dailyRemaining;
        }

        if (amount == 0) return 0;

        // Hard cap: total emissions never exceed 2x targetTVL
        if (targetTvl > 0) {
            uint256 cap = uint256(targetTvl) * 2;
            if (totalEmitted + amount > cap) {
                if (totalEmitted >= cap) return 0;
                amount = cap - totalEmitted;
            }
        }

        // Update state
        dailyEmitted += amount;
        totalEmitted += amount;
        lastEmissionBlock = block.number;

        // Mint Ag to this contract (caller distributes)
        agToken.mint(address(this), amount);

        emit Emission(msg.sender, amount, error, currentTvl, uint256(target));

        return amount;
    }

    // ============ Views ============

    /**
     * @notice Get current PID error (positive = TVL below target)
     */
    function getCurrentError() external view returns (int256) {
        uint256 currentTvl = tvlSource.getTvl();
        return targetTvl - int256(currentTvl);
    }

    /**
     * @notice Get remaining daily emission capacity
     */
    function remainingDailyEmission() external view returns (uint256) {
        return maxDailyEmission - dailyEmitted;
    }

    /**
     * @notice Check if emission is currently possible
     */
    function canEmit() external view returns (bool) {
        return block.number >= lastEmissionBlock + emissionCooldown;
    }

    // ============ Admin ============

    function setTarget(int256 _target) external {
        emit ParamsUpdated("targetTvl", targetTvl, _target);
        targetTvl = _target;
    }

    function setKp(int256 _kp) external {
        emit ParamsUpdated("kp", kp, _kp);
        kp = _kp;
    }

    function setKi(int256 _ki) external {
        emit ParamsUpdated("ki", ki, _ki);
        ki = _ki;
    }

    function setKd(int256 _kd) external {
        emit ParamsUpdated("kd", kd, _kd);
        kd = _kd;
    }

    function setMaxDailyEmission(uint256 _max) external {
        maxDailyEmission = _max;
    }

    function setDeadband(uint256 _bps) external {
        deadbandBps = _bps;
    }
}
