/**
 * Oracle Keeper — Monitors oracle price and validates system health
 * 
 * This keeper runs periodically (e.g., every 15 minutes) to:
 * 1. Read Au price from AvOracle
 * 2. Validate TreasuryAMO TWAP price against oracle
 * 3. Record price on OracleGuardian for change tracking
 * 4. Trigger emergency pause if deviation exceeds threshold
 * 
 * This is the "exit ramp" for the oracle highway — the keeper is the
 * bridge between the oracle (on-chain but unused) and the system (needs prices).
 * 
 * Run with: node scripts/oracle_keeper.js
 * Or via cron: */15 * * * * cd /home/adam/workspace/av_treasury && node scripts/oracle_keeper.js
 */

const { ethers } = require("hardhat");

// ─── Configuration ───────────────────────────────────────────────────────
const CONFIG = {
    oracleGuardian: process.env.ORACLE_GUARDIAN || "0x...",
    treasuryAMO: process.env.TREASURY_AMO || "0x...",
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    pollIntervalMs: 15 * 60 * 1000, // 15 minutes
    maxDeviationBps: 500, // 5% — emergency pause threshold
    logFile: "/var/log/av_oracle/keeper.log"
};

// ─── ABIs ─────────────────────────────────────────────────────────────────
const ORACLE_GUARDIAN_ABI = [
    "function getAuPrice() view returns (uint256)",
    "function validateTwapPrice(uint256) view returns (bool valid, uint256 deviationBps)",
    "function recordPrice()",
    "function setEmergencyPause(bool)",
    "function oracleActive() view returns (bool)",
    "function emergencyPaused() view returns (bool)",
    "function lastRecordedPrice() view returns (uint256)",
    "event PriceRecorded(address indexed token, uint256 price, uint256 timestamp)",
    "event DeviationExceeded(uint256 twapPrice, uint256 oraclePrice, uint256 deviationBps)"
];

const TREASURY_AMO_ABI = [
    "function twapPrice() view returns (uint256)",
    "function twapLastUpdate() view returns (uint256)",
    "function twapWindow() view returns (uint256)",
    "function emergencyPause()",
    "function paused() view returns (bool)"
];

// ─── Main Keeper Loop ─────────────────────────────────────────────────────
async function runKeeper() {
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
    const signer = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, provider);
    
    const guardian = new ethers.Contract(CONFIG.oracleGuardian, ORACLE_GUARDIAN_ABI, signer);
    const amo = new ethers.Contract(CONFIG.treasuryAMO, TREASURY_AMO_ABI, signer);
    
    console.log(`[${new Date().toISOString()}] Oracle Keeper started`);
    console.log(`  Guardian: ${CONFIG.oracleGuardian}`);
    console.log(`  AMO: ${CONFIG.treasuryAMO}`);
    console.log(`  Keeper: ${signer.address}`);
    
    while (true) {
        try {
            await checkAndValidate(guardian, amo);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error:`, err.message);
        }
        
        await sleep(CONFIG.pollIntervalMs);
    }
}

async function checkAndValidate(guardian, amo) {
    // 1. Check if oracle is active
    const active = await guardian.oracleActive();
    if (!active) {
        console.log(`[${new Date().toISOString()}] Oracle not active, skipping`);
        return;
    }
    
    // 2. Get oracle price
    const oraclePrice = await guardian.getAuPrice();
    if (oraclePrice.eq(0)) {
        console.log(`[${new Date().toISOString()}] ⚠️ Oracle returned 0 price — stale or error`);
        return;
    }
    console.log(`[${new Date().toISOString()}] Oracle Au price: ${ethers.utils.formatUnits(oraclePrice, 18)}`);
    
    // 3. Get AMO TWAP price
    const twapPrice = await amo.twapPrice();
    if (twapPrice.eq(0)) {
        console.log(`[${new Date().toISOString()}] TWAP price is 0 — not initialized`);
        return;
    }
    console.log(`[${new Date().toISOString()}] AMO TWAP price: ${ethers.utils.formatUnits(twapPrice, 18)}`);
    
    // 4. Validate TWAP against oracle
    const [valid, deviationBps] = await guardian.validateTwapPrice(twapPrice);
    console.log(`[${new Date().toISOString()}] Validation: valid=${valid}, deviation=${deviationBps.toNumber() / 100}%`);
    
    // 5. Record price on guardian
    try {
        const tx = await guardian.recordPrice();
        await tx.wait();
        console.log(`[${new Date().toISOString()}] Price recorded on-chain`);
    } catch (err) {
        if (err.reason?.includes("PriceChangeTooHigh")) {
            console.log(`[${new Date().toISOString()}] ⚠️ Price change exceeds max — possible oracle manipulation`);
        } else {
            console.log(`[${new Date().toISOString()}] Record failed: ${err.reason || err.message}`);
        }
    }
    
    // 6. Emergency: if deviation exceeds threshold, pause AMO
    if (!valid && deviationBps.gt(CONFIG.maxDeviationBps)) {
        console.log(`[${new Date().toISOString()}] 🚨 EMERGENCY: Deviation ${deviationBps.toNumber() / 100}% exceeds ${CONFIG.maxDeviationBps / 100}%`);
        
        // Pause oracle guardian
        try {
            const tx = await guardian.setEmergencyPause(true);
            await tx.wait();
            console.log(`[${new Date().toISOString()}] 🛑 OracleGuardian emergency paused`);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to pause: ${err.message}`);
        }
        
        // Note: AMO pause requires governance or PARAM_ROLE
        // The keeper can only flag the issue — governance must pause AMO
        console.log(`[${new Date().toISOString()}] ⚠️ Governance action required: Pause TreasuryAMO`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Entry Point ──────────────────────────────────────────────────────────
if (require.main === module) {
    if (!process.env.KEEPER_PRIVATE_KEY) {
        console.error("Set KEEPER_PRIVATE_KEY env var");
        process.exit(1);
    }
    runKeeper();
}

module.exports = { runKeeper, checkAndValidate };
