/**
 * Deploy OracleWrapper + TreasuryFlashBuy_v2
 * 
 * Usage: npx hardhat run scripts/deploy_oracle_wrapper_v2.js --network base
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Parse address.book — extracts "Key: Value" lines
 */
function parseAddressBook(content) {
  const addresses = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed === "") continue;
    // Match "Key: Value" or "- Key: Value" patterns
    // Key can include spaces, parentheses, etc.
    const match = trimmed.match(/^(?:-\s+)?(.+?):\s*(0x[a-fA-F0-9]+)/);
    if (match) {
      const key = match[1].trim();
      addresses[key] = match[2];
    }
  }
  return addresses;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const bal = await deployer.getBalance();
  console.log("Balance:", bal.toString(), "wei");

  // Load addresses
  const addressBookPath = path.join(__dirname, "..", "address.book");
  const addressBookContent = fs.readFileSync(addressBookPath, "utf8");
  const addresses = parseAddressBook(addressBookContent);

  console.log("\n--- Loaded Addresses ---");
  for (const [key, val] of Object.entries(addresses)) {
    console.log(`  ${key}: ${val}`);
  }

  // Validate required addresses
  const required = [
    "AvOracle (active)",
    "TreasuryAMO",
    "TreasuryFlashBuy",
    "AuToken Proxy",
    "Treasury Safe",
    "Slipstream Router"
  ];
  for (const req of required) {
    if (!addresses[req]) throw new Error(`Missing required address: ${req}`);
  }

  // Deploy OracleWrapper
  console.log("\n--- Deploying OracleWrapper ---");
  const OracleWrapper = await hre.ethers.getContractFactory("OracleWrapper");
  const oracleWrapper = await OracleWrapper.deploy(
    addresses["AvOracle (active)"],   // AvOracle v5
    addresses["TreasuryAMO"],         // TreasuryAMO
    addresses["TreasuryFlashBuy"],    // Old FlashBuy (for reference)
    500,                              // deviationThreshold: 5% (500 bps)
    3600                              // maxStaleness: 1 hour
  );
  const oracleWrapperAddr = oracleWrapper.address;
  console.log("OracleWrapper deployed to:", oracleWrapperAddr);
  console.log("Waiting for confirmations...");
  await oracleWrapper.deployTransaction.wait(2);

  // Set AuToken address in OracleWrapper
  console.log("Setting Au token address...");
  const AU_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
  const setToken = await oracleWrapper.setTokenAddress(AU_KEY, addresses["AuToken Proxy"]);
  await setToken.wait();
  console.log("AuToken set in OracleWrapper:", addresses["AuToken"]);

  // Set reference price for Au = $1.00
  console.log("Setting Au reference price to $1.00...");
  const setRef = await oracleWrapper.setReferencePrice(
    AU_KEY,
    hre.ethers.utils.parseEther("1.0")
  );
  await setRef.wait();
  console.log("Au reference price set to $1.00");

  // Enable FlashBuy trigger
  console.log("Enabling FlashBuy trigger...");
  const enableFB = await oracleWrapper.setFlashBuyEnabled(true);
  await enableFB.wait();
  console.log("FlashBuy trigger enabled");

  // USDC on Base mainnet
  const usdcAddr = "0x833589c5cD18E6532d07a2e87A1d6C2E1d2E0980";
  console.log("USDC (Base mainnet):", usdcAddr);

  // Deploy TreasuryFlashBuy_v2
  console.log("\n--- Deploying TreasuryFlashBuy_v2 ---");
  const FlashBuyV2 = await hre.ethers.getContractFactory("OracleFlashBuy");
  const flashBuyV2 = await FlashBuyV2.deploy(
    addresses["Treasury Safe"],       // Treasury Safe
    addresses["AuToken Proxy"],      // Au token
    usdcAddr,                        // USDC from TreasuryAMO
    addresses["Slipstream Router"],  // DEX router
    oracleWrapperAddr,               // OracleWrapper address
    "1000000000",  // maxBuybackPerExecution: 1000 USDC (1000 * 1e6)
    3600                             // cooldown: 1 hour
  );
  const flashBuyV2Addr = flashBuyV2.address;
  console.log("TreasuryFlashBuy_v2 deployed to:", flashBuyV2Addr);
  console.log("Waiting for confirmations...");
  await flashBuyV2.deployTransaction.wait(2);
  console.log("TreasuryFlashBuy_v2 deployed to:", flashBuyV2Addr);

  // Update address.book
  console.log("\n--- Updating address.book ---");
  const newEntries = `

## ORACLE WRAPPER + FLASHBUY V2 DEPLOYMENT (${new Date().toISOString()})
OracleWrapper: ${oracleWrapperAddr}
TreasuryFlashBuy_v2: ${flashBuyV2Addr}
- OracleWrapper deviation threshold: 5% (500 bps)
- OracleWrapper max staleness: 3600s (1 hour)
- OracleWrapper Au reference price: $1.00
- FlashBuy_v2 trigger: 98% of $1.00 ($0.98)
- FlashBuy_v2 max buyback: 1000 USDC per execution
- FlashBuy_v2 cooldown: 3600s (1 hour)
- FlashBuy_v2 oracle source: OracleWrapper
`;

  fs.appendFileSync(addressBookPath, newEntries);
  console.log("address.book updated");

  // Verification summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("OracleWrapper:        ", oracleWrapperAddr);
  console.log("  AvOracle:           ", addresses["AvOracle (active)"]);
  console.log("  TreasuryAMO:        ", addresses["TreasuryAMO"]);
  console.log("  AuToken:            ", addresses["AuToken Proxy"]);
  console.log("TreasuryFlashBuy_v2: ", flashBuyV2Addr);
  console.log("  Treasury:           ", addresses["Treasury Safe"]);
  console.log("  AuToken:            ", addresses["AuToken Proxy"]);
  console.log("  USDC:               ", usdcAddr, "(from TreasuryAMO)");
  console.log("  Router:             ", addresses["Slipstream Router"]);
  console.log("  OracleWrapper:      ", oracleWrapperAddr);

  console.log("\n✅ Deployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
