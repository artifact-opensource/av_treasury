// deploy_full_stack.js — Deploy full treasury stack 1-by-1 with Etherscan v2 verification
// Follows original deploy.js pattern: ERC1967Proxy for staking, plain deploy for everything else.
// Run: npx hardhat run scripts/deploy_full_stack.js --network base

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYED_FILE = path.join(__dirname, "..", "deployed_stack.json");
function load() { if (fs.existsSync(DEPLOYED_FILE)) return JSON.parse(fs.readFileSync(DEPLOYED_FILE, "utf-8")); return {}; }
function save(data) { fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(data, null, 2)); }

async function verify(name, address, args) {
  console.log(`🔍 Verifying ${name}...`);
  try {
    await require("hardhat").run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ ${name} verified on Etherscan v2`);
    return true;
  } catch (e) {
    console.log(`⚠️ ${name} verify: ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.getBalance();

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   FULL STACK DEPLOYMENT — Base Mainnet (1-by-1)         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.utils.formatEther(balance)} ETH\n`);

  // ─── Already Deployed ───────────────────────────────────────
  const EXISTING = {
    agToken: "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    auToken: "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    treasury: "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e",
  };

  console.log("Checking existing deployments...");
  for (const [name, addr] of Object.entries(EXISTING)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`  ${name}: ${addr} → ${code.length > 10 ? '✅' : '❌ NO CODE'}`);
  }

  // ─── CONFIG (from original deploy.js) ───────────────────────
  const CONFIG = {
    TIMELOCK_DELAY: 2 * 24 * 3600,
    PID_TVL_TARGET: ethers.utils.parseEther("10000000"),
    PID_KP: ethers.utils.parseEther("0.0001"),
    PID_KI: ethers.utils.parseEther("0.00001"),
    PID_KD: ethers.utils.parseEther("0.00005"),
  };

  const AERODROME_ROUTER = process.env.AERODROME_ROUTER_ADDRESS || ethers.constants.AddressZero;
  const TREASURY = EXISTING.treasury;
  const d = load();

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: QuasiCrystalLPNFT (+ libraries)
  // ═══════════════════════════════════════════════════════════════
  if (!d.QuasiCrystalLPNFT) {
    console.log("\n\n🔷 STEP 1/10: QuasiCrystalLPNFT");

    // Libraries already deployed earlier this session
    const b64Addr = d.OnChainBase64 || "0x44D47F74728E3e7F8661bcC49524D9702778295C";
    const svgAddr = d.QuasiCrystalSVG || "0xe23F177d09C1C5388104f0369aE91Cc4eA34E528";

    const NFT = await ethers.getContractFactory("QuasiCrystalLPNFT", {
      libraries: { QuasiCrystalSVG: svgAddr },
    });
    const nft = await NFT.deploy("Aerodrome LP NFT", "auLP", TREASURY, TREASURY, TREASURY);
    await nft.deployed();
    console.log("✅ QuasiCrystalLPNFT:", nft.address);
    d.QuasiCrystalLPNFT = { proxy: nft.address, impl: nft.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("QuasiCrystalLPNFT", nft.address, ["Aerodrome LP NFT", "auLP", TREASURY, TREASURY, TREASURY]);
    if (v) d.QuasiCrystalLPNFT.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ QuasiCrystalLPNFT: ${d.QuasiCrystalLPNFT.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: AVLPStaking_v2 (ERC1967Proxy)
  // ═══════════════════════════════════════════════════════════════
  if (!d.AVLPStaking_v2) {
    console.log("\n\n🔷 STEP 2/10: AVLPStaking_v2");

    // Deploy implementation
    console.log("  Deploying implementation...");
    const Impl = await ethers.getContractFactory("AVLPStaking_v2");
    const impl = await Impl.deploy();
    await impl.deployed();
    console.log("  ✅ Implementation:", impl.address);

    // Deploy proxy with initialize data
    console.log("  Deploying proxy...");
    const initData = impl.interface.encodeFunctionData("initialize", [
      EXISTING.agToken,
      d.QuasiCrystalLPNFT.proxy,
      TREASURY,
    ]);
    const Proxy = await ethers.getContractFactory("ProxyHelper");
    const proxy = await Proxy.deploy(impl.address, initData);
    await proxy.deployed();
    console.log("  ✅ Proxy:", proxy.address);

    d.AVLPStaking_v2 = { proxy: proxy.address, impl: impl.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("AVLPStaking_v2_impl", impl.address, []);
    if (v) d.AVLPStaking_v2.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ AVLPStaking_v2: ${d.AVLPStaking_v2.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: PID_Emission_Controller_v2 (plain deploy)
  // ═══════════════════════════════════════════════════════════════
  if (!d.PID_Emission_Controller_v2) {
    console.log("\n\n🔷 STEP 3/10: PID_Emission_Controller_v2");
    const PID = await ethers.getContractFactory("PID_Emission_Controller_v2");
    const pid = await PID.deploy(
      TREASURY,                       // admin
      d.AVLPStaking_v2.proxy,         // staking
      EXISTING.agToken,               // agToken
      CONFIG.PID_TVL_TARGET,          // targetTVL
      CONFIG.PID_KP,                  // kp
      CONFIG.PID_KI,                  // ki
      CONFIG.PID_KD                   // kd
    );
    await pid.deployed();
    console.log("✅ PID_Emission_Controller_v2:", pid.address);
    d.PID_Emission_Controller_v2 = { proxy: pid.address, impl: pid.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("PID_Emission_Controller_v2", pid.address, [
      TREASURY, d.AVLPStaking_v2.proxy, EXISTING.agToken,
      CONFIG.PID_TVL_TARGET, CONFIG.PID_KP, CONFIG.PID_KI, CONFIG.PID_KD,
    ]);
    if (v) d.PID_Emission_Controller_v2.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ PID_Emission_Controller_v2: ${d.PID_Emission_Controller_v2.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: ArtifactTimelock
  // ═══════════════════════════════════════════════════════════════
  if (!d.ArtifactTimelock) {
    console.log("\n\n🔷 STEP 4/10: ArtifactTimelock");
    const TL = await ethers.getContractFactory("ArtifactTimelock");
    const tl = await TL.deploy(TREASURY, TREASURY, TREASURY);
    await tl.deployed();
    console.log("✅ ArtifactTimelock:", tl.address);
    d.ArtifactTimelock = { proxy: tl.address, impl: tl.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("ArtifactTimelock", tl.address, [TREASURY, TREASURY, TREASURY]);
    if (v) d.ArtifactTimelock.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ ArtifactTimelock: ${d.ArtifactTimelock.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: GovernorContract
  // ═══════════════════════════════════════════════════════════════
  if (!d.GovernorContract) {
    console.log("\n\n🔷 STEP 5/10: GovernorContract");
    const G = await ethers.getContractFactory("GovernorContract");
    const g = await G.deploy(EXISTING.agToken, d.ArtifactTimelock.proxy);
    await g.deployed();
    console.log("✅ GovernorContract:", g.address);
    d.GovernorContract = { proxy: g.address, impl: g.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("GovernorContract", g.address, [EXISTING.agToken, d.ArtifactTimelock.proxy]);
    if (v) d.GovernorContract.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ GovernorContract: ${d.GovernorContract.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: FlashLoan
  // ═══════════════════════════════════════════════════════════════
  if (!d.FlashLoan) {
    console.log("\n\n🔷 STEP 6/10: FlashLoan");
    const FL = await ethers.getContractFactory("FlashLoan");
    const fl = await FL.deploy(AERODROME_ROUTER, TREASURY, EXISTING.agToken, EXISTING.auToken);
    await fl.deployed();
    console.log("✅ FlashLoan:", fl.address);
    d.FlashLoan = { proxy: fl.address, impl: fl.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("FlashLoan", fl.address, [AERODROME_ROUTER, TREASURY, EXISTING.agToken, EXISTING.auToken]);
    if (v) d.FlashLoan.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ FlashLoan: ${d.FlashLoan.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: TreasuryFlashBuy
  // ═══════════════════════════════════════════════════════════════
  if (!d.TreasuryFlashBuy) {
    console.log("\n\n🔷 STEP 7/10: TreasuryFlashBuy");
    const FB = await ethers.getContractFactory("TreasuryFlashBuy");
    const fb = await FB.deploy(AERODROME_ROUTER, TREASURY, EXISTING.agToken, EXISTING.auToken);
    await fb.deployed();
    console.log("✅ TreasuryFlashBuy:", fb.address);
    d.TreasuryFlashBuy = { proxy: fb.address, impl: fb.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("TreasuryFlashBuy", fb.address, [AERODROME_ROUTER, TREASURY, EXISTING.agToken, EXISTING.auToken]);
    if (v) d.TreasuryFlashBuy.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ TreasuryFlashBuy: ${d.TreasuryFlashBuy.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 8: TreasuryAMO (only if router is set)
  // ═══════════════════════════════════════════════════════════════
  if (!d.TreasuryAMO) {
    if (AERODROME_ROUTER === ethers.constants.AddressZero) {
      console.log("\n\n⏭️ STEP 8/10: TreasuryAMO — SKIPPED (no AERODROME_ROUTER_ADDRESS set)");
      console.log("  Set AERODROME_ROUTER_ADDRESS env var and re-run to deploy TreasuryAMO");
    } else {
      console.log("\n\n🔷 STEP 8/10: TreasuryAMO ⭐ MAIN CONTRACT");
      const AMO = await ethers.getContractFactory("TreasuryAMO");
      const amo = await AMO.deploy(
        EXISTING.auToken,
        EXISTING.agToken,
        AERODROME_ROUTER,
        TREASURY
      );
      await amo.deployed();
      console.log("✅ TreasuryAMO:", amo.address);
      d.TreasuryAMO = { proxy: amo.address, impl: amo.address, verified: false };
      save(d);
      await new Promise(r => setTimeout(r, 30000));
      const v = await verify("TreasuryAMO", amo.address, [
        EXISTING.auToken, EXISTING.agToken, AERODROME_ROUTER, TREASURY,
      ]);
      if (v) d.TreasuryAMO.verified = true;
      save(d);
    }
  } else {
    console.log(`\n  ⏭️ TreasuryAMO: ${d.TreasuryAMO.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 9: AvOracle
  // ═══════════════════════════════════════════════════════════════
  if (!d.AvOracle) {
    console.log("\n\n🔷 STEP 9/10: AvOracle");
    const Oracle = await ethers.getContractFactory("AvOracle");
    const oracle = await Oracle.deploy(
      EXISTING.auToken,
      EXISTING.agToken,
      TREASURY,                // admin
      d.GovernorContract.proxy // governor
    );
    await oracle.deployed();
    console.log("✅ AvOracle:", oracle.address);
    d.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("AvOracle", oracle.address, [
      EXISTING.auToken, EXISTING.agToken, TREASURY, d.GovernorContract.proxy,
    ]);
    if (v) d.AvOracle.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ AvOracle: ${d.AvOracle.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 10: DexSimulator
  // ═══════════════════════════════════════════════════════════════
  if (!d.DexSimulator) {
    console.log("\n\n🔷 STEP 10/10: DexSimulator");
    const DS = await ethers.getContractFactory("DexSimulator");
    const ds = await DS.deploy(EXISTING.agToken, EXISTING.auToken);
    await ds.deployed();
    console.log("✅ DexSimulator:", ds.address);
    d.DexSimulator = { proxy: ds.address, impl: ds.address, verified: false };
    save(d);
    await new Promise(r => setTimeout(r, 30000));
    const v = await verify("DexSimulator", ds.address, [EXISTING.agToken, EXISTING.auToken]);
    if (v) d.DexSimulator.verified = true;
    save(d);
  } else {
    console.log(`\n  ⏭️ DexSimulator: ${d.DexSimulator.proxy}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n\n" + "═".repeat(65));
  console.log("  🎉 FULL STACK DEPLOYMENT COMPLETE");
  console.log("═".repeat(65));

  const final = load();
  const entries = [
    ["AgToken", EXISTING.agToken],
    ["AuToken", EXISTING.auToken],
    ["Treasury Safe", TREASURY],
    ["QuasiCrystalLPNFT", final.QuasiCrystalLPNFT?.proxy],
    ["AVLPStaking_v2", final.AVLPStaking_v2?.proxy],
    ["PID_Emission_Ctrl", final.PID_Emission_Controller_v2?.proxy],
    ["ArtifactTimelock", final.ArtifactTimelock?.proxy],
    ["GovernorContract", final.GovernorContract?.proxy],
    ["FlashLoan", final.FlashLoan?.proxy],
    ["TreasuryFlashBuy", final.TreasuryFlashBuy?.proxy],
    ["TreasuryAMO", final.TreasuryAMO?.proxy || "SKIPPED (no router)"],
    ["AvOracle", final.AvOracle?.proxy],
    ["DexSimulator", final.DexSimulator?.proxy],
  ];

  for (const [name, addr] of entries) {
    const v = final[name]?.verified ? "✅" : "⏳";
    console.log(`  ${v} ${name.padEnd(30)} ${addr || 'N/A'}`);
  }

  // Update address.book
  console.log("\n  📝 Updating address.book...");
  const abPath = path.join(__dirname, "..", "address.book");
  let ab = fs.readFileSync(abPath, "utf-8");
  const newEntries = `
## FULL STACK DEPLOYMENT (Base Mainnet — 2026-06-28)
QuasiCrystalLPNFT: ${final.QuasiCrystalLPNFT?.proxy || 'N/A'}
AVLPStaking_v2:    ${final.AVLPStaking_v2?.proxy || 'N/A'}
PID_Emission_Ctrl: ${final.PID_Emission_Controller_v2?.proxy || 'N/A'}
ArtifactTimelock:  ${final.ArtifactTimelock?.proxy || 'N/A'}
GovernorContract:  ${final.GovernorContract?.proxy || 'N/A'}
FlashLoan:         ${final.FlashLoan?.proxy || 'N/A'}
TreasuryFlashBuy:  ${final.TreasuryFlashBuy?.proxy || 'N/A'}
TreasuryAMO:       ${final.TreasuryAMO?.proxy || 'SKIPPED'}
AvOracle:          ${final.AvOracle?.proxy || 'N/A'}
DexSimulator:      ${final.DexSimulator?.proxy || 'N/A'}
`;
  if (ab.includes("## NOTES")) {
    ab = ab.replace("## NOTES", newEntries + "\n## NOTES");
  } else {
    ab += newEntries;
  }
  fs.writeFileSync(abPath, ab);
  console.log("  ✅ address.book updated");

  console.log(`\n  💾 State saved to ${DEPLOYED_FILE}`);
  console.log("\n  Next steps:");
  console.log("  1. Set TreasuryAMO wiring (staking, flashLoan, flashBuy)");
  console.log("  2. Transfer ownership → Treasury Safe");
  console.log("  3. Deploy TreasuryAMO if router was missing");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n  ❌ FATAL:", e.message);
    console.error(e.stack);
    process.exit(1);
  });
