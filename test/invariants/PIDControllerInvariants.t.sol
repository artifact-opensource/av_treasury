// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../contracts/av_suite/PID_Emission_Controller_v2.sol";
import "../../contracts/av_suite/AgToken.sol";
import "../../contracts/av_suite/AVLPStaking_v2.sol";

/**
 * @title PIDControllerInvariants
 * @dev Stateful invariant tests for PID_Emission_Controller_v2
 */
contract PIDControllerInvariants is Test {
    PID_Emission_Controller_v2 public pid;
    AgToken public agToken;
    AVLPStaking_v2 public staking;

    address public owner = address(0x1);
    address public attacker = address(0x3);

    uint256 public constant BASE_CAP = 11_000e18;
    uint256 public constant MAX_CAP = 50_000e18;

    function setUp() public {
        agToken = new AgToken();
        agToken.initialize(owner);
        staking = new AVLPStaking_v2();
        
        pid = new PID_Emission_Controller_v2(
            owner,            // admin
            address(staking), // staking
            address(agToken), // agToken
            1_000_000e18,    // targetTVL
            5e14,            // kp
            1e14,            // ki
            1e12             // kd
        );

        vm.startPrank(owner);
        agToken.grantRole(agToken.MINTER_ROLE(), address(pid));
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 1: Dynamic cap is within [BASE, MAX] bounds
    // ═══════════════════════════════════════════════════════════════

    function invariant_dynamicCapWithinBounds() public view {
        uint256 dynamicCap = pid.getDynamicDailyCap();
        assertGe(dynamicCap, BASE_CAP, "INVARIANT VIOLATION: dynamic cap below base");
        assertLe(dynamicCap, MAX_CAP, "INVARIANT VIOLATION: dynamic cap above max");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 2: Remaining daily emission is <= dynamic cap
    // ═══════════════════════════════════════════════════════════════

    function invariant_remainingEmissionWithinCap() public view {
        uint256 remaining = pid.remainingDailyEmission();
        uint256 dynamicCap = pid.getDynamicDailyCap();
        assertLe(remaining, dynamicCap, "INVARIANT VIOLATION: remaining emission exceeds cap");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 3: Current target TVL is nonzero
    // ═══════════════════════════════════════════════════════════════

    function invariant_currentTargetTvlValid() public view {
        uint256 target = pid.getCurrentTargetTVL();
        assertGt(target, 0, "INVARIANT VIOLATION: current target TVL is zero");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 4: Only emit role can execute emission
    // ═══════════════════════════════════════════════════════════════

    function test_onlyEmitRoleCanExecuteEmission() public {
        vm.prank(attacker);
        vm.expectRevert();
        pid.executeEmission();
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 5: Time until daily reset is within 24 hours
    // ═══════════════════════════════════════════════════════════════

    function invariant_timeUntilReset() public view {
        uint256 timeUntil = pid.timeUntilDailyReset();
        assertLe(timeUntil, 1 days, "INVARIANT VIOLATION: time until reset exceeds 24h");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 6: Gains change has cooldown
    // ═══════════════════════════════════════════════════════════════

    function invariant_gainsChangeCooldown() public view {
        uint256 timeUntil = pid.timeUntilGainsChangeExecutable();
        assertLe(timeUntil, 7 days, "INVARIANT VIOLATION: gains change cooldown exceeds 7 days");
    }

    // ═══════════════════════════════════════════════════════════════
    // Fuzz: Dynamic cap always within bounds
    // ═══════════════════════════════════════════════════════════════

    function testFuzz_dynamicCapAlwaysValid(uint256 tvlValue) public {
        vm.assume(tvlValue > 0 && tvlValue < 1e30);
        uint256 dynamicCap = pid.getDynamicDailyCap();
        assertGe(dynamicCap, BASE_CAP, "FUZZ: dynamic cap below base");
        assertLe(dynamicCap, MAX_CAP, "FUZZ: dynamic cap above max");
    }
}
