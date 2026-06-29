/**
 * Deploy OracleGuardian — Governance-controlled oracle integration layer
 * 
 * This deploys the OracleGuardian contract that sits between AvOracle and
 * consumer contracts (TreasuryAMO, PIDController, FlashBuy).
 * 
 * After deployment, governance (Timelock) must:
 * 1. Set TreasuryAMO, PIDController, FlashBuy addresses
 * 2. Grant PARAM_ROLE to Safe multi-sig for parameter tuning
 * 3. Grant GUARDIAN_ROLE to a monitoring service for emergency pauses
 * 
 * Usage:
 *   npx hardhat run scripts/deploy_oracle_guardian.js --network base
 */

const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying OracleGuardian with:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()));

    // ─── Addresses (from address.book / environment) ───────────────────────
    const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000";
    const AU_TOKEN_ADDRESS = process.env.AU_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const USDC_TOKEN_ADDRESS = process.env.USDC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const TREASURY_AMO_ADDRESS = process.env.TREASURY_AMO_ADDRESS || "0x0000000000000000000000000000000000000000";
    const TIMELOCK_ADDRESS = process.env.TIMELOCK_ADDRESS || "0x0000000000000000000000000000000000000000";

    // ─── Parameters ─────────────────────────────────────────────────────────
    // Au peg price in 18 decimals (1e18 = $1.00)
    const AU_PEG = process.env.AU_PEG || ethers.utils.parseEther("1.0");
    // FlashBuy trigger: bps below peg (500 = 5%)
    const BUYBACK_TRIGGER_BPS = process.env.BUYBACK_TRIGGER_BPS || "500";

    // Validate
    if (ORACLE_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Set ORACLE_ADDRESS env var");
    if (AU_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Set AU_TOKEN_ADDRESS env var");
    if (USDC_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Set USDC_TOKEN_ADDRESS env var");
    if (TREASURY_AMO_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Set TREASURY_AMO_ADDRESS env var");
    if (TIMELOCK_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Set TIMELOCK_ADDRESS env var");

    // ─── Deploy OracleGuardian ─────────────────────────────────────────────
    console.log("\n── Deploying OracleGuardian ──");
    const OracleGuardian = await ethers.getContractFactory("OracleGuardian");
    const guardian = await OracleGuardian.deploy(
        ORACLE_ADDRESS,
        AU_TOKEN_ADDRESS,
        USDC_TOKEN_ADDRESS,
        TREASURY_AMO_ADDRESS,
        TIMELOCK_ADDRESS,   // admin = Timelock
        AU_PEG,
        BUYBACK_TRIGGER_BPS
    );
    await guardian.deployed();
    console.log("OracleGuardian deployed to:", guardian.address);

    // ─── Verify on Etherscan ───────────────────────────────────────────────
    console.log("\n── Verify ──");
    console.log(`npx hardhat verify --network base ${guardian.address} \\
  ${ORACLE_ADDRESS} \\
  ${AU_TOKEN_ADDRESS} \\
  ${USDC_TOKEN_ADDRESS} \\
  ${TREASURY_AMO_ADDRESS} \\
  ${TIMELOCK_ADDRESS} \\
  ${AU_PEG.toString()} \\
  ${BUYBACK_TRIGGER_BPS}`);

    // ─── Post-deployment checklist ─────────────────────────────────────────
    console.log("\n── Post-Deployment Checklist ──");
    console.log("1. Set consumer addresses via governance:");
    console.log("   guardian.setPidController(<PID address>)");
    console.log("   guardian.setFlashBuy(<FlashBuy address>)");
    console.log("");
    console.log("2. Grant PARAM_ROLE to Safe multi-sig:");
    console.log("   guardian.grantParamRole(<Safe address>)");
    console.log("");
    console.log("3. Grant GUARDIAN_ROLE to monitoring service:");
    console.log("   guardian.guardianRole(<monitor address>)");
    console.log("");
    console.log("4. Test oracle read:");
    console.log("   guardian.getAuPrice() → should return Au price in 18 decimals");
    console.log("   guardian.getValidatedAuPrice() → same, but reverts if stale");
    console.log("");
    console.log("5. Update address.book with OracleGuardian address");

    return guardian;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
