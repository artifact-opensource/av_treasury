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
        dex = new DexSimulator(address(auToken), address(agToken));
        lpToken = new SandboxLPToken(address(dex), address(auToken), address(agToken));
        staking = new MockStaking(address(lpToken), address(auToken), address(agToken), 100, 100);
        pid = new MockPIDController(address(agToken), address(dex), 1000, 100, 10, 10000 ether, 1000 ether, 100 ether, 1, 500);
        amo = new MockTreasuryAMO(address(agToken), address(auToken), address(dex), 1, 500, 2000, 1000 ether);
        governor = new MockGovernor(100, 200, 1 ether, 400);
        
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
        
        // Fund user with tokens (owner is deployer, so mint through deployer)
        vm.startPrank(deployer);
        agToken.mint(deployer, 100 ether);
        auToken.mint(deployer, 100 ether);
        agToken.transfer(user, 50 ether);
        auToken.transfer(user, 50 ether);
        vm.stopPrank();
        
        // User adds liquidity via LP token contract (account for Au fee)
        vm.startPrank(user);
        uint256 userAuBal = auToken.balanceOf(user);
        uint256 userAgBal = agToken.balanceOf(user);
        
        auToken.approve(address(lpToken), userAuBal);
        agToken.approve(address(lpToken), userAgBal);
        
        uint256 lpReceived = lpToken.mint(userAuBal, userAgBal);
        emit log_named_uint("LP received", lpReceived);
        
        // Stake LP tokens
        uint256 lpBal = lpToken.balanceOf(user);
        emit log_named_uint("User LP balance", lpBal);
        lpToken.approve(address(staking), lpBal);
        staking.stake(lpBal);
        
        // Check pending rewards after some time
        vm.roll(100);
        (uint256 auReward, uint256 agReward) = staking.pendingRewards(user);
        emit log_named_uint("Au reward", auReward);
        emit log_named_uint("Ag reward", agReward);
        
        // Claim rewards
        staking.claimRewards();
        uint256 auBalance = auToken.balanceOf(user);
        uint256 agBalance = agToken.balanceOf(user);
        emit log_named_uint("Au balance after claim", auBalance);
        emit log_named_uint("Ag balance after claim", agBalance);
        
        vm.stopPrank();
    }
}
