const { ethers } = require("hardhat");

async function main() {
  const OWNER2 = "0x88dB13685836D44964Ce0595E75cA045CF931312";
  const bal = await ethers.provider.getBalance(OWNER2);
  console.log("Owner 2 balance:", ethers.utils.formatEther(bal), "ETH");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
