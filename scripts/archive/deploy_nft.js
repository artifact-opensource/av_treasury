const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const SVG = "0xe23F177d09C1C5388104f0369aE91Cc4eA34E528";

  // Deploy QuasiCrystalLPNFT (only needs QuasiCrystalSVG linked)
  console.log("Deploying QuasiCrystalLPNFT...");
  const NFT = await ethers.getContractFactory("QuasiCrystalLPNFT", {
    libraries: { QuasiCrystalSVG: SVG },
  });
  const nft = await NFT.deploy("Aerodrome LP NFT", "auLP", TREASURY, TREASURY, TREASURY);
  await nft.deployed();
  console.log("✅ QuasiCrystalLPNFT:", nft.address);

  // Save
  const FILE = path.join(__dirname, "..", "deployed_stack.json");
  let data = {};
  if (fs.existsSync(FILE)) data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  data.QuasiCrystalLPNFT = { proxy: nft.address, impl: nft.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log("💾 Saved");

  // Wait for confirmations
  console.log("⏳ Waiting 30s...");
  await new Promise(r => setTimeout(r, 30000));

  // Verify
  console.log("🔍 Verifying QuasiCrystalLPNFT...");
  try {
    await require("hardhat").run("verify:verify", {
      address: nft.address,
      constructorArguments: ["Aerodrome LP NFT", "auLP", TREASURY, TREASURY, TREASURY],
    });
    console.log("✅ Verified");
  } catch(e) {
    console.log("⚠️ Verify failed:", e.message.split('\n')[0]);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
