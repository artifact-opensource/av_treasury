const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
const p6 = (n) => hre.ethers.utils.parseUnits(n.toString(), 6);

async function main() {
  const [d, , , trader] = await hre.ethers.getSigners();
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, d);
  const ag = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.AgToken, d);
  const usdc = await hre.ethers.getContractAt("contracts/av_suite/MockUSDC.sol:MockUSDC", ADDR.MockUSDC, d);
  const weth = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.MockWETH, d);
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, d);

  // mint trader once (like engine)
  await (await usdc.connect(d).mint(trader.address, p6(200000))).wait();
  await (await weth.connect(d).mint(trader.address, p18(200000))).wait();
  await (await au.connect(d).mint(trader.address, p18(200000))).wait();
  await (await ag.connect(d).mint(trader.address, p18(200000))).wait();

  for (let i = 0; i < 10; i++) {
    const buy = Math.random() < 0.5;
    const which = Math.random() < 0.5 ? "AU" : "AG";
    const pay = which === "AU" ? au : ag;
    const quote = Math.random() < 0.5 ? usdc : weth;
    const quoteIsUsdc = quote === usdc;
    const amt = quoteIsUsdc ? p6(Math.floor(Math.random() * 5000) + 100) : p18(Math.floor(Math.random() * 5) + 1);
    const path = buy ? [quote.address, pay.address] : [pay.address, quote.address];
    const inputToken = buy ? quote : pay;
    const inputAmt = amt;
    try {
      if ((await inputToken.balanceOf(trader.address)).lt(inputAmt)) {
        const topUp = quoteIsUsdc ? p6(200000) : p18(200000);
        await (await inputToken.connect(d).mint(trader.address, topUp)).wait();
      }
      await (await inputToken.connect(trader).approve(router.address, inputAmt)).wait();
      const out = await router.connect(trader).swapExactTokensForTokens(inputAmt, 0, path, trader.address, Date.now() + 60000);
      const rc = await out.wait();
      console.log(`#${i} ${buy ? "BUY" : "SELL"} ${which} OK gas ${rc.gasUsed}`);
    } catch (e) {
      console.log(`#${i} ${buy ? "BUY" : "SELL"} ${which} FAIL:`, e.message.slice(0, 140));
    }
  }
}
main().catch(e => console.log("ERR", e.message));
