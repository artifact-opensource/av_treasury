const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
async function main() {
  const [d] = await hre.ethers.getSigners();
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, d);
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, d);
  const usdc = await hre.ethers.getContractAt("contracts/av_suite/MockUSDC.sol:MockUSDC", ADDR.MockUSDC, d);
  const path = [au.address, usdc.address];
  try {
    const amounts = await router.getAmountsOut(p18(5), path);
    console.log("getAmountsOut(5 AU):", amounts.map(a => a.toString()));
  } catch (e) { console.log("getAmountsOut FAIL:", e.message.slice(0,150)); }
  try {
    const r = await router.getReserves(au.address, usdc.address);
    console.log("getReserves(AU,USDC):", r[0].toString(), r[1].toString());
  } catch (e) { console.log("getReserves FAIL:", e.message.slice(0,150)); }
}
main().catch(e => console.log("ERR", e.message));
