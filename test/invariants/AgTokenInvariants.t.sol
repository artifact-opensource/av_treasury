// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../contracts/av_suite/AgToken.sol";

/**
 * @title AgTokenInvariants
 * @dev Stateful invariant tests for AgToken
 * 
 * Uses AgTokenDeployer pattern: deploys implementation + proxy,
 * initializes through the proxy, and returns proxy address.
 * Each setUp() creates a fresh proxy pointing to the same implementation.
 */
contract AgTokenInvariants is Test {
    AgToken public agToken;

    address public owner = address(0x1);
    address public minter = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public attacker = address(0x5);

    // Shared implementation contract (deployed once)
    address public immutable implementation;

    constructor() {
        implementation = address(new AgToken());
    }

    function setUp() public {
        // Deploy a new proxy pointing to the implementation
        address proxy = address(new ERC1967Proxy(implementation, abi.encodeWithSelector(AgToken.initialize.selector, owner)));
        agToken = AgToken(payable(proxy));
        
        // Grant minter role to minter address (called by owner via prank)
        vm.startPrank(owner);
        agToken.grantRole(agToken.MINTER_ROLE(), minter);
        vm.stopPrank();
        
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 1: Total supply is nonnegative
    // ═══════════════════════════════════════════════════════════════

    function invariant_totalSupplyNonNegative() public view {
        assertGe(agToken.totalSupply(), 0, "INVARIANT VIOLATION: negative total supply");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 2: Only minters can mint
    // ═══════════════════════════════════════════════════════════════

    function test_onlyMintersCanMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        agToken.mint(attacker, 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 3: Minting increases total supply
    // ═══════════════════════════════════════════════════════════════

    function test_mintingIncreasesSupply() public {
        uint256 supplyBefore = agToken.totalSupply();
        
        vm.prank(minter);
        agToken.mint(user1, 1000);
        
        uint256 supplyAfter = agToken.totalSupply();
        assertGt(supplyAfter, supplyBefore, "INVARIANT VIOLATION: minting did not increase supply");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 4: Balance consistency after transfer
    // ═══════════════════════════════════════════════════════════════

    function test_transferBalanceConsistency() public {
        vm.prank(minter);
        agToken.mint(user1, 10000);
        
        uint256 user1Before = agToken.balanceOf(user1);
        uint256 user2Before = agToken.balanceOf(user2);
        
        vm.prank(user1);
        agToken.transfer(user2, 5000);
        
        uint256 user1After = agToken.balanceOf(user1);
        uint256 user2After = agToken.balanceOf(user2);
        
        assertEq(user1Before - user1After, 5000, "INVARIANT VIOLATION: sender balance mismatch");
        assertEq(user2After - user2Before, 5000, "INVARIANT VIOLATION: receiver balance mismatch");
    }

    // ═══════════════════════════════════════════════════════════════
    // INVARIANT 5: Cannot mint to zero address
    // ═══════════════════════════════════════════════════════════════

    function test_mintToZeroAddressReverts() public {
        vm.prank(minter);
        vm.expectRevert();
        agToken.mint(address(0), 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // Fuzz: Random mint amounts preserve supply integrity
    // ═══════════════════════════════════════════════════════════════

    function testFuzz_mintPreservesSupplyIntegrity(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1e25);
        
        uint256 supplyBefore = agToken.totalSupply();
        
        vm.prank(minter);
        agToken.mint(user1, amount);
        
        uint256 supplyAfter = agToken.totalSupply();
        
        assertEq(
            supplyAfter - supplyBefore, amount,
            "INVARIANT VIOLATION: supply change != mint amount"
        );
    }
}

/**
 * @title ERC1967Proxy
 * @dev Minimal ERC1967 proxy contract
 */
contract ERC1967Proxy {
    address public immutable implementation;

    constructor(address _implementation, bytes memory _data) {
        implementation = _implementation;
        if (_data.length > 0) {
            (bool success, ) = _implementation.delegatecall(_data);
            require(success, "Initialization failed");
        }
    }

    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
