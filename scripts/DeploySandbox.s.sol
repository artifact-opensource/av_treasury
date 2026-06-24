// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../contracts/MockTokens.sol";
import "../contracts/DexSimulator.sol";

contract DeploySandbox is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        vm.startBroadcast(deployerPrivateKey);
        
        MockAgUSD agUSD = new MockAgUSD();
        console.log("agUSD:", address(agUSD));
        
        MockAVAX AVAX = new MockAVAX();
        console.log("AVAX:", address(AVAX));
        
        MockUSDC USDC = new MockUSDC();
        console.log("USDC:", address(USDC));
        
        DexSimulator dex = new DexSimulator(address(agUSD), address(AVAX));
        console.log("DexSimulator:", address(dex));
        
        // Seed liquidity
        agUSD.approve(address(dex), 500_000 * 1e18);
        AVAX.approve(address(dex), 250_000 * 1e18);
        dex.addLiquidity(500_000 * 1e18, 250_000 * 1e18);
        console.log("Liquidity seeded");
        
        vm.stopBroadcast();
        
        console.log("=== DEPLOYED ===");
        console.log("agUSD:", address(agUSD));
        console.log("AVAX:", address(AVAX));
        console.log("USDC:", address(USDC));
        console.log("dex:", address(dex));
    }
}
