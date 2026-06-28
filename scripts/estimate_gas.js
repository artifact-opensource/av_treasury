const { ethers } = require("hardhat");
async function main() {
  const factory = await ethers.getContractFactory("AvOracle");
  const gas = await ethers.provider.estimateGas(factory.getDeployTransaction(
    "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E",
    "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E"
  ));
  console.log("Deploy gas:", gas.toString());
  console.log("At 0.1 gwei:", ethers.utils.formatEther(gas.mul(1e8)), "ETH");
  console.log("At 0.5 gwei:", ethers.utils.formatEther(gas.mul(5e8)), "ETH");
  console.log("At 1 gwei:", ethers.utils.formatEther(gas.mul(1e9)), "ETH");
  
  // Also check current gas price
  const fee = await ethers.provider.getFeeData();
  console.log("Gas price:", ethers.utils.formatUnits(fee.gasPrice, "gwei"), "gwei");
  console.log("Cost at current:", ethers.utils.formatEther(gas.mul(fee.gasPrice)), "ETH");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
