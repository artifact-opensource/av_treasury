const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

async function main() {
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";

  console.log("🔷 Deploying DexSimulator");
  const DS = await ethers.getContractFactory("contracts/av_suite/DexSimulator.sol:DexSimulator");
  const ds = await DS.deploy(AG, AU);
  await ds.deployed();
  console.log("✅ DexSimulator:", ds.address);

  d.DexSimulator = { proxy: ds.address, impl: ds.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  await new Promise(r => setTimeout(r, 30000));

  console.log("🔍 Verifying DexSimulator...");
  try {
    await require("hardhat").run("verify:verify", { address: ds.address, constructorArguments: [AG, AU] });
    console.log("✅ DexSimulator verified");
    d.DexSimulator.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch(e) {
    console.log("⚠️ Verify:", e.message.split('\n')[0]);
  }

  // Final summary
  console.log("\n" + "═".repeat(60));
  console.log("  🎉 ALL DEPLOYMENTS COMPLETE");
  console.log("═".repeat(60));
  const final = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  for (const [name, info] of Object.entries(final)) {
    if (name === "OnChainBase64" || name === "QuasiCrystalSVG") continue;
    const addr = info.proxy || info;
    const v = info.verified ? "✅" : "⏳";
    console.log(`  ${v} ${name.padEnd(25)} ${addr}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
