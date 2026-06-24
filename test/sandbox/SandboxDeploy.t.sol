// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../sandbox/contracts/MockTokens.sol";
import "../../sandbox/contracts/DexSimulator.sol";
import "../../sandbox/contracts/SandboxLPToken.sol";
import "../../sandbox/contracts/MockStaking.sol";
import "../../sandbox/contracts/MockPIDController.sol";
import "../../sandbox/contracts/MockTreasuryAMO.sol";
import "../../sandbox/contracts/MockGovernor.sol";

contract SandboxDeployTest is Test {
    MockAuToken public auToken;
    MockAgToken public agToken;
    DexSimulator public dex;
    SandboxLPToken public lpToken;
    MockStaking public staking;
    MockPIDController public pid;
    MockTreasuryAMO public amo;
    MockGovernor public governor;
    address public deployer;

    function setUp() public {
        deployer = makeAddr("deployer");
        vm.deal(deployer, 10000 ether);

        vm.startPrank(deployer);
        
        auToken = new MockAuToken(deployer);
        agToken = new MockAgToken();
        dex = new DexSimulator(address(agToken), address(auToken));
        lpToken = new SandboxLPToken(address(dex), address(agToken), address(auToken));
        staking = new MockStaking(address(lpToken), address(auToken), address(agToken), 100, 100);
        pid = new MockPIDController(address(agToken), address(dex), 1000, 100, 10, 10000 ether, 1000 ether, 100 ether, 1, 500);
        amo = new MockTreasuryAMO(address(agToken), address(auToken), address(dex), 1, 500, 2000, 1000 ether);
        governor = new MockGovernor(100, 200, 1 ether, 400);
        
        // Grant staking contract minter role on Ag (for reward emissions)
        agToken.grantRole(keccak256("MINTER_ROLE"), address(staking));
        
        // Grant staking minter role on Ag (for reward emissions)
        agToken.grantRole(keccak256("MINTER_ROLE"), address(staking));
        
        // Fund staking contract with Au for rewards
        auToken.mint(address(staking), 10000 ether);
        // Fund Treasury AMO with Ag for buybacks
        agToken.mint(address(amo), 10000 ether);
        
        vm.stopPrank();
    }

    function test_Deployment() public view {
        assertTrue(address(auToken) != address(0));
        assertTrue(address(agToken) != address(0));
        assertTrue(address(dex) != address(0));
        assertTrue(address(lpToken) != address(0));
        assertTrue(address(staking) != address(0));
        assertTrue(address(pid) != address(0));
        assertTrue(address(amo) != address(0));
        assertTrue(address(governor) != address(0));
    }

    function test_Flywheel() public {
        address user = makeAddr("user");
        vm.deal(user, 100 ether);

        // Fund user with tokens
        vm.startPrank(deployer);
        agToken.mint(user, 100 ether);
        auToken.mint(user, 100 ether);
        vm.stopPrank();

        // User adds liquidity
        vm.startPrank(user);
        agToken.approve(address(lpToken), 100 ether);
        auToken.approve(address(lpToken), 100 ether);
        uint256 lpReceived = lpToken.mint(100 ether, 100 ether);
        emit log_named_uint("LP received", lpReceived);

        // Stake LP tokens
        lpToken.approve(address(staking), lpReceived);
        staking.stake(lpReceived);

        // Advance blocks to accrue rewards
        vm.roll(100);

        // Claim rewards
        staking.claimRewards();
        emit log_named_uint("Au balance", auToken.balanceOf(user));
        emit log_named_uint("Ag balance", agToken.balanceOf(user));

        vm.stopPrank();
    }
}
