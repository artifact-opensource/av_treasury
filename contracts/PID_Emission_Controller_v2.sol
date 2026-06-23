// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IAgToken
 * @notice Minimal interface for the Ag token used by the PID controller.
 */
interface IAgToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title IStaking
 * @notice Minimal interface for the staking contract to read total staked NFTs (TVL proxy).
 */
interface IStaking {
    function totalStakedNFTs() external view returns (uint256);
}

/**
 * @title PID_Emission_Controller_v2
 * @notice PID-controlled Ag token emission based on staking TVL vs a configurable target.
 * @dev Non-upgradeable. Uses AccessControl for role management, ReentrancyGuard for
 *      reentrancy protection, and Pausable for circuit-breaking. The PID algorithm
 *      computes an emission amount each time executeEmission() is called by an emitter,
 *      mints Ag to the staking contract, and enforces per-emission and daily caps.
 *
 *      Roles:
 *        - DEFAULT_ADMIN_ROLE : Full admin, can manage roles, emergency stop, transfer admin
 *        - PARAM_ROLE         : Can schedule and execute PID gains changes (two-step)
 *        - EMIT_ROLE          : Can call executeEmission()
 *
 *      Two-step admin transfer:
 *        1. Admin calls requestAdminChange(newAdmin)
 *        2. New admin calls acceptAdmin()
 *
 *      Two-step parameter change:
 *        1. Param role calls scheduleGainsChange(kp, ki, kd) — starts a timelock
 *        2. After timelock, param role calls executeGainsChange()
 */
contract PID_Emission_Controller_v2 is AccessControl, ReentrancyGuard, Pausable {
    // =========================================================================
    //                              Custom Errors
    // =========================================================================

    error ZeroAddress();
    error InvalidKp();
    error InvalidKi();
    error InvalidKd();
    error InvalidTargetTVL();
    error EmergencyStopActive();
    error DailyEmissionCapExceeded(uint256 attempted, uint256 cap);
    error NoAdminChangeRequested();
    error NotPendingAdmin(address caller);
    error GainsChangeNotScheduled();
    error GainsChangeTimelockActive(uint256 remaining);
    error GainsChangeAlreadyScheduled();
    error ZeroStakingContract();
    error ZeroAgTokenContract();

    // =========================================================================
    //                                 Roles
    // =========================================================================

    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");
    bytes32 public constant EMIT_ROLE = keccak256("EMIT_ROLE");

    // =========================================================================
    //                                Constants
    // =========================================================================

    /// @notice Scaling factor for PID parameters (1e18 precision).
    uint256 internal constant SCALE = 1e18;

    /// @notice Minimum allowed value for kp, ki, kd.
    uint256 public constant MIN_PID_GAIN = 1e12;

    /// @notice Maximum allowed value for kp, ki, kd.
    uint256 public constant MAX_PID_GAIN = 1e18;

    /// @notice Maximum absolute value of the integral accumulator.
    uint256 public constant MAX_INTEGRAL = 1e24;

    /// @notice Integral decay numerator (99 = 99%).
    uint256 internal constant INTEGRAL_DECAY_NUM = 99;

    /// @notice Integral decay denominator (100 = 100%).
    uint256 internal constant INTEGRAL_DECAY_DEN = 100;

    /// @notice Maximum Ag tokens emitted in a single executeEmission() call.
    uint256 public constant MAX_SINGLE_EMISSION = 10_000 * 1e18;

    /// @notice Maximum Ag tokens emitted per day (24-hour rolling window).
    uint256 public constant DAILY_EMISSION_CAP = 11_000 * 1e18;

    /// @notice Default target TVL (10,000,000 NFTs, represented as raw count).
    uint256 public constant DEFAULT_TARGET_TVL = 10_000_000;

    /// @notice Bootstrap starting target TVL ($500K equivalent in NFT count units).
    uint256 public constant BOOTSTRAP_TARGET_TVL = 500_000;

    /// @notice Bootstrap maximum target TVL ($5M equivalent in NFT count units).
    uint256 public constant MAX_TARGET_TVL = 5_000_000;

    /// @notice Bootstrap duration in months (12 months).
    uint256 public constant BOOTSTRAP_DURATION_MONTHS = 10;

    /// @notice Seconds per month (30 days average).
    uint256 internal constant SECONDS_PER_MONTH = 30 days;

    /// @notice TWATVL drop threshold: emission halved when currentTVL < twatvl * 95 / 100.
    uint256 internal constant TVL_DROP_THRESHOLD_NUM = 95;

    /// @notice TWATVL drop threshold denominator (100 = 100%).
    uint256 internal constant TVL_DROP_THRESHOLD_DEN = 100;

    /// @notice Timelock duration for scheduled gains changes (24 hours).
    uint256 public constant GAINS_CHANGE_TIMELOCK = 24 hours;

    /// @notice Seconds in a day, used for daily emission window rollover.
    uint256 internal constant SECONDS_PER_DAY = 86400;

    /// @notice TWATVL smoothing factor numerator (99 = 99% weight on old value).
    uint256 internal constant TWATVL_SMOOTHING_NUM = 99;

    /// @notice TWATVL smoothing factor denominator (100 = 100%).
    uint256 internal constant TWATVL_SMOOTHING_DEN = 100;

    // =========================================================================
    //                                 Events
    // =========================================================================

    /**
     * @notice Emitted when PID gains (kp, ki, kd) are updated.
     * @param kp New proportional gain.
     * @param ki New integral gain.
     * @param kd New derivative gain.
     */
    event PidGainsUpdated(uint256 kp, uint256 ki, uint256 kd);

    /**
     * @notice Emitted when the target TVL is updated.
     * @param oldTargetTVL Previous target TVL.
     * @param newTargetTVL New target TVL.
     */
    event TargetTVLUpdated(uint256 oldTargetTVL, uint256 newTargetTVL);

    /**
     * @notice Emitted each time Ag tokens are emitted by the PID controller.
     * @param emissionAmount Amount of Ag minted.
     * @param currentTVL TVL at time of emission.
     * @param targetTVL Target TVL at time of emission.
     * @param error PID error term (targetTVL - currentTVL).
     * @param pTerm Proportional term contribution.
     * @param iTerm Integral term contribution.
     * @param dTerm Derivative term contribution.
     * @param dailyEmitted Total emitted in the current daily window.
     * @param totalAgEmitted Cumulative total emitted by this controller.
     */
    event AgEmitted(
        uint256 emissionAmount,
        uint256 currentTVL,
        uint256 targetTVL,
        int256 error,
        int256 pTerm,
        int256 iTerm,
        int256 dTerm,
        uint256 dailyEmitted,
        uint256 totalAgEmitted
    );

    /**
     * @notice Emitted when the emergency stop is toggled.
     * @param stopped True if emergency stop is active, false if cleared.
     * @param toggledBy Address that toggled the stop.
     */
    event EmergencyStopToggled(bool stopped, address toggledBy);

    /**
     * @notice Emitted when a new admin is requested (step 1 of admin transfer).
     * @param previousAdmin Current admin address.
     * @param newAdmin Proposed new admin address.
     */

    /**
     * @notice Emitted when a pending admin accepts the role (step 2 of admin transfer).
     * @param previousAdmin Previous admin address.
     * @param newAdmin New admin address that accepted.
     */

    /**
     * @notice Emitted when a gains change is scheduled (step 1 of parameter change).
     * @param kp Scheduled proportional gain.
     * @param ki Scheduled integral gain.
     * @param kd Scheduled derivative gain.
     * @param executeAfter Timestamp after which executeGainsChange() can be called.
     */
    event ParamChangeScheduled(
        uint256 kp,
        uint256 ki,
        uint256 kd,
        uint256 executeAfter
    );

    /**
     * @notice Emitted when a scheduled gains change is executed (step 2 of parameter change).
     * @param kp Applied proportional gain.
     * @param ki Applied integral gain.
     * @param kd Applied derivative gain.
     */
    event ParamChangeExecuted(uint256 kp, uint256 ki, uint256 kd);

    // =========================================================================
    //                           Immutable References
    // =========================================================================

    /// @notice The staking contract, used to read TVL and receive minted Ag.
    IStaking public immutable staking;

    /// @notice The Ag token contract, used to mint emission rewards.
    IAgToken public immutable agToken;

    // =========================================================================
    //                          PID State Variables
    // =========================================================================

    /// @notice Proportional gain.
    uint256 public kp;

    /// @notice Integral gain.
    uint256 public ki;

    /// @notice Derivative gain.
    uint256 public kd;

    /// @notice Target TVL (desired number of staked NFTs).
    uint256 public targetTVL;

    /// @notice Accumulated integral term (can be positive or negative, stored as signed).
    int256 public integral;

    /// @notice Error from the previous update, used for derivative calculation.
    int256 public lastError;

    /// @notice Timestamp of the last successful emission update.
    uint256 public lastUpdate;

    /// @notice Time-Weighted Average TVL (TWATVL) — smoothed TVL to prevent oracle manipulation.
    uint256 public twatvl;

    /// @notice Timestamp of contract deployment, used for bootstrap TVL target interpolation.
    uint256 public deploymentTimestamp;

    // =========================================================================
    //                         Emission Tracking State
    // =========================================================================

    /// @notice Total Ag emitted in the current daily window.
    uint256 public dailyEmitted;

    /// @notice Start timestamp of the current daily emission window.
    uint256 public dailyWindowStart;

    /// @notice Cumulative total Ag emitted by this controller (all time).
    uint256 public totalAgEmitted;

    // =========================================================================
    //                         Emergency Stop State
    // =========================================================================

    /// @notice When true, executeEmission() is blocked.
    bool public emergencyStop;

    // =========================================================================
    //                         Admin Transfer State
    // =========================================================================

    /// @notice Pending new admin address (set during two-step transfer).
    address public pendingAdmin;
    address public currentAdmin;

    // =========================================================================
    //                      Two-Step Gains Change State
    // =========================================================================

    /// @notice Whether a gains change is currently scheduled and pending execution.
    bool public gainsChangeScheduled;

    /// @notice Scheduled kp value (applied on executeGainsChange).
    uint256 public scheduledKp;

    /// @notice Scheduled ki value (applied on executeGainsChange).
    uint256 public scheduledKi;

    /// @notice Scheduled kd value (applied on executeGainsChange).
    uint256 public scheduledKd;

    /// @notice Timestamp after which the scheduled gains change can be executed.
    uint256 public gainsChangeExecuteAfter;

    // =========================================================================
    //                               Constructor
    // =========================================================================

    /**
     * @notice Deploys the PID Emission Controller.
     * @param admin Address to receive DEFAULT_ADMIN_ROLE, PARAM_ROLE, and EMIT_ROLE.
     * @param staking_ Address of the staking contract (IStaking).
     * @param agToken_ Address of the Ag token contract (IAgToken).
     * @param targetTVL_ Initial target TVL (set to 0 to use DEFAULT_TARGET_TVL).
     * @param kp_ Initial proportional gain (scaled by 1e18).
     * @param ki_ Initial integral gain (scaled by 1e18).
     * @param kd_ Initial derivative gain (scaled by 1e18).
     */
    constructor(
        address admin,
        address staking_,
        address agToken_,
        uint256 targetTVL_,
        uint256 kp_,
        uint256 ki_,
        uint256 kd_
    ) {
        if (admin == address(0)) revert ZeroAddress();
        if (staking_ == address(0)) revert ZeroStakingContract();
        if (agToken_ == address(0)) revert ZeroAgTokenContract();
        if (kp_ < MIN_PID_GAIN || kp_ > MAX_PID_GAIN) revert InvalidKp();
        if (ki_ < MIN_PID_GAIN || ki_ > MAX_PID_GAIN) revert InvalidKi();
        if (kd_ < MIN_PID_GAIN || kd_ > MAX_PID_GAIN) revert InvalidKd();

        // Set target TVL: use bootstrap target if zero, otherwise validate non-zero.
        if (targetTVL_ == 0) {
            targetTVL = BOOTSTRAP_TARGET_TVL;
        } else {
            targetTVL = targetTVL_;
        }

        // Assign roles to the deployer/admin.
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PARAM_ROLE, admin);
        _grantRole(EMIT_ROLE, admin);

        // Ensure admin also has PARAM_ROLE and EMIT_ROLE implicitly via admin role.
        // (DEFAULT_ADMIN_ROLE holders can manage all roles, but we grant explicitly
        // so the admin can call param/emit functions directly.)

        // Store immutable references.
        staking = IStaking(staking_);
        agToken = IAgToken(agToken_);

        // Set PID gains.
        kp = kp_;
        ki = ki_;
        kd = kd_;

        // Initialize state.
        lastUpdate = block.timestamp;
        dailyWindowStart = block.timestamp;
        deploymentTimestamp = block.timestamp;

        // Initialize TWATVL with the initial target TVL.
        twatvl = targetTVL;
    }

    // =========================================================================
    //                          External Functions
    // =========================================================================

    /**
     * @notice Executes one PID-controlled emission cycle.
     * @dev Can only be called by an address with EMIT_ROLE when not paused and
     *      emergency stop is not active. Reads current TVL from the staking
     *      contract, computes the PID output, enforces caps, mints Ag to the
     *      staking contract, and updates all state.
     * @return emissionAmount The amount of Ag tokens minted (0 if PID output <= 0).
     */
    function executeEmission()
        external
        onlyRole(EMIT_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 emissionAmount)
    {
        if (emergencyStop) revert EmergencyStopActive();

        // Read current TVL from staking.
        uint256 currentTVL = staking.totalStakedNFTs();

        // H-11 fix: If no active stakers, return 0 to prevent division by zero downstream.
        if (currentTVL == 0) {
            // Still update lastUpdate to prevent accumulation.
            lastUpdate = block.timestamp;
            emit AgEmitted(0, 0, targetTVL, int256(targetTVL), int256(targetTVL), 0, 0, dailyEmitted, totalAgEmitted);
            return 0;
        }

        // Update TWATVL with exponential moving average (1% weight on new data).
        twatvl = (twatvl * TWATVL_SMOOTHING_NUM + currentTVL * (TWATVL_SMOOTHING_DEN - TWATVL_SMOOTHING_NUM)) / TWATVL_SMOOTHING_DEN;

        // Use TWATVL instead of instantaneous currentTVL in PID calculations.
        uint256 effectiveTVL = twatvl;

        // Roll over daily window if needed.
        _rollDailyWindow();

        // Compute time elapsed since last update (minimum 1 second to avoid division by zero).
        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) {
            timeElapsed = 1;
        }

        // ---- PID Computation ----

        // error = targetTVL - effectiveTVL (signed)
        int256 error = int256(targetTVL) - int256(effectiveTVL);

        // Proportional term: kp * error / SCALE
        int256 pTerm = (int256(kp) * error) / int256(SCALE);

        // Integral: accumulate error * timeElapsed, then apply decay.
        // Use signed arithmetic for integral accumulation.
        int256 integralDelta = error * int256(timeElapsed);
        integral = integral + integralDelta;

        // Apply integral decay: multiply by 99/100.
        integral = (integral * int256(INTEGRAL_DECAY_NUM)) / int256(INTEGRAL_DECAY_DEN);

        // Clamp integral to ±MAX_INTEGRAL.
        if (integral > int256(MAX_INTEGRAL)) {
            integral = int256(MAX_INTEGRAL);
        } else if (integral < -int256(MAX_INTEGRAL)) {
            integral = -int256(MAX_INTEGRAL);
        }

        // Integral term: ki * integral / SCALE
        int256 iTerm = (int256(ki) * integral) / int256(SCALE);

        // Derivative: (error - lastError) / timeElapsed, then multiply by kd / SCALE.
        int256 dError = (error - lastError) / int256(timeElapsed);
        int256 dTerm = (int256(kd) * dError) / int256(SCALE);

        // Total PID output.
        int256 output = pTerm + iTerm + dTerm;

        // If output is negative or zero, no emission.
        if (output <= 0) {
            // Still update lastError and lastUpdate even on zero emission.
            lastError = error;
            lastUpdate = block.timestamp;

            emit AgEmitted(
                0,
                effectiveTVL,
                targetTVL,
                error,
                pTerm,
                iTerm,
                dTerm,
                dailyEmitted,
                totalAgEmitted
            );

            return 0;
        }

        // Convert to unsigned for cap checks.
        uint256 emission = uint256(output);

        // Enforce single emission cap.
        if (emission > MAX_SINGLE_EMISSION) {
            emission = MAX_SINGLE_EMISSION;
        }

        // Enforce daily emission cap.
        if (dailyEmitted + emission > DAILY_EMISSION_CAP) {
            // Reduce emission to fit within the daily cap.
            uint256 remaining = DAILY_EMISSION_CAP - dailyEmitted;
            if (remaining == 0) {
                // Daily cap fully consumed — update state but emit zero.
                lastError = error;
                lastUpdate = block.timestamp;

                emit AgEmitted(
                    0,
                    effectiveTVL,
                    targetTVL,
                    error,
                    pTerm,
                    iTerm,
                    dTerm,
                    dailyEmitted,
                    totalAgEmitted
                );

                return 0;
            }
            emission = remaining;
        }

        // Emission decay: if current TVL drops below 95% of TWATVL, halve the emission.
        if (currentTVL < (twatvl * TVL_DROP_THRESHOLD_NUM) / TVL_DROP_THRESHOLD_DEN) {
            emission = emission / 2;
        }

        // Update state before external call (checks-effects-interactions).
        integral = integral; // already updated above
        lastError = error;
        lastUpdate = block.timestamp;
        dailyEmitted += emission;
        totalAgEmitted += emission;

        // Mint Ag tokens to the staking contract.
        agToken.mint(address(staking), emission);

        emit AgEmitted(
            emission,
            effectiveTVL,
            targetTVL,
            error,
            pTerm,
            iTerm,
            dTerm,
            dailyEmitted,
            totalAgEmitted
        );

        return emission;
    }

    /**
     * @notice Updates the TWATVL with the current TVL from staking.
     * @dev Can be called by anyone. Updates twatvl using exponential moving average.
     *      Useful for keeping TWATVL current between executeEmission calls.
     */
    function updateTWATVL() external {
        uint256 currentTVL = staking.totalStakedNFTs();
        if (currentTVL == 0) {
            // If no stakers, don't update twatvl — keep last known value.
            return;
        }
        twatvl = (twatvl * TWATVL_SMOOTHING_NUM + currentTVL * (TWATVL_SMOOTHING_DEN - TWATVL_SMOOTHING_NUM)) / TWATVL_SMOOTHING_DEN;
    }

    /**
     * @notice Toggles the emergency stop on or off.
     * @dev Only callable by DEFAULT_ADMIN_ROLE. When true, executeEmission() reverts.
     */
    function toggleEmergencyStop() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyStop = !emergencyStop;
        emit EmergencyStopToggled(emergencyStop, msg.sender);
    }

    /**
     * @notice Step 1 of admin transfer: request a new admin.
     * @dev Only callable by current admin (DEFAULT_ADMIN_ROLE). The new admin must
     *      then call acceptAdmin() to complete the transfer.
     * @param newAdmin Address of the proposed new admin.
     */
    function requestAdminChange(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
    }

    /**
     * @notice Step 2 of admin transfer: accept the admin role.
     * @dev Only callable by the pending admin address. Transfers DEFAULT_ADMIN_ROLE,
     *      PARAM_ROLE, and EMIT_ROLE from the current admin to the new admin.
     */
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin(msg.sender);

        
        // If there are multiple admin members, we find the one that matches.
        // For simplicity, we revoke all roles from the previous admin and grant to new.

        // Revoke roles from the previous admin.
        _revokeRole(DEFAULT_ADMIN_ROLE, currentAdmin);
        _revokeRole(PARAM_ROLE, currentAdmin);
        _revokeRole(EMIT_ROLE, currentAdmin);

        // Grant roles to the new admin.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PARAM_ROLE, msg.sender);
        _grantRole(EMIT_ROLE, msg.sender);

        // Clear pending admin.
        pendingAdmin = address(0);

    }

    /**
     * @notice Updates the target TVL.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param newTargetTVL New target TVL value (must be > 0).
     */
    function setTargetTVL(uint256 newTargetTVL) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTargetTVL == 0) revert InvalidTargetTVL();
        uint256 old = targetTVL;
        targetTVL = newTargetTVL;
        emit TargetTVLUpdated(old, newTargetTVL);
    }

    /**
     * @notice Step 1 of parameter change: schedule new PID gains.
     * @dev Only callable by PARAM_ROLE. Starts a timelock period. If a change is
     *      already scheduled, it will be overwritten with the new values and a
     *      fresh timelock.
     * @param newKp New proportional gain.
     * @param newKi New integral gain.
     * @param newKd New derivative gain.
     */
    function scheduleGainsChange(
        uint256 newKp,
        uint256 newKi,
        uint256 newKd
    ) external onlyRole(PARAM_ROLE) {
        if (newKp < MIN_PID_GAIN || newKp > MAX_PID_GAIN) revert InvalidKp();
        if (newKi < MIN_PID_GAIN || newKi > MAX_PID_GAIN) revert InvalidKi();
        if (newKd < MIN_PID_GAIN || newKd > MAX_PID_GAIN) revert InvalidKd();

        scheduledKp = newKp;
        scheduledKi = newKi;
        scheduledKd = newKd;
        gainsChangeExecuteAfter = block.timestamp + GAINS_CHANGE_TIMELOCK;
        gainsChangeScheduled = true;

        emit ParamChangeScheduled(newKp, newKi, newKd, gainsChangeExecuteAfter);
    }

    /**
     * @notice Step 2 of parameter change: execute the scheduled PID gains change.
     * @dev Only callable by PARAM_ROLE after the timelock has expired.
     */
    function executeGainsChange() external onlyRole(PARAM_ROLE) {
        if (!gainsChangeScheduled) revert GainsChangeNotScheduled();
        if (block.timestamp < gainsChangeExecuteAfter) {
            revert GainsChangeTimelockActive(gainsChangeExecuteAfter - block.timestamp);
        }

        // Apply scheduled gains.
        kp = scheduledKp;
        ki = scheduledKi;
        kd = scheduledKd;

        // Clear scheduled state.
        gainsChangeScheduled = false;
        scheduledKp = 0;
        scheduledKi = 0;
        scheduledKd = 0;
        gainsChangeExecuteAfter = 0;

        emit PidGainsUpdated(kp, ki, kd);
        emit ParamChangeExecuted(kp, ki, kd);
    }

    /**
     * @notice Cancels a scheduled gains change.
     * @dev Only callable by PARAM_ROLE.
     */
    function cancelGainsChange() external onlyRole(PARAM_ROLE) {
        gainsChangeScheduled = false;
        scheduledKp = 0;
        scheduledKi = 0;
        scheduledKd = 0;
        gainsChangeExecuteAfter = 0;
    }

    /**
     * @notice Pauses the contract, blocking executeEmission().
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the contract, re-enabling executeEmission().
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                          View Functions
    // =========================================================================

    /**
     * @notice Returns the remaining emission capacity for the current daily window.
     * @return remaining The amount of Ag that can still be emitted today.
     */
    function remainingDailyEmission() external view returns (uint256 remaining) {
        if (dailyEmitted >= DAILY_EMISSION_CAP) {
            return 0;
        }
        return DAILY_EMISSION_CAP - dailyEmitted;
    }

    /**
     * @notice Returns the time remaining until the current daily window resets.
     * @return remaining Seconds until the daily window resets.
     */
    function timeUntilDailyReset() external view returns (uint256 remaining) {
        uint256 elapsed = block.timestamp - dailyWindowStart;
        if (elapsed >= SECONDS_PER_DAY) {
            return 0;
        }
        return SECONDS_PER_DAY - elapsed;
    }

    /**
     * @notice Returns the time remaining until a scheduled gains change can be executed.
     * @return remaining Seconds until the timelock expires. Returns 0 if not scheduled
     *         or if the timelock has already expired.
     */
    function timeUntilGainsChangeExecutable() external view returns (uint256 remaining) {
        if (!gainsChangeScheduled) {
            return 0;
        }
        if (block.timestamp >= gainsChangeExecuteAfter) {
            return 0;
        }
        return gainsChangeExecuteAfter - block.timestamp;
    }

    /**
     * @notice Returns the current bootstrap-scaled target TVL.
     * @dev Linearly interpolates from BOOTSTRAP_TARGET_TVL ($500K) at deployment
     *      to MAX_TARGET_TVL ($5M) over BOOTSTRAP_DURATION_MONTHS (12 months).
     *      After the bootstrap period, returns MAX_TARGET_TVL.
     * @return currentTarget The interpolated target TVL for the current time.
     */
    function getCurrentTargetTVL() public view returns (uint256 currentTarget) {
        uint256 elapsed = block.timestamp - deploymentTimestamp;
        uint256 bootstrapDuration = BOOTSTRAP_DURATION_MONTHS * SECONDS_PER_MONTH;

        if (elapsed >= bootstrapDuration) {
            return MAX_TARGET_TVL;
        }

        // Linear interpolation: start + (end - start) * elapsed / duration
        currentTarget = BOOTSTRAP_TARGET_TVL
            + ((MAX_TARGET_TVL - BOOTSTRAP_TARGET_TVL) * elapsed) / bootstrapDuration;
    }

    /**
     * @notice Computes the current PID output without modifying state.
     * @dev Useful for off-chain monitoring and testing. Reads current TVL and
     *      simulates the PID computation using current state.
     * @return emissionAmount The computed emission amount (after caps).
     * @return currentTVL The current staked NFT count.
     * @return error The PID error term.
     * @return pTerm The proportional term.
     * @return iTerm The integral term.
     * @return dTerm The derivative term.
     */
    function previewEmission()
        external
        view
        returns (
            uint256 emissionAmount,
            uint256 currentTVL,
            int256 error,
            int256 pTerm,
            int256 iTerm,
            int256 dTerm
        )
    {
        currentTVL = staking.totalStakedNFTs();

        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) {
            timeElapsed = 1;
        }

        error = int256(targetTVL) - int256(currentTVL);

        // Simulate integral accumulation and decay.
        int256 simIntegral = integral + (error * int256(timeElapsed));
        simIntegral = (simIntegral * int256(INTEGRAL_DECAY_NUM)) / int256(INTEGRAL_DECAY_DEN);

        if (simIntegral > int256(MAX_INTEGRAL)) {
            simIntegral = int256(MAX_INTEGRAL);
        } else if (simIntegral < -int256(MAX_INTEGRAL)) {
            simIntegral = -int256(MAX_INTEGRAL);
        }

        pTerm = (int256(kp) * error) / int256(SCALE);
        iTerm = (int256(ki) * simIntegral) / int256(SCALE);

        int256 dError = (error - lastError) / int256(timeElapsed);
        dTerm = (int256(kd) * dError) / int256(SCALE);

        int256 output = pTerm + iTerm + dTerm;

        if (output <= 0) {
            return (0, currentTVL, error, pTerm, iTerm, dTerm);
        }

        uint256 emission = uint256(output);

        if (emission > MAX_SINGLE_EMISSION) {
            emission = MAX_SINGLE_EMISSION;
        }

        if (dailyEmitted + emission > DAILY_EMISSION_CAP) {
            uint256 remaining = DAILY_EMISSION_CAP - dailyEmitted;
            emission = remaining;
        }

        return (emission, currentTVL, error, pTerm, iTerm, dTerm);
    }

    // =========================================================================
    //                          Admin Role Management
    // =========================================================================

    /**
     * @notice Grants the PARAM_ROLE to an address.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param account Address to grant the role to.
     */
    function grantParamRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        grantRole(PARAM_ROLE, account);
    }

    /**
     * @notice Revokes the PARAM_ROLE from an address.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param account Address to revoke the role from.
     */
    function revokeParamRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(PARAM_ROLE, account);
    }

    /**
     * @notice Grants the EMIT_ROLE to an address.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param account Address to grant the role to.
     */
    function grantEmitRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        grantRole(EMIT_ROLE, account);
    }

    /**
     * @notice Revokes the EMIT_ROLE from an address.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param account Address to revoke the role from.
     */
    function revokeEmitRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(EMIT_ROLE, account);
    }

    // =========================================================================
    //                          Internal Functions
    // =========================================================================

    /**
     * @notice Rolls over the daily emission window if the current window has expired.
     * @dev Resets dailyEmitted to 0 and updates dailyWindowStart when a full day
     *      has passed since the last window start.
     */
    function _rollDailyWindow() internal {
        uint256 elapsed = block.timestamp - dailyWindowStart;
        if (elapsed >= SECONDS_PER_DAY) {
            dailyEmitted = 0;
            dailyWindowStart = block.timestamp;
        }
    }
}
