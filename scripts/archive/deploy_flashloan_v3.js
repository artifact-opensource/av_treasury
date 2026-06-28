const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "deployed_stack.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf-8"));
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

async function main() {
  // Constructor: (dex, treasury, agToken, auToken)
  const FlashLoan = await ethers.getContractFactory("contracts/av_suite/FlashLoan.sol:FlashLoan");
  const fl = await FlashLoan.deploy(ROUTER, SAFE, AG, AU);
  await fl.deployed();
  console.log("FlashLoan:", fl.address);

  d.FlashLoan = { proxy: fl.address, impl: fl.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", { address: fl.address, constructorArguments: [ROUTER, SAFE, AG, AU] });
    d.FlashLoan.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    console.log("✅ Verified");
  } catch(e) { console.log("⚠️", e.message.split('\n')[0]); }

  // Verify on-chain
  const c = await ethers.getContractAt("contracts/av_suite/FlashLoan.sol:FlashLoan", fl.address);
  console.log("  treasury:", await c.treasury(), "== SAFE?", (await c.treasury()).toLowerCase() === SAFE.toLowerCase() ? "✅" : "❌");
  console.log("  auToken:", await c.auToken(), "== AU?", (await c.auToken()).toLowerCase() === AU.toLowerCase() ? "✅" : "❌");
  console.log("  agToken:", await c.agToken(), "== AG?", (await c.agToken()).toLowerCase() === AG.toLowerCase() ? "✅" : "❌");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
