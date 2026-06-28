const { ethers } = require("hardhat");
async function main() {
  console.log("Testing QuasiCrystalLPNFT deployment...");
  try {
    const Factory = await ethers.getContractFactory("QuasiCrystalLPNFT");
    console.log("Factory loaded. Deploying...");
    const nft = await Factory.deploy("Aerodrome LP NFT", "auLP", "https://nft.avtreasury.com/metadata/", "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E", "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E");
    await nft.deployed();
    console.log("✅ NFT deployed:", nft.address);
  } catch(e) {
    console.error("❌ Error:", e.message);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
