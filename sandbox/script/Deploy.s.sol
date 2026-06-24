// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../contracts/MockTokens.sol";
import "../contracts/DexSimulator.sol";
import "../contracts/SandboxLPToken.sol";
import "../contracts/MockStaking.sol";
import "../contracts/MockPIDController.sol";
import "../contracts/MockTreasuryAMO.sol";
import "../contracts/MockGovernor.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy tokens
        MockAuToken auToken = new MockAuToken(deployer);
        MockAgToken agToken = new MockAgToken();
        
        // Deploy DEX
        DexSimulator dex = new DexSimulator(address(auToken), address(agToken));
        
        // Deploy LP token
        SandboxLPToken lpToken = new SandboxLPToken(address(dex));
        
        // Deploy staking
        MockStaking staking = new MockStaking(address(lpToken), address(auToken), address(agToken));
        
        // Deploy PID controller
        MockPIDController pid = new MockPIDController(address(agToken), address(dex), 10000 ether);
        
        // Deploy Treasury AMO
        MockTreasuryAMO amo = new MockTreasuryAMO(address(auToken), address(agToken), address(dex), address(pid));
        
        // Deploy Governor
        MockGovernor governor = new MockGovernor();
        
        vm.stopBroadcast();
    }
}
