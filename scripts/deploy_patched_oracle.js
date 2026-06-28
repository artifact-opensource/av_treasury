const { ethers } = require("hardhat");

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

  if (bal.lt(ethers.utils.parseEther("0.001"))) {
    console.log("ERROR: Need at least 0.001 ETH");
    process.exit(1);
  }

  // Step 1: Deploy with deployer as admin
  console.log("\n1. Deploying AvOracle v3 (patched)...");
  const factory = await ethers.getContractFactory("AvOracle");
  const oracle = await factory.connect(deployer).deploy(AU, AG, deployerAddr, deployerAddr);
  await oracle.deployed();
  console.log("   Oracle:", oracle.address);

  // Step 2: Configure TWAP pool for AU
  console.log("2. Configuring TWAP pool for AU...");
  const tx1 = await oracle.connect(deployer).configureTwapPool(AU, AU_POOL, AU, WETH, 600, true);
  await tx1.wait();
  console.log("   Done.");

  // Step 3: Initialize TWAP
  console.log("3. Initializing TWAP for AU...");
  const tx2 = await oracle.connect(deployer).initializeTwap(AU);
  await tx2.wait();
  console.log("   Done.");

  // Step 4: Call updatePrice to seed cached price
  console.log("4. Calling updatePrice(AU)...");
  const tx3 = await oracle.connect(deployer).updatePrice(AU);
  await tx3.wait();
  console.log("   Done.");

  // Step 5: Verify getPrice works
  console.log("5. Verifying getPrice(AU)...");
  try {
    const [price, dec] = await oracle.getPrice(AU);
    console.log("   getPrice(AU):", ethers.utils.formatUnits(price, dec), "decimals:", dec);
  } catch(e) {
    console.log("   getPrice(AU) FAILED:", e.message.slice(0,80));
  }

  // Step 6: Transfer admin roles to Safe
  console.log("6. Transferring admin to Safe...");
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const tx4 = await oracle.connect(deployer).grantRole(ORACLE_ADMIN, SAFE);
  await tx4.wait();
  const tx5 = await oracle.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, SAFE);
  await tx5.wait();
  const tx6 = await oracle.connect(deployer).revokeRole(ORACLE_ADMIN, deployerAddr);
  await tx6.wait();
  console.log("   Safe is now admin.");

  // Final state
  const hasAdmin = await oracle.hasRole(ORACLE_ADMIN, SAFE);
  console.log("\n=== COMPLETE ===");
  console.log("Oracle:", oracle.address);
  console.log("Safe is ORACLE_ADMIN:", hasAdmin);
  console.log("Verify:");
  console.log("npx hardhat verify --network base", oracle.address, AU, AG, deployerAddr, deployerAddr);
}
main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
