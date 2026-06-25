// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "./MockTokens.sol";
import "./DexSimulator.sol";
import "./SandboxLPToken.sol";
import "./MockStaking.sol";
import "./MockPIDController.sol";
import "./MockTreasuryAMO.sol";

contract DeploySandbox is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy dual-token system
        MockAgToken agToken = new MockAgToken();
        console.log("AgToken:", address(agToken));

        MockAuToken auToken = new MockAuToken(deployer);
        console.log("AuToken:", address(auToken));

        // 2. Deploy Ag/Au DEX
        DexSimulator dex = new DexSimulator(address(agToken), address(auToken));
        console.log("DexSimulator:", address(dex));

        // 3. Mint initial supply
        agToken.mint(deployer, 10_000_000 * 1e18);
        auToken.mint(deployer, 10_000_000 * 1e18);

        // 4. Seed liquidity (1M Ag + 200K Au)
        agToken.approve(address(dex), 1_000_000 * 1e18);
        auToken.approve(address(dex), 200_000 * 1e18);
        dex.addLiquidity(1_000_000 * 1e18, 200_000 * 1e18);
        console.log("Liquidity seeded");

        // 5. Deploy SandboxLPToken (needs dex, tokenA, tokenB)
        SandboxLPToken lpToken = new SandboxLPToken(address(dex), address(agToken), address(auToken));
        console.log("SandboxLPToken:", address(lpToken));

        // 6. Deploy MockStaking (needs lpToken, auToken, agToken, rewardRateAu, rewardRateAg)
        MockStaking staking = new MockStaking(
            address(lpToken),
            address(auToken),
            address(agToken),
            100,    // rewardRateAu
            100     // rewardRateAg
        );
        console.log("MockStaking:", address(staking));

        // 7. Deploy MockPIDController with calibrated params
        MockPIDController pid = new MockPIDController(
            address(agToken),
            address(staking),
            0.001 ether,   // kp
            0.0001 ether,  // ki
            0.01 ether,    // kd
            1500 ether,    // targetTvl
            1000 ether,     // maxDailyEmission
            100 ether,      // maxSingleEmission
            1,             // emissionCooldown
            500            // deadbandBps
        );
        console.log("MockPIDController:", address(pid));

        // 8. Deploy MockTreasuryAMO
        MockTreasuryAMO treasury = new MockTreasuryAMO(
            address(agToken),
            address(auToken),
            address(dex),
            1,      // cooldownBlocks
            500,    // maxSlippageBps
            1000,   // maxBuybackPerEpochBps
            1000    // runway
        );
        console.log("MockTreasuryAMO:", address(treasury));

        // 9. Grant PID minter role and fund PID + Treasury
        bytes32 mintRole = keccak256("MINTER_ROLE");
        agToken.grantRole(mintRole, address(pid));
        agToken.mint(address(pid), 100_000 * 1e18);
        agToken.mint(address(treasury), 500_000 * 1e18);
        console.log("PID granted minter role");

        // 10. Mint LP tokens to deployer, then stake to create TVL
        // SandboxLPToken.mint(amountAIn, amountBIn) returns lpShares
        agToken.approve(address(lpToken), 1300 * 1e18);
        auToken.approve(address(lpToken), 260 * 1e18);
        uint256 lpShares = lpToken.mint(1300 * 1e18, 260 * 1e18);
        console.log("LP shares minted:", lpShares);

        // Stake LP tokens to create staking TVL
        lpToken.approve(address(staking), lpShares);
        staking.stake(lpShares);
        console.log("LP tokens staked. Staking TVL:", staking.totalStaked());

        // 11. Fund bots is done off-chain via cast send after deployment
        // (BIP32 derivation from mnemonic not available in Solidity)
        console.log("Deployment complete. Fund bots via cast send if needed.");

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("AgToken:", address(agToken));
        console.log("AuToken:", address(auToken));
        console.log("DexSimulator:", address(dex));
        console.log("SandboxLPToken:", address(lpToken));
        console.log("MockStaking:", address(staking));
        console.log("MockPIDController:", address(pid));
        console.log("MockTreasuryAMO:", address(treasury));
    }
}
