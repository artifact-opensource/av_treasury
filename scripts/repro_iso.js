const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
async function main() {
  const [d, , , , , fresh] = await hre.ethers.getSigners(); // use signer #5 (unused)
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, d);
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, d);
  console.log("fresh addr:", fresh.address);
  console.log("fresh AU before:", hre.ethers.utils.formatUnits(await au.balanceOf(fresh.address), 18));
  await (await au.connect(d).mint(fresh.address, p18(10_000_000))).wait();
  console.log("fresh AU after mint:", hre.ethers.utils.formatUnits(await au.balanceOf(fresh.address), 18));
  await (await au.connect(fresh).approve(router.address, p18(5))).wait();
  const path = [au.address, ADDR.MockUSDC];
  console.log("amountIn:", p18(5).toString());
  try {
    const out = await router.connect(fresh).swapExactTokensForTokens(p18(5), 0, path, fresh.address, Date.now() + 60000, { gasLimit: 500000 });
    const rc = await out.wait();
    console.log("ISO SELL AU OK gas", rc.gasUsed.toString());
  } catch (e) {
    if (e.error && e.error.args) console.log("ARGS:", e.error.args.map(a => a.toString()));
    else console.log("ISO FAIL:", e.message.slice(0, 200));
  }
}
main().catch(e => console.log("ERR", e.message));
