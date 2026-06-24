// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "./MockTokens.sol";
import "./DexSimulator.sol";

contract DeploySandbox is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy dual-token system
        MockAgToken agToken = new MockAgToken();
        console.log("AgToken:", address(agToken));

        MockAuToken auToken = new MockAuToken(deployer);
        console.log("AuToken:", address(auToken));

        // Deploy Ag/Au DEX
        DexSimulator dex = new DexSimulator(address(agToken), address(auToken));
        console.log("DexSimulator:", address(dex));

        // Mint initial supply
        agToken.mint(deployer, 10_000_000 * 1e18);
        auToken.mint(deployer, 10_000_000 * 1e18);

        // Seed liquidity
        agToken.approve(address(dex), 1_000_000 * 1e18);
        auToken.approve(address(dex), 200_000 * 1e18);
        dex.addLiquidity(1_000_000 * 1e18, 200_000 * 1e18);

        vm.stopBroadcast();

        // Log addresses for the JS scripts
        console.log("=== DEPLOYED ===");
        console.log("AgToken:", address(agToken));
        console.log("AuToken:", address(auToken));
        console.log("dex:", address(dex));
    }
}
