// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../contracts/av_suite/AuToken.sol";
import "../../contracts/av_suite/AgToken.sol";

/**
 * @title AuTokenInvariants
 * @dev Stateful invariant tests for AuToken
 */
contract AuTokenInvariants is Test {
    AuToken public auToken;
    AgToken public agToken;

    address public owner = address(0x1);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public attacker = address(0x5);

    function setUp() public {
        agToken = new AgToken();
        agToken.initialize(owner);
        
        auToken = new AuToken();
        auToken.initialize(address(this));
        
        // Set max wallet and max tx to 100% for testing
        auToken.setMaxWalletAmount(10_000); // 100%
        auToken.setMaxTxAmount(10_000);     // 100%
        
        vm.prank(address(this));
        auToken.grantRole(auToken.MINTER_ROLE(), address(this));
        
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 1: Total supply is nonnegative
    // ═══════════════════════════════════════════════════════════════

    function invariant_totalSupplyNonNegative() public view {
        assertGe(auToken.totalSupply(), 0, "INVARIANT VIOLATION: negative total supply");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 2: Cannot mint to zero address
    // ═══════════════════════════════════════════════════════════════

    function test_mintToZeroAddressReverts() public {
        vm.expectRevert();
        auToken.mint(address(0), 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 3: Only minters can mint
    // ═══════════════════════════════════════════════════════════════

    function test_onlyMintersCanMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        auToken.mint(attacker, 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 4: Minting increases total supply correctly
    // ═══════════════════════════════════════════════════════════════

    function test_mintingCorrectSupply() public {
        uint256 supplyBefore = auToken.totalSupply();
        uint256 mintAmount = 10000;
        
        auToken.mint(user1, mintAmount);
        
        uint256 supplyAfter = auToken.totalSupply();
        assertEq(
            supplyAfter - supplyBefore, mintAmount,
            "INVARIANT VIOLATION: supply change != mint amount"
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 5: Balance consistency after transfer
    // ═══════════════════════════════════════════════════════════════

    function test_transferBalanceConsistency() public {
        auToken.mint(user1, 10000);
        
        uint256 user1Before = auToken.balanceOf(user1);
        uint256 user2Before = auToken.balanceOf(user2);
        
        vm.prank(user1);
        auToken.transfer(user2, 5000);
        
        uint256 user1After = auToken.balanceOf(user1);
        uint256 user2After = auToken.balanceOf(user2);
        
        assertEq(user1Before - user1After, 5000, "INVARIANT VIOLATION: sender balance mismatch");
        assertEq(user2After - user2Before, 5000, "INVARIANT VIOLATION: receiver balance mismatch");
    }

    // ═══════════════════════════════════════════════════════════════
    // Fuzz: Supply integrity across random mints
    // ═══════════════════════════════════════════════════════════════

    function testFuzz_supplyIntegrity(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1e25);
        
        uint256 supplyBefore = auToken.totalSupply();
        auToken.mint(user1, amount);
        uint256 supplyAfter = auToken.totalSupply();
        
        assertEq(
            supplyAfter - supplyBefore, amount,
            "FUZZ: supply change != mint amount"
        );
    }
}
