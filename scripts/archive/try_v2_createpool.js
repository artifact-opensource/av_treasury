const { ethers } = require("hardhat");

async function main() {
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const [deployer] = await ethers.getSigners();
  
  // Try calling createPool with different signatures using a signer
  const factory = new ethers.Contract(V2_FACTORY, [
    "function createPool(address,address) returns (address)",
    "function createPool(address,address,bool) returns (address)",
    "function createPool(address,address,bool,bool) returns (address)",
    "function createPool(address,address,bool,bool,uint256) returns (address)",
  ], deployer);
  
  // Try each variant
  console.log("Trying createPool(address,address)...");
  try {
    const tx = await factory.createPool(AU, WETH);
    const receipt = await tx.wait();
    console.log("SUCCESS! Pool created. Gas:", receipt.gasUsed.toString());
    console.log("Logs:", JSON.stringify(receipt.logs.map(l => ({address: l.address, topics: l.topics}))));
  } catch(e) {
    console.log("Failed:", e.message.substring(0, 120));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
