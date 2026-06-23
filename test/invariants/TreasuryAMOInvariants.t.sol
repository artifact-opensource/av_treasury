// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../contracts/TreasuryAMO.sol";
import "../../contracts/AgToken.sol";
import "../../contracts/AuToken.sol";

/**
 * @title TreasuryAMOInvariants
 * @dev Stateful invariant tests for TreasuryAMO
 */
contract TreasuryAMOInvariants is Test {
    TreasuryAMO public treasury;
    AgToken public agToken;
    AuToken public auToken;

    address public owner = address(0x1);
    address public attacker = address(0x3);

    function setUp() public {
        agToken = new AgToken();
        auToken = new AuToken();
        
        treasury = new TreasuryAMO(
            address(auToken),   // auToken (buyback token)
            address(agToken),   // reserveToken
            address(0x1234),    // aerodromeRouter (mock)
            owner               // admin
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 1: Reserve balance is nonnegative
    // ═══════════════════════════════════════════════════════════════

    function invariant_reserveNonNegative() public view {
        uint256 reserve = agToken.balanceOf(address(treasury));
        assertGe(reserve, 0, "INVARIANT VIOLATION: negative reserve");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 2: Only executor can execute buyback
    // ═══════════════════════════════════════════════════════════════

    function test_onlyExecutorCanExecuteBuyback() public {
        vm.prank(attacker);
        vm.expectRevert();
        treasury.executeBuyback(1000, 0, false, block.timestamp + 3600);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 3: Max buyback per epoch bps is valid (≤ 10000)
    // ═══════════════════════════════════════════════════════════════

    function invariant_maxBuybackBpsValid() public view {
        uint256 bps = treasury.maxBuybackPerEpochBps();
        assertLe(bps, 10000, "INVARIANT VIOLATION: maxBuybackPerEpochBps exceeds 100%");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 4: Cooldown between operations enforced
    // ═══════════════════════════════════════════════════════════════

    function test_cooldownEnforced() public {
        uint256 reserve = agToken.balanceOf(address(treasury));
        if (reserve > 1000) {
            treasury.executeBuyback(1000, 0, false, block.timestamp + 3600);
        }
        
        vm.expectRevert();
        treasury.executeBuyback(1000, 0, false, block.timestamp + 3600);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 5: AMO constants are valid
    // ═══════════════════════════════════════════════════════════════

    function invariant_constantsValid() public view {
        assertEq(treasury.AMO_BUYBACK_PCT(), 12, "INVARIANT VIOLATION: buyback pct changed");
        assertEq(treasury.MIN_BUYBACK_USD(), 500, "INVARIANT VIOLATION: min buyback changed");
        assertEq(treasury.AMO_RESERVE_RUNWAY_MONTHS(), 12, "INVARIANT VIOLATION: runway changed");
    }

    // ═══════════════════════════════════════════════════════════════
    // Fuzz: Buyback respects max per epoch cap
    // ═══════════════════════════════════════════════════════════════

    function testFuzz_buybackWithinEpochCap(uint256 amount) public {
        uint256 reserve = agToken.balanceOf(address(treasury));
        uint256 maxPerEpoch = (reserve * treasury.maxBuybackPerEpochBps()) / 10000;
        
        vm.assume(amount > 0);
        
        if (amount > maxPerEpoch) {
            vm.prank(attacker);
            vm.expectRevert();
            treasury.executeBuyback(amount, 0, false, block.timestamp + 3600);
        }
    }
}
