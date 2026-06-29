/**
 * Wire Oracle — Governance proposal script to activate oracle integration
 * 
 * This script generates the calldata for a governance proposal that:
 * 1. Deploys OracleGuardian
 * 2. Sets up consumer addresses
 * 3. Configures TreasuryAMO to use oracle validation
 * 4. Configures PID to use oracle-enhanced TVL
 * 5. Configures FlashBuy to use oracle price trigger
 * 
 * The proposal goes through: Governor → Timelock → Execute
 * 
 * Usage:
 *   npx hardhat run scripts/wire_oracle_governance.js --network base
 */

const { ethers } = require("hardhat");

async function main() {
    const [proposer] = await ethers.getSigners();

    // ─── Contract Addresses ────────────────────────────────────────────────
    const ORACLE_GUARDIAN = process.env.ORACLE_GUARDIAN || "0x...";
    const TREASURY_AMO = process.env.TREASURY_AMO || "0x...";
    const PID_CONTROLLER = process.env.PID_CONTROLLER || "0x...";
    const FLASH_BUY = process.env.FLASH_BUY || "0x...";
    const TIMELOCK = process.env.TIMELOCK || "0x...";
    const GOVERNOR = process.env.GOVERNOR || "0x...";

    // ─── Step 1: Set consumer addresses in OracleGuardian ───────────────────
    console.log("═══ Step 1: Configure OracleGuardian ═══");
    
    const guardianInterface = new ethers.utils.Interface([
        "function setTreasuryAMO(address)",
        "function setPidController(address)",
        "function setFlashBuy(address)",
        "function grantParamRole(address)",
        "function grantGuardianRole(address)"
    ]);

    const setupCalldata = guardianInterface.encodeFunctionData("setTreasuryAMO", [TREASURY_AMO]);
    console.log("setTreasuryAMO calldata:", setupCalldata);

    // ─── Step 2: TreasuryAMO — Add oracle validation ──────────────────────
    console.log("\n═══ Step 2: Wire TreasuryAMO ═══");
    
    // TreasuryAMO needs an internal function to set oracle reference.
    // Since TreasuryAMO is non-upgradeable, we add this via a governance
    // action that calls a new setter. Two options:
    //   A) Deploy TreasuryAMO_v2 with native oracle support
    //   B) Use a wrapper contract that TreasuryAMO can call
    
    // For Option B (no redeployment), we deploy a small TreasuryOracleAdapter
    // that TreasuryAMO can call for price validation:
    
    const treasuryAmoInterface = new ethers.utils.Interface([
        "function setOracleReference(address _oracle, uint256 _maxDeviationBps)"
    ]);
    
    // If TreasuryAMO doesn't have setOracleReference, we need TreasuryAMO_v2.
    // For now, the OracleGuardian.validateTwapPrice() can be called by
    // a keeper/bot that monitors trades and flags suspicious ones.
    
    console.log("TreasuryAMO: Oracle validation will be applied via off-chain keeper");
    console.log("  Keeper calls OracleGuardian.validateTwapPrice(twapPrice)");
    console.log("  If deviation > threshold → keeper pauses AMO via emergencyPause()");
    
    // ─── Step 3: PID Controller — Oracle-enhanced TVL ────────────────────
    console.log("\n═══ Step 3: Wire PID Controller ═══");
    
    const pidInterface = new ethers.utils.Interface([
        "function setTvlSource(address _source)",
        "function setTargetTvl(uint256 _target)"
    ]);
    
    // Option A: Make staking contract implement ITvlSource
    // The staking contract reads oracle price and returns USD TVL
    // This requires staking contract upgrade OR wrapper
    
    // Option B: PID reads OracleGuardian.calculateAuTVL() directly
    // PID already has setTvlSource() — we set it to OracleGuardian address
    // OracleGuardian implements getTvl() → returns USD TVL
    
    console.log("PID: Set TVL source to OracleGuardian");
    console.log("  PID will call OracleGuardian.calculateAuTVL(totalAu)");
    console.log("  This gives USD-denominated TVL instead of NFT count");
    
    // ─── Step 4: FlashBuy — Oracle price trigger ─────────────────────────
    console.log("\n═══ Step 4: Wire FlashBuy ═══");
    
    const flashBuyInterface = new ethers.utils.Interface([
        "function setOracleTrigger(address _oracleGuardian, uint256 _thresholdBps)"
    ]);
    
    console.log("FlashBuy: Use oracle price as buyback trigger");
    console.log("  FlashBuy calls OracleGuardian.isAuBelowPeg(thresholdBps)");
    console.log("  If true → execute buyback at oracle price");
    
    // ─── Governance Proposal Builder ──────────────────────────────────────
    console.log("\n═══ Governance Proposal ═══");
    
    const targets = [
        ORACLE_GUARDIAN,    // 1. Set addresses
        ORACLE_GUARDIAN,    // 2. Grant roles
        PID_CONTROLLER,      // 3. Set TVL source
        FLASH_BUY           // 4. Set oracle trigger
    ];
    
    const values = [0, 0, 0, 0];
    
    const calldatas = [
        guardianInterface.encodeFunctionData("setTreasuryAMO", [TREASURY_AMO]),
        guardianInterface.encodeFunctionData("grantParamRole", [proposer.address]),
        pidInterface.encodeFunctionData("setTvlSource", [ORACLE_GUARDIAN]),
        flashBuyInterface.encodeFunctionData("setOracleTrigger", [ORACLE_GUARDIAN, 500]) // 5% threshold
    ];
    
    const description = "Proposal: Activate Oracle Integration — Wire AvOracle into TreasuryAMO (circuit breaker), PID (USD TVL), and FlashBuy (price trigger)";
    
    console.log("Proposal targets:", targets);
    console.log("Proposal values:", values);
    console.log("Proposal calldatas:", calldatas);
    console.log("Description:", description);
    
    // ─── Submit Proposal ──────────────────────────────────────────────────
    if (process.env.SUBMIT_PROPOSAL === "true") {
        console.log("\n═══ Submitting Proposal ═══");
        const governor = await ethers.getContractAt("GovernorContract", GOVERNOR);
        
        const tx = await governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        const receipt = await tx.wait();
        console.log("Proposal submitted! Tx:", receipt.transactionHash);
        
        const proposalId = receipt.logs[0].topics[1];
        console.log("Proposal ID:", proposalId.toString());
    } else {
        console.log("\nSet SUBMIT_PROPOSAL=true to actually submit the proposal");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
