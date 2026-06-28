const { ethers } = require("hardhat");

// Patched AvOracle with TWAP-as-primary support
// Deploys with Safe as admin, configures AU TWAP pool, calls updatePrice(AU)

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AU_POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const WETH = "0x4200000000000000000000000000000000000006";

  const deployer = (await ethers.getSigners())[0];
  const deployerAddr = await deployer.getAddress();
  const bal = await ethers.provider.getBalance(deployerAddr);

  console.log("Deployer:", deployerAddr);
  console.log("Balance:", ethers.utils.formatEther(bal), "ETH");

  if (bal.lt(ethers.utils.parseEther("0.005"))) {
    console.log("ERROR: Need at least 0.005 ETH for deployment gas");
    process.exit(1);
  }

  console.log("\n1. Deploying AvOracle v3 (patched)...");
  const factory = await ethers.getContractFactory("AvOracle");
  const oracle = await factory.connect(deployer).deploy(AU, AG, SAFE, SAFE);
  await oracle.deployed();
  console.log("   Oracle:", oracle.address);

  console.log("2. Configuring TWAP pool for AU...");
  const tx1 = await oracle.connect(deployer).configureTwapPool(AU, AU_POOL, AU, WETH, 600, true);
  await tx1.wait();

  console.log("3. Initializing TWAP for AU...");
  const tx2 = await oracle.connect(deployer).initializeTwap(AU);
  await tx2.wait();

  console.log("4. Calling updatePrice(AU)...");
  const tx3 = await oracle.connect(deployer).updatePrice(AU);
  await tx3.wait();

  console.log("5. Verifying getPrice(AU)...");
  try {
    const [price, dec] = await oracle.getPrice(AU);
    console.log("   getPrice(AU):", ethers.utils.formatUnits(price, dec), "decimals:", dec);
  } catch(e) {
    console.log("   getPrice(AU) FAILED:", e.message.slice(0,60));
  }

  console.log("6. Verifying getTwapPrice(AU)...");
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("   getTwapPrice(AU):", price.toString());
  } catch(e) {
    console.log("   getTwapPrice(AU) FAILED");
  }

  console.log("\n=== COMPLETE ===");
  console.log("Oracle:", oracle.address);
  console.log("Verify command:");
  console.log("npx hardhat verify --network base", oracle.address, AU, AG, SAFE, SAFE);
}
main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
