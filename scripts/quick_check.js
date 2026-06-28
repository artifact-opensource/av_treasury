const { ethers } = require("hardhat");
async function main() {
  const block = await ethers.provider.getBlockNumber();
  console.log("Block:", block);
  const bal = await ethers.provider.getBalance("0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E");
  console.log("Deployer:", ethers.utils.formatEther(bal), "ETH");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
