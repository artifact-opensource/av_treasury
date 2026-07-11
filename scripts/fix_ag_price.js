/**
 * fix_ag_price.js  — CORRECTED, minimal fix for the AG deadlock.
 *
 * ROOT CAUSE (verified in deploy_oracle_v5.js):
 *   Oracle deployed as deploy(AU, AG, SAFE, SAFE) → Treasury Safe (0x1082)
 *   is BOTH _admin AND _governor of the LIVE v5 oracle 0xfd04.
 *   The deploy script only ever configured AU (TWAP). AG was never set up,
 *   so getPrice(AG) reverts → OracleWrapper.getOraclePrice(AG) reverts.
 *
 * FIX: setBootstrapPrice(AG, 0.01 * 1e18) on 0xfd04.
 *   setBootstrapPrice is onlyGovernor → Safe (governor) executes it.
 *
 * EXECUTION: build a Gnosis Safe multisig tx, sign with Safe owner
 *   (DEVELOPER_WALLET_PRIVATE_KEY = 0xEc2b = owner#1). With 2-of-2 owners,
 *   the SECOND owner must also sign + execute via the Safe UI / safeService.
 *
 * NO Chainlink. NO XAU/XAG. AU is Aerodrome-TWAP priced. This only sets AG.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const RPC          = process.env.RPC_URL_BASE;
const SAFE_ADDR    = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e"; // governor/admin of oracle
const ORACLE_V5    = "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD"; // LIVE oracle
const AG           = ethers.utils.getAddress("0x1D319893d8354d5772246eD5A3c8f32ceE2a3674".toLowerCase());
const AG_PRICE     = ethers.utils.parseUnits("0.01", 18); // 0.01 as told (yesterday)

const ORACLE_ABI = [
  "function setBootstrapPrice(address token, uint256 price)",
  "function bootstrapPrices(address) view returns (uint256 price, uint8 decimals)",
  "function getPrice(address) view returns (uint256 price, uint8 decimals)",
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const owner = new ethers.Wallet(process.env.DEVELOPER_WALLET_PRIVATE_KEY, provider);
  console.log("Signer (Safe owner#1):", owner.address);

  const oracle = new ethers.Contract(ORACLE_V5, ORACLE_ABI, provider);

  // pre-flight: show current AG state
  try {
    const b = await oracle.bootstrapPrices(AG);
    console.log("AG bootstrapPrice now:", b.price.toString(), "dec:", b.decimals);
  } catch (e) { console.log("AG bootstrapPrices revert (expected):", e.message.slice(0, 50)); }

  const data = oracle.interface.encodeFunctionData("setBootstrapPrice", [AG, AG_PRICE]);
  console.log("\nTarget oracle :", ORACLE_V5, "(LIVE v5)");
  console.log("Safe (governor):", SAFE_ADDR);
  console.log("Calldata       :", data);

  // Build the Safe transaction object (for gnosis-safe SDK / UI import)
  const safeTx = { to: ORACLE_V5, value: "0", data, operation: 0 };
  console.log("\n=== Safe multisig tx ready ===");
  console.log(JSON.stringify(safeTx, null, 2));
  console.log("\nNext steps:");
  console.log("  1. Import/confirm this tx in the Gnosis Safe (0x1082) UI as owner#1.");
  console.log("  2. Owner#2 (0x88dB...) co-signs.");
  console.log("  3. Execute → setBootstrapPrice(AG, 0.01e18) runs as governor.");
  console.log("\nThis script does NOT auto-broadcast (2-of-2 Safe requires 2nd signature).");
  console.log("To fully automate, wire safe-core-sdk + safeService (see safe_configure_oracle.js).");
}

main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
