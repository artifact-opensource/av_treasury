const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

async function verify(name, address, args) {
  console.log(`🔍 Verifying ${name}...`);
  try {
    await require("hardhat").run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ ${name} verified`);
    return true;
  } catch (e) {
    console.log(`⚠️ ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";

  // ═══ STEP 3: PID_Emission_Controller_v2 ═══
  if (!d.PID_Emission_Controller_v2) {
    console.log("\n🔷 STEP 3: PID_Emission_Controller_v2");
    const PID = await ethers.getContractFactory("PID_Emission_Controller_v2");
    const pid = await PID.deploy(
      TREASURY, d.AVLPStaking_v2.proxy, AG,
      ethers.utils.parseEther("10000000"),
      ethers.utils.parseEther("0.0001"),
      ethers.utils.parseEther("0.00001"),
      ethers.utils.parseEther("0.00005")
    );
    await pid.deployed();
    console.log("✅ PID:", pid.address);
    d.PID_Emission_Controller_v2 = { proxy: pid.address, impl: pid.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("PID", pid.address, [
      TREASURY, d.AVLPStaking_v2.proxy, AG,
      ethers.utils.parseEther("10000000"),
      ethers.utils.parseEther("0.0001"),
      ethers.utils.parseEther("0.00001"),
      ethers.utils.parseEther("0.00005"),
    ]);
    if (v) d.PID_Emission_Controller_v2.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  }

  // ═══ STEP 4: ArtifactTimelock ═══
  if (!d.ArtifactTimelock) {
    console.log("\n🔷 STEP 4: ArtifactTimelock");
    const TL = await ethers.getContractFactory("ArtifactTimelock");
    const tl = await TL.deploy(TREASURY, TREASURY, TREASURY);
    await tl.deployed();
    console.log("✅ Timelock:", tl.address);
    d.ArtifactTimelock = { proxy: tl.address, impl: tl.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("Timelock", tl.address, [TREASURY, TREASURY, TREASURY]);
    if (v) d.ArtifactTimelock.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  }

  // ═══ STEP 5: GovernorContract ═══
  if (!d.GovernorContract) {
    console.log("\n🔷 STEP 5: GovernorContract");
    const G = await ethers.getContractFactory("GovernorContract");
    const g = await G.deploy(AG, d.ArtifactTimelock.proxy);
    await g.deployed();
    console.log("✅ Governor:", g.address);
    d.GovernorContract = { proxy: g.address, impl: g.address, verified: false };
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("Governor", g.address, [AG, d.ArtifactTimelock.proxy]);
    if (v) d.GovernorContract.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  }

  // ═══ STEP 6: FlashLoan ═══
  if (!d.FlashLoan) {
    console.log("\n🔷 STEP 6: FlashLoan");
    const ROUTER = process.env.AERODROME_ROUTER_ADDRESS || ethers.constants.AddressZero;
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
  }

  // ═══ STEP 7: TreasuryFlashBuy ═══
  if (!d.TreasuryFlashBuy) {
    console.log("\n🔷 STEP 7: TreasuryFlashBuy");
    const ROUTER = process.env.AERODROME_ROUTER_ADDRESS || ethers.constants.AddressZero;
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
  }

  // ═══ SUMMARY ═══
  console.log("\n" + "═".repeat(60));
  console.log("  🎉 REMAINING DEPLOYMENTS COMPLETE");
  console.log("═".repeat(60));
  const final = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  const entries = [
    ["QuasiCrystalLPNFT", final.QuasiCrystalLPNFT?.proxy],
    ["AVLPStaking_v2", final.AVLPStaking_v2?.proxy],
    ["PID", final.PID_Emission_Controller_v2?.proxy],
    ["Timelock", final.ArtifactTimelock?.proxy],
    ["Governor", final.GovernorContract?.proxy],
    ["FlashLoan", final.FlashLoan?.proxy],
    ["FlashBuy", final.TreasuryFlashBuy?.proxy],
    ["Oracle", final.AvOracle?.proxy],
    ["DexSimulator", final.DexSimulator?.proxy],
  ];
  for (const [name, addr] of entries) {
    console.log(`  ${name.padEnd(25)} ${addr}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
