// Deploy AgToken, AuToken, and QuasiCrystalLPNFT to Base mainnet
// Deployer: 0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E
// Verify with Etherscan V2 API (basescan.org)
//
// Manually deploys UUPS proxies (no hardhat-upgrades plugin needed)

const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("---");

  if (deployer.address.toLowerCase() !== "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E".toLowerCase()) {
    throw new Error("Wrong deployer! Expected 0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E");
  }

  const addresses = {};

  // ============================================
  // 1. Deploy QuasiCrystalSVG library
  // ============================================
  console.log("\n[1/5] Deploying QuasiCrystalSVG library...");
  const QuasiCrystalSVG = await ethers.getContractFactory("contracts/av_suite/QuasiCrystalSVG.sol:QuasiCrystalSVG");
  const svgLib = await QuasiCrystalSVG.deploy();
  await svgLib.deployed();
  console.log("QuasiCrystalSVG deployed to:", svgLib.address);
  addresses.QuasiCrystalSVG = svgLib.address;

  // ============================================
  // 2. Deploy AgToken (implementation + UUPS proxy)
  // ============================================
  console.log("\n[2/5] Deploying AgToken...");
  const AgToken = await ethers.getContractFactory("contracts/av_suite/AgToken.sol:AgToken");
  const agImpl = await AgToken.deploy();
  await agImpl.deployed();
  console.log("AgToken implementation:", agImpl.address);
  
  // Wait for implementation to be mined
  console.log("  Waiting for implementation to be mined...");
  await agImpl.deployTransaction.wait(2);

  // Encode initialize(admin) call
  const agInitData = agImpl.interface.encodeFunctionData("initialize", [deployer.address]);
  
  // Deploy proxy with explicit gas limit
  const ProxyHelper = await ethers.getContractFactory("ProxyHelper");
  const agProxy = await ProxyHelper.deploy(agImpl.address, agInitData, {
    gasLimit: 500000,
  });
  await agProxy.deployed();
  console.log("AgToken proxy deployed to:", agProxy.address);
  addresses.AgToken = agProxy.address;
  addresses.AgTokenImpl = agImpl.address;

  // ============================================
  // 3. Deploy AuToken (implementation + UUPS proxy)
  // ============================================
  console.log("\n[3/5] Deploying AuToken...");
  const AuToken = await ethers.getContractFactory("contracts/av_suite/AuToken.sol:AuToken");
  const auImpl = await AuToken.deploy();
  await auImpl.deployed();
  console.log("AuToken implementation:", auImpl.address);
  
  // Wait for implementation to be mined
  console.log("  Waiting for implementation to be mined...");
  await auImpl.deployTransaction.wait(2);

  // Encode initialize(treasury) call
  const auInitData = auImpl.interface.encodeFunctionData("initialize", [deployer.address]);
  
  // Deploy proxy with explicit gas limit
  const auProxy = await ProxyHelper.deploy(auImpl.address, auInitData, {
    gasLimit: 500000,
  });
  await auProxy.deployed();
  console.log("AuToken proxy deployed to:", auProxy.address);
  addresses.AuToken = auProxy.address;
  addresses.AuTokenImpl = auImpl.address;

  // ============================================
  // 4. Deploy QuasiCrystalLPNFT (linked to SVG library)
  // ============================================
  console.log("\n[4/5] Deploying QuasiCrystalLPNFT...");
  const QuasiCrystalLPNFT = await ethers.getContractFactory("QuasiCrystalLPNFT", {
    libraries: { QuasiCrystalSVG: svgLib.address },
  });
  const nft = await QuasiCrystalLPNFT.deploy(
    "QuasiCrystal LP",
    "QCLP",
    deployer.address,
    deployer.address,
    deployer.address
  );
  await nft.deployed();
  console.log("QuasiCrystalLPNFT deployed to:", nft.address);
  addresses.QuasiCrystalLPNFT = nft.address;

  // ============================================
  // 5. Save addresses
  // ============================================
  const outPath = path.join(__dirname, "..", "deployed_tokens.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to:", outPath);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`  ${name}: ${addr}`);
  }
  console.log("=========================================");

  // ============================================
  // 6. Verify contracts one by one (Etherscan V2 API)
  // ============================================
  console.log("\n--- Starting verification ---");

  // Wait for confirmations
  console.log("Waiting for block confirmations...");
  await svgLib.deployTransaction.wait(5);
  await agImpl.deployTransaction.wait(5);
  await agProxy.deployTransaction.wait(5);
  await auImpl.deployTransaction.wait(5);
  await auProxy.deployTransaction.wait(5);
  await nft.deployTransaction.wait(5);

  // Verify QuasiCrystalSVG (library)
  console.log("\n[Verifying QuasiCrystalSVG...]");
  try {
    await run("verify:verify", {
      address: svgLib.address,
      constructorArguments: [],
      noCompile: true,
    });
    console.log("  ✅ QuasiCrystalSVG verified");
  } catch (e) {
    console.log("  ❌ QuasiCrystalSVG verification failed:", e.message);
  }

  // Verify AgToken proxy (as ProxyHelper / ERC1967Proxy)
  console.log("\n[Verifying AgToken proxy...]");
  try {
    await run("verify:verify", {
      address: agProxy.address,
      constructorArguments: [agImpl.address, agInitData],
      noCompile: true,
    });
    console.log("  ✅ AgToken proxy verified");
  } catch (e) {
    console.log("  ❌ AgToken proxy verification failed:", e.message);
  }

  // Verify AgToken implementation
  console.log("\n[Verifying AgToken implementation...]");
  try {
    await run("verify:verify", {
      address: agImpl.address,
      constructorArguments: [],
      noCompile: true,
    });
    console.log("  ✅ AgToken implementation verified");
  } catch (e) {
    console.log("  ❌ AgToken verification failed:", e.message);
  }

  // Verify AuToken proxy (as ProxyHelper / ERC1967Proxy)
  console.log("\n[Verifying AuToken proxy...]");
  try {
    await run("verify:verify", {
      address: auProxy.address,
      constructorArguments: [auImpl.address, auInitData],
      noCompile: true,
    });
    console.log("  ✅ AuToken proxy verified");
  } catch (e) {
    console.log("  ❌ AuToken proxy verification failed:", e.message);
  }

  // Verify AuToken implementation
  console.log("\n[Verifying AuToken implementation...]");
  try {
    await run("verify:verify", {
      address: auImpl.address,
      constructorArguments: [],
      noCompile: true,
    });
    console.log("  ✅ AuToken implementation verified");
  } catch (e) {
    console.log("  ❌ AuToken verification failed:", e.message);
  }

  // Verify QuasiCrystalLPNFT
  console.log("\n[Verifying QuasiCrystalLPNFT...]");
  try {
    await run("verify:verify", {
      address: nft.address,
      constructorArguments: [
        "QuasiCrystal LP",
        "QCLP",
        deployer.address,
        deployer.address,
        deployer.address,
      ],
      noCompile: true,
    });
    console.log("  ✅ QuasiCrystalLPNFT verified");
  } catch (e) {
    console.log("  ❌ QuasiCrystalLPNFT verification failed:", e.message);
  }

  console.log("\n--- Verification complete ---");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
