const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e"; // Same as Safe for now

  console.log("Deploying AvOracle v3 (patched)...");
  const factory = await ethers.getContractFactory("AvOracle");
  const oracle = await factory.deploy(AU, AG, SAFE, GOVERNOR);
  await oracle.deployed();
  console.log("Oracle deployed at:", oracle.address);

  // Configure TWAP pool for AU
  const AU_POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const WETH = "0x4200000000000000000000000000000000000006";

  console.log("Configuring TWAP pool for AU...");
  const tx1 = await oracle.configureTwapPool(AU, AU_POOL, AU, WETH, 600, true);
  await tx1.wait();
  console.log("AU TWAP pool configured");

  // Initialize TWAP
  console.log("Initializing TWAP for AU...");
  const tx2 = await oracle.initializeTwap(AU);
  await tx2.wait();
  console.log("TWAP initialized");

  // Test getTwapPrice
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("getTwapPrice(AU):", price.toString());
  } catch(e) {
    console.log("getTwapPrice(AU) failed:", e.message.slice(0,60));
  }

  // Test updatePrice (should now work with TWAP fallback)
  try {
    const tx3 = await oracle.updatePrice(AU);
    await tx3.wait();
    console.log("updatePrice(AU) success");
  } catch(e) {
    console.log("updatePrice(AU) failed:", e.message.slice(0,60));
  }

  // Test getPrice
  try {
    const [price, dec] = await oracle.getPrice(AU);
    console.log("getPrice(AU):", price.toString(), "decimals:", dec);
  } catch(e) {
    console.log("getPrice(AU) failed:", e.message.slice(0,60));
  }

  console.log("\nDone! Oracle at:", oracle.address);
  console.log("Verify with: npx hardhat verify --network base", oracle.address, AU, AG, SAFE, GOVERNOR);
}
main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
