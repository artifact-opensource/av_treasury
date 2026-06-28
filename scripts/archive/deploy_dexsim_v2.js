const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

async function main() {
  const DexSim = await ethers.getContractFactory("contracts/av_suite/DexSimulator.sol:DexSimulator");
  const ds = await DexSim.deploy(AU, AG);
  await ds.deployed();
  console.log("DexSim:", ds.address);

  d.DexSimulator = { proxy: ds.address, impl: ds.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", { address: ds.address, constructorArguments: [AU, AG] });
    d.DexSimulator.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    console.log("✅ Verified");
  } catch(e) { console.log("⚠️", e.message.split('\n')[0]); }

  // Grant admin
  const c = await ethers.getContractAt("contracts/av_suite/DexSimulator.sol:DexSimulator", ds.address);
  const tx = await c.grantRole(ethers.constants.HashZero, SAFE);
  await tx.wait();
  console.log("✅ Admin → Safe");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
