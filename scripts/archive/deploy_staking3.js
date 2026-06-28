const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const AG_TOKEN = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

  // Deploy implementation
  console.log("Deploying AVLPStaking_v2 implementation...");
  const Impl = await ethers.getContractFactory("AVLPStaking_v2");
  const impl = await Impl.deploy();
  await impl.deployed();
  console.log("✅ Implementation:", impl.address);
  await impl.deployTransaction.wait(5);

  // Encode initialize call
  const initData = impl.interface.encodeFunctionData("initialize", [AG_TOKEN, NFT, TREASURY]);

  // Deploy proxy using ProxyHelper (which allows uninitialized impl)
  console.log("Deploying proxy...");
  const Proxy = await ethers.getContractFactory("ProxyHelper");
  const proxy = await Proxy.deploy(impl.address, initData, { gasLimit: 5000000 });
  await proxy.deployed();
  console.log("✅ Proxy:", proxy.address);

  // Verify proxy works by calling a view function
  const staking = await ethers.getContractAt("AVLPStaking_v2", proxy.address);
  try {
    const owner = await staking.owner();
    console.log("✅ Staking owner:", owner);
    console.log("✅ Initialize worked!");
  } catch(e) {
    console.log("⚠️ Owner call failed:", e.message.split('\n')[0]);
    // Try other methods
    try {
      const paused = await staking.paused();
      console.log("Paused:", paused);
    } catch(e2) {
      console.log("⚠️ Paused call failed:", e2.message.split('\n')[0]);
    }
  }

  // Save
  const FILE = path.join(__dirname, "..", "deployed_stack.json");
  let data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  data.AVLPStaking_v2 = { proxy: proxy.address, impl: impl.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log("💾 Saved");

  // Wait for confirmations
  console.log("⏳ Waiting 30s for verification...");
  await new Promise(r => setTimeout(r, 30000));

  // Verify implementation
  console.log("🔍 Verifying implementation...");
  try {
    await require("hardhat").run("verify:verify", { address: impl.address, constructorArguments: [] });
    console.log("✅ Implementation verified");
    data.AVLPStaking_v2.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch(e) {
    console.log("⚠️ Verify:", e.message.split('\n')[0]);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
