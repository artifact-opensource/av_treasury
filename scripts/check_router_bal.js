const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
async function main() {
  const [d] = await hre.ethers.getSigners();
  const router = ADDR.MockAerodromeRouter;
  for (const [n, a, dp] of [["AU", ADDR.AuToken, 18], ["AG", ADDR.AgToken, 18], ["USDC", ADDR.MockUSDC, 6], ["WETH", ADDR.MockWETH, 18]]) {
    const t = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", a, d);
    console.log(n, "router bal:", hre.ethers.utils.formatUnits(await t.balanceOf(router), dp));
  }
}
main().catch(e => console.log("ERR", e.message));
