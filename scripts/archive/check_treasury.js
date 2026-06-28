const { ethers } = require("hardhat");

async function main() {
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const [deployer] = await ethers.getSigners();
  
  // Check Treasury code
  const code = await ethers.provider.getCode(TREASURY);
  console.log("Treasury code length:", code.length);
  
  // Check AU balance of Treasury
  const au = new ethers.Contract(AU, [
    "function balanceOf(address) view returns (uint256)",
  ], ethers.provider);
  
  const bal = await au.balanceOf(TREASURY);
  console.log("Treasury AU balance:", ethers.utils.formatUnits(bal, 18));
  
  // Check deployer AU balance
  const depBal = await au.balanceOf(deployer.address);
  console.log("Deployer AU balance:", ethers.utils.formatUnits(depBal, 18));
  
  // Check Treasury owner
  const treasury = new ethers.Contract(TREASURY, [
    "function owner() view returns (address)",
    "function execTransaction(address, uint256, bytes, uint8, uint256, uint256, uint256, address, address, bytes) returns (bool)",
  ], ethers.provider);
  
  try { console.log("Treasury owner:", await treasury.owner()); } catch(e) { console.log("owner() failed"); }
  
  // Check if deployer is owner
  try {
    const owner = await treasury.owner();
    console.log("Deployer is owner:", owner.toLowerCase() === deployer.address.toLowerCase());
  } catch(e) {}
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
