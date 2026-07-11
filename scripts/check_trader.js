const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
async function main() {
  const [d, , , trader] = await hre.ethers.getSigners();
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, d);
  const ag = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.AgToken, d);
  const usdc = await hre.ethers.getContractAt("contracts/av_suite/MockUSDC.sol:MockUSDC", ADDR.MockUSDC, d);
  console.log("trader:", trader.address);
  console.log("AU:", hre.ethers.utils.formatUnits(await au.balanceOf(trader.address), 18));
  console.log("AG:", hre.ethers.utils.formatUnits(await ag.balanceOf(trader.address), 18));
  console.log("USDC:", hre.ethers.utils.formatUnits(await usdc.balanceOf(trader.address), 6));
}
main().catch(e => console.log("ERR", e.message));
