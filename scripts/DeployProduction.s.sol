// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import "../contracts/AgToken.sol";
import "../contracts/AuToken.sol";
import "../contracts/AvOracle.sol";
import "../contracts/PID_Emission_Controller_v2.sol";
import "../contracts/AVLPStaking_v2.sol";
import "../contracts/TreasuryAMO.sol";
import "../contracts/GovernorContract.sol";
import "../contracts/ArtifactTimelock.sol";

/// @title DeployProduction
/// @notice Full production deployment of the AV Treasury ecosystem
contract DeployProduction is Script {
    using stdJson for string;

    address public agToken;
    address public auToken;
    address public avOracle;
    address public pidController;
    address public lpStaking;
    address public lpNFT;
    address public treasuryAMO;
    address public timelock;
    address public governor;

    function run() external {
        address router = vm.envAddress("AERODROME_ROUTER");
        require(router != address(0), "AERODROME_ROUTER env var required");
        address deployer = vm.addr(1);

        console.log("==================================================");
        console.log("  AV TREASURY - PRODUCTION DEPLOYMENT");
        console.log("==================================================");
        console.log("  Deployer:", deployer);
        console.log("  Network:", block.chainid);
        console.log("==================================================");

        _deployTokens(deployer);
        _deployOracle(deployer);
        _deployLPNFT();
        _deployStaking();
        _deployPID(deployer);
        _deployTreasuryAMO(deployer, router);
        _deployGovernance(deployer);
        _configureRoles(deployer);
        _fundTreasury(deployer);
        _writeDeployedAddresses(router);
    }

    function _deployTokens(address deployer) internal {
        console.log("\n[1/8] Deploying tokens...");

        AgToken ag = new AgToken();
        ag.initialize(deployer);
        agToken = address(ag);
        console.log("  AgToken:", agToken);

        AuToken au = new AuToken();
        au.initialize(deployer);
        auToken = address(au);
        console.log("  AuToken:", auToken);
    }

    function _deployOracle(address deployer) internal {
        console.log("\n[2/8] Deploying oracle...");

        AvOracle oracle = new AvOracle(
            auToken,
            agToken,
            deployer,
            deployer
        );
        avOracle = address(oracle);
        console.log("  AvOracle:", avOracle);
    }

    function _deployLPNFT() internal {
        console.log("\n[3/8] LP NFT...");

        address nft = vm.envAddress("LP_NFT_ADDRESS");
        require(nft != address(0), "LP_NFT_ADDRESS env var required for production");
        lpNFT = nft;
        console.log("  Using LP NFT:", lpNFT);
    }

    function _deployStaking() internal {
        console.log("\n[4/8] Deploying LP staking...");

        AVLPStaking_v2 staking = new AVLPStaking_v2();
        staking.initialize(
            auToken,
            agToken,
            lpNFT
        );
        lpStaking = address(staking);
        console.log("  AVLPStaking_v2:", lpStaking);
    }

    function _deployPID(address deployer) internal {
        console.log("\n[5/8] Deploying PID controller...");

        PID_Emission_Controller_v2 pid = new PID_Emission_Controller_v2(
            deployer,
            lpStaking,
            agToken,
            5e16,
            1e15,
            1e14,
            1e14
        );
        pidController = address(pid);
        console.log("  PID_Controller:", pidController);
    }

    function _deployTreasuryAMO(address deployer, address router) internal {
        console.log("\n[6/8] Deploying Treasury AMO...");

        TreasuryAMO amo = new TreasuryAMO(
            auToken,
            agToken,
            router,
            deployer
        );
        treasuryAMO = address(amo);
        console.log("  TreasuryAMO:", treasuryAMO);
    }

    function _deployGovernance(address deployer) internal {
        console.log("\n[7/8] Deploying governance...");

        ArtifactTimelock tl = new ArtifactTimelock(
            deployer,
            address(0),
            deployer
        );
        timelock = address(tl);
        console.log("  ArtifactTimelock:", timelock);

        GovernorContract gov = new GovernorContract(
            IVotes(address(agToken)),
            timelock
        );
        governor = address(gov);
        console.log("  GovernorContract:", governor);

        vm.startPrank(deployer);
        tl.grantRole(keccak256("PROPOSER_ROLE"), governor);
        tl.renounceRole(keccak256("PROPOSER_ROLE"), deployer);
        vm.stopPrank();
        console.log("  + Governor set as PROPOSER on Timelock");
    }

    function _configureRoles(address deployer) internal {
        console.log("\n[8/8] Configuring roles...");

        bytes32 MINTER_ROLE = keccak256("MINTER_ROLE");
        AuToken(auToken).grantRole(MINTER_ROLE, deployer);
        console.log("  + MINTER_ROLE -> Deployer on AuToken");

        vm.startPrank(deployer);

        AgToken(agToken).grantRole(MINTER_ROLE, pidController);
        console.log("  + MINTER_ROLE -> PID on AgToken");

        AgToken(agToken).grantRole(MINTER_ROLE, lpStaking);
        console.log("  + MINTER_ROLE -> Staking on AgToken");

        bytes32 GOVERNOR_ROLE = keccak256("GOVERNOR");
        AvOracle(avOracle).grantRole(GOVERNOR_ROLE, governor);
        console.log("  + GOVERNOR -> Governor on AvOracle");

        vm.stopPrank();

        vm.startPrank(deployer);
        bytes32 EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
        TreasuryAMO(treasuryAMO).grantRole(EXECUTOR_ROLE, timelock);
        console.log("  + EXECUTOR_ROLE -> Timelock on TreasuryAMO");
        vm.stopPrank();
    }

    function _fundTreasury(address deployer) internal {
        console.log("\n  Funding treasury...");

        // AuToken maxWallet = totalSupply * 1000 / 10000 = totalSupply / 10.
        // First mint: balanceOf(to) = X, maxWallet = X/10, X > X/10 always fails.
        // Fix: temporarily set maxWalletAmountBps to 10000 (100%, no limit),
        // mint, then restore to 1000 (10%).
        uint256 treasuryAmount = 10000e18;

        AuToken(auToken).setMaxWalletAmount(10000);
        console.log("  + Temporarily set AuToken max wallet to 100% for bootstrap");

        vm.startPrank(deployer);
        AuToken(auToken).mint(treasuryAMO, treasuryAmount);
        vm.stopPrank();
        console.log("  + Minted treasury funding to TreasuryAMO");

        AuToken(auToken).setMaxWalletAmount(1000);
        console.log("  + Restored AuToken max wallet to 10%");

        // Summary
        console.log("\n==================================================");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("==================================================");
        console.log("  AgToken:        ", agToken);
        console.log("  AuToken:        ", auToken);
        console.log("  AvOracle:       ", avOracle);
        console.log("  LP_NFT:         ", lpNFT);
        console.log("  LP_Staking:     ", lpStaking);
        console.log("  PID_Controller:  ", pidController);
        console.log("  TreasuryAMO:    ", treasuryAMO);
        console.log("  Timelock:       ", timelock);
        console.log("  Governor:       ", governor);
        console.log("==================================================");
    }

    function _writeDeployedAddresses(address router) internal {
        string memory path = string.concat("deployed_", _uintToString(block.chainid), ".json");

        string memory json = "{";
        json = string.concat(json, "\"chainId\":", _uintToString(block.chainid), ",");
        json = string.concat(json, "\"deployer\":\"", _addrToString(vm.addr(1)), "\",");
        json = string.concat(json, "\"contracts\":{");
        json = string.concat(json, "\"AgToken\":\"", _addrToString(agToken), "\",");
        json = string.concat(json, "\"AuToken\":\"", _addrToString(auToken), "\",");
        json = string.concat(json, "\"AvOracle\":\"", _addrToString(avOracle), "\",");
        json = string.concat(json, "\"LP_NFT\":\"", _addrToString(lpNFT), "\",");
        json = string.concat(json, "\"LP_Staking\":\"", _addrToString(lpStaking), "\",");
        json = string.concat(json, "\"PID_Controller\":\"", _addrToString(pidController), "\",");
        json = string.concat(json, "\"Treasury_AMO\":\"", _addrToString(treasuryAMO), "\",");
        json = string.concat(json, "\"Timelock\":\"", _addrToString(timelock), "\",");
        json = string.concat(json, "\"Governor\":\"", _addrToString(governor), "\",");
        json = string.concat(json, "\"Aerodrome_Router\":\"", _addrToString(router), "\"");
        json = string.concat(json, "}}");

        vm.writeFile(path, json);
        console.log("  Deployed addresses written to:", path);
    }

    function _addrToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
