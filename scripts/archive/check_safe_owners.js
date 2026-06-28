const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
  
  const abi = [
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
  ];
  
  const safe = new ethers.Contract(SAFE, abi, ethers.provider);
  const owners = await safe.getOwners();
  const threshold = await safe.getThreshold();
  
  console.log("Safe owners:", owners);
  console.log("Threshold:", threshold.toString());
  console.log("Deployer is owner?", owners.some(o => o.toLowerCase() === DEPLOYER.toLowerCase()));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
