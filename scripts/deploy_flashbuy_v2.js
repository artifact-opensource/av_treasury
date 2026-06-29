/**
 * Deploy OracleFlashBuy with correct USDC address
 * 
 * Usage: npx hardhat run scripts/deploy_flashbuy_v2.js --network base
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function parseAddressBook(content) {
  const addresses = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed === "") continue;
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

  const addressBookPath = path.join(__dirname, "..", "address.book");
  const addressBookContent = fs.readFileSync(addressBookPath, "utf8");
  const addresses = parseAddressBook(addressBookContent);

  // USDC on Base mainnet
  const usdcAddr = "0x833589c5cD18E6532d07a2e87A1d6C2E1d2E0980";
  console.log("USDC (Base mainnet):", usdcAddr);

  // Deploy OracleFlashBuy
  console.log("\n--- Deploying OracleFlashBuy ---");
  const OracleFlashBuy = await hre.ethers.getContractFactory("OracleFlashBuy");
  const flashBuy = await OracleFlashBuy.deploy(
    addresses["Treasury Safe"],       // Treasury Safe
    addresses["AuToken Proxy"],      // Au token
    usdcAddr,                        // USDC
    addresses["Slipstream Router"],  // DEX router
    addresses["OracleWrapper"],      // OracleWrapper address
    "1000000000",                    // maxBuybackPerExecution: 1000 USDC (1000 * 1e6)
    3600                             // cooldown: 1 hour
  );
  const flashBuyAddr = flashBuy.address;
  console.log("OracleFlashBuy deployed to:", flashBuyAddr);
  console.log("Waiting for confirmations...");
  await flashBuy.deployTransaction.wait(2);

  // Update address.book
  const newEntries = `

## ORACLE FLASHBUY DEPLOYMENT (${new Date().toISOString()})
OracleFlashBuy: ${flashBuyAddr}
- OracleFlashBuy trigger: 98% of $1.00 ($0.98)
- OracleFlashBuy max buyback: 1000 USDC per execution
- OracleFlashBuy cooldown: 3600s (1 hour)
- OracleFlashBuy oracle source: OracleWrapper
- OracleFlashBuy USDC: ${usdcAddr}
`;

  fs.appendFileSync(addressBookPath, newEntries);
  console.log("address.book updated");

  console.log("\n✅ OracleFlashBuy deployment complete!");
  console.log("OracleFlashBuy:", flashBuyAddr);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
