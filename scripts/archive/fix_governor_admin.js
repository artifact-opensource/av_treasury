const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  
  const [deployer] = await ethers.getSigners();
  const governor = await ethers.getContractAt("GovernorContract", GOVERNOR);
  
  console.log("Current admin (storage): 0x0 (zero address)");
  console.log("Calling changeAdmin(SAFE)...");
  
  const tx = await governor.changeAdmin(SAFE);
  await tx.wait();
  console.log("✅ Governor admin changed to Treasury Safe");
  console.log("Tx:", tx.hash);
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
