const { ethers } = require("hardhat");
const ethers;

async function main() {
  const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  
  const deployerBal = await ethers.provider.getBalance(DEPLOYER);
  const safeBal = await ethers.provider.getBalance(SAFE);
  
  console.log("Deployer balance:", ethers.utils.formatEther(deployerBal), "ETH");
  console.log("Safe balance:", ethers.utils.formatEther(safeBal), "ETH");
  
  const gasPrice = await ethers.provider.getGasPrice();
  console.log("Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
  
  const totalGas = BigNumber.from("1500000");
  const totalCost = totalGas.mul(gasPrice);
  console.log("Estimated cost for 3 txs:", ethers.utils.formatEther(totalCost), "ETH");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
