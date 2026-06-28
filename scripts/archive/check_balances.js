const { ethers } = require("hardhat");

async function main() {
  const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  
  const deployerBal = await ethers.provider.getBalance(DEPLOYER);
  const safeBal = await ethers.provider.getBalance(SAFE);
  
  console.log("Deployer:", ethers.utils.formatEther(deployerBal), "ETH");
  console.log("Safe:", ethers.utils.formatEther(safeBal), "ETH");
  
  const gasPrice = await ethers.provider.getGasPrice();
  console.log("Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
