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
/// @dev Deploys all contracts in correct dependency order, configures roles, and writes deployed.json
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

    struct DeployConfig {
        string agTokenName;
        string agTokenSymbol;
        string auTokenName;
        string auTokenSymbol;
        address lpNFTAddress;
        bool deployMockNFT;
        uint256 pidKp;
        uint256 pidKi;
        uint256 pidKd;
        uint256 pidSetpoint;
        uint256 pidEmissionCap;
        uint256 pidBootstrapMonths;
        address aerodromeRouter;
        address uniswapRouter;
        uint256 amoBuybackPct;
        uint256 amoCooldownSecs;
        uint256 amoMaxPriceDeviationBps;
        uint256 amoMinRunway;
        uint256 amoMaxBuyback;
        uint256 proposalThreshold;
        uint256 votingPeriod;
        uint256 votingDelay;
        uint256 quorumNumerator;
        uint256 timelockDelay;
        address admin;
        address emergencyAdmin;
        uint256 initialTreasuryFunding;
    }

    DeployConfig public config;

    function _defaultConfig() internal view returns (DeployConfig memory) {
        address deployer = vm.addr(1);
        return DeployConfig({
            agTokenName: "AV Governance Token",
            agTokenSymbol: "Ag",
            auTokenName: "AV Reserve Token",
            auTokenSymbol: "Au",
            lpNFTAddress: address(0),
            deployMockNFT: false,
            pidKp: 1e15,
            pidKi: 1e14,
            pidKd: 1e14,
            pidSetpoint: 5e16,
            pidEmissionCap: 1e20,
            pidBootstrapMonths: 9,
            aerodromeRouter: address(0),
            uniswapRouter: address(0),
            amoBuybackPct: 50,
            amoCooldownSecs: 1 hours,
            amoMaxPriceDeviationBps: 500,
            amoMinRunway: 1e18,
            amoMaxBuyback: 1e18,
            proposalThreshold: 1e18,
            votingPeriod: 50400,
            votingDelay: 1,
            quorumNumerator: 4,
            timelockDelay: 2 days,
            admin: deployer,
            emergencyAdmin: deployer,
            initialTreasuryFunding: 10000e18
        });
    }

    function run() external {
        config = _defaultConfig();

        // Read router from environment (required for TreasuryAMO)
        address router = vm.envAddress("AERODROME_ROUTER");
        require(router != address(0), "AERODROME_ROUTER env var required");
        config.aerodromeRouter = router;

        address deployer = vm.addr(1);

        console.log("══════════════════════════════════════════════════");
        console.log("  AV TREASURY — PRODUCTION DEPLOYMENT");
        console.log("══════════════════════════════════════════════════");
        console.log("  Deployer:", deployer);
        console.log("  Network:", block.chainid);
        console.log("══════════════════════════════════════════════════");

        // ─── Phase 1: Tokens ───────────────────────────────────
        console.log("\n[1/8] Deploying tokens...");

        AgToken ag = new AgToken();
        ag.initialize(config.admin);
        agToken = address(ag);
        console.log("  AgToken:", agToken);

        AuToken au = new AuToken();
        au.initialize(config.admin);
        auToken = address(au);
        console.log("  AuToken:", auToken);

        // ─── Phase 2: Oracle ───────────────────────────────────
        console.log("\n[2/8] Deploying oracle...");

        AvOracle oracle = new AvOracle(
            auToken,
            agToken,
            config.admin,
            config.admin
        );
        avOracle = address(oracle);
        console.log("  AvOracle:", avOracle);

        // ─── Phase 3: LP NFT ───────────────────────────────────
        console.log("\n[3/8] LP NFT...");

        if (config.lpNFTAddress != address(0)) {
            lpNFT = config.lpNFTAddress;
            console.log("  Using external LP NFT:", lpNFT);
        } else if (config.deployMockNFT) {
            console.log("  WARNING: MockLPNFT not included — deploy separately");
            revert("LP NFT must be provided for production");
        } else {
            revert("LP NFT address required");
        }

        // ─── Phase 4: Staking ──────────────────────────────────
        console.log("\n[4/8] Deploying LP staking...");

        AVLPStaking_v2 staking = new AVLPStaking_v2();
        staking.initialize(
            auToken,
            agToken,
            lpNFT
        );
        lpStaking = address(staking);
        console.log("  AVLPStaking_v2:", lpStaking);

        // ─── Phase 5: PID Controller ───────────────────────────
        console.log("\n[5/8] Deploying PID controller...");

        PID_Emission_Controller_v2 pid = new PID_Emission_Controller_v2(
            config.admin,
            lpStaking,
            agToken,
            config.pidSetpoint,
            config.pidKp,
            config.pidKi,
            config.pidKd
        );
        pidController = address(pid);
        console.log("  PID_Controller:", pidController);

        // ─── Phase 6: Treasury AMO ────────────────────────────
        console.log("\n[6/8] Deploying Treasury AMO...");

        TreasuryAMO amo = new TreasuryAMO(
            auToken,
            agToken,
            config.aerodromeRouter,
            config.admin
        );
        treasuryAMO = address(amo);
        console.log("  TreasuryAMO:", treasuryAMO);

        // ─── Phase 7: Governance ───────────────────────────────
        console.log("\n[7/8] Deploying governance...");

        ArtifactTimelock tl = new ArtifactTimelock(
            governor,       // proposer
            address(0),     // executor (anyone)
            config.admin    // canceler
        );
        timelock = address(tl);
        console.log("  ArtifactTimelock:", timelock);

        GovernorContract gov = new GovernorContract(
            agToken,    // IVotes compatible (ERC20VotesUpgradeable)
            timelock
        );
        governor = address(gov);
        console.log("  GovernorContract:", governor);

        // ─── Phase 8: Role Configuration ───────────────────────
        console.log("\n[8/8] Configuring roles...");

        bytes32 EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
        amo.grantRole(EXECUTOR_ROLE, timelock);
        console.log("  + EXECOR_ROLE -> Timelock on TreasuryAMO");

        bytes32 MINTER_ROLE = keccak256("MINTER_ROLE");
        ag.grantRole(MINTER_ROLE, pidController);
        console.log("  + MINTER_ROLE -> PID on AgToken");

        ag.grantRole(MINTER_ROLE, lpStaking);
        console.log("  + MINTER_ROLE -> Staking on AgToken");

        bytes32 GOVERNOR_ROLE = keccak256("GOVERNOR");
        oracle.grantRole(GOVERNOR_ROLE, governor);
        console.log("  + GOVERNOR -> Governor on AvOracle");

        // Governor already set as proposer in constructor
        console.log("  + Governor set as proposer on Timelock (in constructor)");

        // ─── Funding ───────────────────────────────────────────
        console.log("\n  Funding treasury...");

        au.mint(deployer, config.initialTreasuryFunding);
        au.transfer(treasuryAMO, config.initialTreasuryFunding);
        console.log("  + Minted & funded TreasuryAMO with", config.initialTreasuryFunding / 1e18, "Au");

        // ─── Summary ───────────────────────────────────────────
        console.log("\n══════════════════════════════════════════════════");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("══════════════════════════════════════════════════");
        console.log("  AgToken:        ", agToken);
        console.log("  AuToken:        ", auToken);
        console.log("  AvOracle:       ", avOracle);
        console.log("  LP_NFT:         ", lpNFT);
        console.log("  LP_Staking:     ", lpStaking);
        console.log("  PID_Controller:  ", pidController);
        console.log("  TreasuryAMO:    ", treasuryAMO);
        console.log("  Timelock:       ", timelock);
        console.log("  Governor:       ", governor);
        console.log("══════════════════════════════════════════════════");

        _writeDeployedAddresses();
    }

    function _writeDeployedAddresses() internal {
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
        json = string.concat(json, "\"Aerodrome_Router\":\"", _addrToString(config.aerodromeRouter), "\"");
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
