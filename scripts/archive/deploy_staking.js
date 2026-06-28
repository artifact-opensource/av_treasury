const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const AG_TOKEN = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

  console.log("Deploying AVLPStaking_v2 (Upgradeable)...");
  const Factory = await ethers.getContractFactory("AVLPStaking_v2");
  const proxy = await upgrades.deployProxy(Factory, [AG_TOKEN, NFT, TREASURY], { kind: "uups" });
  await proxy.deployed();
  const impl = await upgrades.erc1967.getImplementationAddress(proxy.address);
  console.log("✅ AVLPStaking_v2 Proxy:", proxy.address);
  console.log("📦 Implementation:", impl);

  // Save
  const FILE = path.join(__dirname, "..", "deployed_stack.json");
  let data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  data.AVLPStaking_v2 = { proxy: proxy.address, impl: impl, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log("💾 Saved");

  // Wait
  console.log("⏳ Waiting 30s...");
  await new Promise(r => setTimeout(r, 30000));

  // Verify implementation
  console.log("🔍 Verifying implementation...");
  try {
    await require("hardhat").run("verify:verify", { address: impl, constructorArguments: [] });
    console.log("✅ Verified on Etherscan v2");
    data.AVLPStaking_v2.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch(e) {
    console.log("⚠️ Verify failed:", e.message.split('\n')[0]);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
