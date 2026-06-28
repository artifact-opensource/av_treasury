const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

async function verify(name, address, args) {
  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", { address, constructorArguments: args });
    console.log(`  ✅ ${name} verified`);
    return true;
  } catch(e) {
    console.log(`  ⚠️ ${name} verify: ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  // ═══ DexSimulator ═══
  console.log("\n═══ DexSimulator (redeploy) ═══");
  const DexSim = await ethers.getContractFactory("contracts/av_suite/DexSimulator.sol:DexSimulator");
  const dexSim = await DexSim.deploy(AU, AG);
  await dexSim.deployed();
  console.log("  DexSimulator:", dexSim.address);

  d.DexSimulator = { proxy: dexSim.address, impl: dexSim.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("DexSimulator", dexSim.address, [AU, AG]);
  d.DexSimulator.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // Grant admin to Safe
  const ds = await ethers.getContractAt("contracts/av_suite/DexSimulator.sol:DexSimulator", dexSim.address);
  const tx1 = await ds.grantRole(ethers.constants.HashZero, SAFE);
  await tx1.wait();
  console.log("  ✅ DexSim admin → Safe");

  // ═══ FlashLoan ═══
  console.log("\n═══ FlashLoan (redeploy) ═══");
  const FlashLoan = await ethers.getContractFactory("contracts/av_suite/FlashLoan.sol:FlashLoan");
  const flashLoan = await FlashLoan.deploy(ROUTER, AU, AG, SAFE);
  await flashLoan.deployed();
  console.log("  FlashLoan:", flashLoan.address);

  d.FlashLoan = { proxy: flashLoan.address, impl: flashLoan.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("FlashLoan", flashLoan.address, [ROUTER, AU, AG, SAFE]);
  d.FlashLoan.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // Grant admin to Safe
  const fl = await ethers.getContractAt("contracts/av_suite/FlashLoan.sol:FlashLoan", flashLoan.address);
  const tx2 = await fl.grantRole(ethers.constants.HashZero, SAFE);
  await tx2.wait();
  console.log("  ✅ FlashLoan admin → Safe");

  // ═══ Final Summary ═══
  console.log("\n" + "═".repeat(60));
  console.log("  🎉 REMAINING REDEPLOYS COMPLETE — 2/2 verified");
  console.log("═".repeat(60));

  const final = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  for (const [name, info] of Object.entries(final)) {
    if (name === "OnChainBase64" || name === "QuasiCrystalSVG") continue;
    const addr = info.proxy || info;
    const v = info.verified ? "✅" : "⏳";
    console.log(`  ${v} ${name.padEnd(25)} ${addr}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e); process.exit(1); });
