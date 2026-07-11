const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
async function main() {
  const [d] = await hre.ethers.getSigners();
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, d);
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, d);
  console.log("deployer:", d.address);
  await (await au.connect(d).mint(d.address, p18(10_000_000))).wait();
  await (await au.connect(d).approve(router.address, p18(5))).wait();
  const path = [au.address, ADDR.MockUSDC];
  try {
    const out = await router.swapExactTokensForTokens(p18(5), 0, path, d.address, Date.now() + 60000, { gasLimit: 500000 });
    const rc = await out.wait();
    console.log("DEP SELL AU OK gas", rc.gasUsed.toString());
  } catch (e) {
    if (e.error && e.error.args) console.log("ARGS:", e.error.args.map(a => a.toString()));
    else console.log("DEP FAIL:", e.message.slice(0, 200));
  }
}
main().catch(e => console.log("ERR", e.message));
