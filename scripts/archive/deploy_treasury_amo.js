const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const [deployer] = await ethers.getSigners();

  console.log("🔷 Deploying TreasuryAMO");
  console.log("  AU Token:", AU);
  console.log("  Reserve (WETH):", WETH);
  console.log("  Aerodrome Router:", AERODROME_ROUTER);
  console.log("  Admin (deployer):", deployer.address);

  const TAMO = await ethers.getContractFactory("TreasuryAMO");
  const tamo = await TAMO.deploy(AU, WETH, AERODROME_ROUTER, deployer.address);
  await tamo.deployed();
  console.log("✅ TreasuryAMO:", tamo.address);

  d.TreasuryAMO = { proxy: tamo.address, impl: tamo.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  await new Promise(r => setTimeout(r, 30000));
  console.log("🔍 Verifying TreasuryAMO...");
  try {
    await require("hardhat").run("verify:verify", {
      address: tamo.address,
      constructorArguments: [AU, WETH, AERODROME_ROUTER, deployer.address]
    });
    console.log("✅ TreasuryAMO verified");
    d.TreasuryAMO.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch(e) {
    console.log("⚠️ Verify:", e.message.split('\n')[0]);
  }

  console.log("\n🎉 TreasuryAMO deployment complete!");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
