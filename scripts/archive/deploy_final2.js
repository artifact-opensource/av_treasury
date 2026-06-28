const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

async function verify(name, address, args) {
  try {
    await require("hardhat").run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ ${name} verified`);
    return true;
  } catch (e) {
    console.log(`⚠️ ${name}: ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  // Use the known Aerodrome Slipstream router
  const ROUTER = "0x9bD062f6E0270601D044c3f0A1B4636F384d7A37";

  // ═══ STEP 6: FlashLoan ═══
  if (!d.FlashLoan) {
    console.log("\n🔷 STEP 6: FlashLoan");
    const FL = await ethers.getContractFactory("FlashLoan");
    const fl = await FL.deploy(ROUTER, TREASURY, AG, AU);
    await fl.deployed();
    console.log("✅ FlashLoan:", fl.address);
    d.FlashLoan = { proxy: fl.address, impl: fl.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("FlashLoan", fl.address, [ROUTER, TREASURY, AG, AU]);
    if (v) d.FlashLoan.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } else {
    console.log(`\n  ⏭️ FlashLoan: ${d.FlashLoan.proxy}`);
  }

  // ═══ STEP 7: TreasuryFlashBuy ═══
  if (!d.TreasuryFlashBuy) {
    console.log("\n🔷 STEP 7: TreasuryFlashBuy");
    const FB = await ethers.getContractFactory("TreasuryFlashBuy");
    const fb = await FB.deploy(ROUTER, TREASURY, AG, AU);
    await fb.deployed();
    console.log("✅ FlashBuy:", fb.address);
    d.TreasuryFlashBuy = { proxy: fb.address, impl: fb.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("FlashBuy", fb.address, [ROUTER, TREASURY, AG, AU]);
    if (v) d.TreasuryFlashBuy.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } else {
    console.log(`\n  ⏭️ FlashBuy: ${d.TreasuryFlashBuy.proxy}`);
  }

  // ═══ STEP 8: AvOracle ═══
  if (!d.AvOracle) {
    console.log("\n🔷 STEP 8: AvOracle");
    const Oracle = await ethers.getContractFactory("AvOracle");
    const oracle = await Oracle.deploy(AU, AG, TREASURY, d.GovernorContract.proxy);
    await oracle.deployed();
    console.log("✅ Oracle:", oracle.address);
    d.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("Oracle", oracle.address, [AU, AG, TREASURY, d.GovernorContract.proxy]);
    if (v) d.AvOracle.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } else {
    console.log(`\n  ⏭️ Oracle: ${d.AvOracle.proxy}`);
  }

  // ═══ STEP 9: DexSimulator ═══
  if (!d.DexSimulator) {
    console.log("\n🔷 STEP 9: DexSimulator");
    const DS = await ethers.getContractFactory("DexSimulator");
    const ds = await DS.deploy(AG, AU);
    await ds.deployed();
    console.log("✅ DexSimulator:", ds.address);
    d.DexSimulator = { proxy: ds.address, impl: ds.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("DexSimulator", ds.address, [AG, AU]);
    if (v) d.DexSimulator.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } else {
    console.log(`\n  ⏭️ DexSimulator: ${d.DexSimulator.proxy}`);
  }

  // ═══ FINAL SUMMARY ═══
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
