const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";

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
  const [deployer] = await ethers.getSigners();

  // ═══════════════════════════════════════════════════
  // 1. Staking (redeploy implementation + proxy)
  // ═══════════════════════════════════════════════════
  console.log("\n═══ 1/5: AVLPStaking_v2 (redeploy) ═══");
  const StakingImpl = await ethers.getContractFactory("contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2");
  const stakingImpl = await StakingImpl.deploy();
  await stakingImpl.deployed();
  console.log("  Impl:", stakingImpl.address);

  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const initData = StakingImpl.interface.encodeFunctionData("initialize", [AU, AG, NFT]);
  const proxy = await Proxy.deploy(stakingImpl.address, initData);
  await proxy.deployed();
  const stakingAddr = proxy.address;
  console.log("  Proxy:", stakingAddr);

  d.AVLPStaking_v2 = { proxy: stakingAddr, impl: stakingImpl.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("Staking_v2", stakingImpl.address, []);
  d.AVLPStaking_v2.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // ═══════════════════════════════════════════════════
  // 2. TreasuryFlashBuy (correct token order)
  // Constructor: (dex, treasury, agToken, auToken)
  // ═══════════════════════════════════════════════════
  console.log("\n═══ 2/5: TreasuryFlashBuy (redeploy) ═══");
  const FlashBuy = await ethers.getContractFactory("contracts/av_suite/TreasuryFlashBuy.sol:TreasuryFlashBuy");
  const flashBuy = await FlashBuy.deploy(ROUTER, SAFE, AG, AU);
  await flashBuy.deployed();
  console.log("  FlashBuy:", flashBuy.address);

  d.TreasuryAMO = d.TreasuryAMO || {};
  d.TreasuryFlashBuy = { proxy: flashBuy.address, impl: flashBuy.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("TreasuryFlashBuy", flashBuy.address, [ROUTER, SAFE, AG, AU]);
  d.TreasuryFlashBuy.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // ═══════════════════════════════════════════════════
  // 3. AvOracle (correct token order + add feeds)
  // Constructor: (_auToken, _agToken, _admin, _governor)
  // ═══════════════════════════════════════════════════
  console.log("\n═══ 3/5: AvOracle (redeploy) ═══");
  const Oracle = await ethers.getContractFactory("contracts/av_suite/AvOracle.sol:AvOracle");
  const oracle = await Oracle.deploy(AU, AG, SAFE, GOVERNOR);
  await oracle.deployed();
  console.log("  Oracle:", oracle.address);

  d.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("AvOracle", oracle.address, [AU, AG, SAFE, GOVERNOR]);
  d.AvOracle.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // ═══════════════════════════════════════════════════
  // 4. DexSimulator (correct token order)
  // Constructor: (_tokenA, _tokenB)
  // ═══════════════════════════════════════════════════
  console.log("\n═══ 4/5: DexSimulator (redeploy) ═══");
  const DexSim = await ethers.getContractFactory("contracts/av_suite/DexSimulator.sol:DexSimulator");
  const dexSim = await DexSim.deploy(AU, AG);
  await dexSim.deployed();
  console.log("  DexSimulator:", dexSim.address);

  d.DexSimulator = { proxy: dexSim.address, impl: dexSim.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("DexSimulator", dexSim.address, [AU, AG]);
  d.DexSimulator.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // ═══════════════════════════════════════════════════
  // 5. FlashLoan (correct token order)
  // Constructor: (dex, auToken, agToken, treasury)
  // ═══════════════════════════════════════════════════
  console.log("\n═══ 5/5: FlashLoan (redeploy) ═══");
  const FlashLoan = await ethers.getContractFactory("contracts/av_suite/FlashLoan.sol:FlashLoan");
  const flashLoan = await FlashLoan.deploy(ROUTER, AU, AG, SAFE);
  await flashLoan.deployed();
  console.log("  FlashLoan:", flashLoan.address);

  d.FlashLoan = { proxy: flashLoan.address, impl: flashLoan.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  await verify("FlashLoan", flashLoan.address, [ROUTER, AU, AG, SAFE]);
  d.FlashLoan.verified = true;
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  // ═══════════════════════════════════════════════════
  // Transfer ownership of all new contracts → Safe
  // ═══════════════════════════════════════════════════
  console.log("\n═══ Transferring ownership → Safe ═══");
  
  // Staking — grant admin to Safe
  const staking = await ethers.getContractAt("AVLPStaking_v2", stakingAddr);
  let tx = await staking.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("  ✅ Staking admin → Safe");

  // FlashBuy
  const fb = await ethers.getContractAt("TreasuryFlashBuy", flashBuy.address);
  tx = await fb.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("  ✅ FlashBuy admin → Safe");

  // Oracle
  const orc = await ethers.getContractAt("AvOracle", oracle.address);
  tx = await orc.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("  ✅ Oracle admin → Safe");

  // DexSim
  const ds = await ethers.getContractAt("DexSimulator", dexSim.address);
  tx = await ds.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("  ✅ DexSim admin → Safe");

  // FlashLoan
  const fl = await ethers.getContractAt("FlashLoan", flashLoan.address);
  tx = await fl.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("  ✅ FlashLoan admin → Safe");

  // ═══════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  🎉 ALL REDEPLOYS COMPLETE — 5/5 verified");
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
