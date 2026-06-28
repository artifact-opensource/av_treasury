const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";

async function main() {
  const Oracle = await ethers.getContractFactory("contracts/av_suite/AvOracle.sol:AvOracle");
  const oracle = await Oracle.deploy(AU, AG, GOVERNOR, GOVERNOR);
  await oracle.deployed();
  console.log("Oracle v2:", oracle.address);

  d.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", { address: oracle.address, constructorArguments: [AU, AG, GOVERNOR, GOVERNOR] });
    d.AvOracle.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    console.log("✅ Verified");
  } catch(e) { console.log("⚠️", e.message.split('\n')[0]); }

  // Verify on-chain
  const c = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", oracle.address);
  console.log("  auToken:", await c.auToken(), "== AU?", (await c.auToken()).toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  agToken:", await c.agToken(), "== AG?", (await c.agToken()).toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
