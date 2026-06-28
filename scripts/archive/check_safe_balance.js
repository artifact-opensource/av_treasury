const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
  
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  const balance = await ethers.provider.getBalance(SAFE);
  const deployerBalance = await ethers.provider.getBalance(wallet.address);
  
  console.log("Safe balance:", ethers.utils.formatEther(balance), "ETH");
  console.log("Deployer balance:", ethers.utils.formatEther(deployerBalance), "ETH");
  
  // Fund Safe with enough for gas
  const needed = ethers.utils.parseEther("0.001");
  if (balance.lt(needed)) {
    console.log("\nFunding Safe with 0.001 ETH...");
    const tx = await wallet.sendTransaction({
      to: SAFE,
      value: needed,
      gasLimit: 21000,
      gasPrice: ethers.utils.parseUnits("50", "gwei"),
    });
    console.log("Fund tx:", tx.hash);
    await tx.wait();
    const newBalance = await ethers.provider.getBalance(SAFE);
    console.log("New Safe balance:", ethers.utils.formatEther(newBalance), "ETH");
  } else {
    console.log("Safe has enough ETH");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
