const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const deployer = new hre.ethers.Wallet(DEPLOYER_KEY, provider);
const MNEMONIC = "test test test test test test test test test test test junk";
const hd = hre.ethers.utils.HDNode.fromMnemonic(MNEMONIC);
const trader = new hre.ethers.Wallet(hd.derivePath(`m/44'/60'/0'/0/3`).privateKey, provider);
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
const p6 = (n) => hre.ethers.utils.parseUnits(n.toString(), 6);

async function main() {
  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, deployer);
  const ag = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.AgToken, deployer);
  const usdc = await hre.ethers.getContractAt("contracts/av_suite/MockUSDC.sol:MockUSDC", ADDR.MockUSDC, deployer);
  const weth = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.MockWETH, deployer);
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, deployer);

  // SELL AU (pay=au, quote=usdc)
  const pay = au, quote = usdc;
  const inputToken = pay; // SELL
  const amt = p18(Math.floor(Math.random() * 5) + 1); // 18dp
  const path = [pay.address, quote.address];
  if ((await inputToken.balanceOf(trader.address)).lt(amt)) {
    await (await inputToken.connect(deployer).mint(trader.address, p18(200000))).wait();
  }
  await (await inputToken.connect(trader).approve(router.address, amt)).wait();
  try {
    const out = await router.connect(trader).swapExactTokensForTokens(amt, 0, path, trader.address, Date.now() + 60000, { gasLimit: 500000 });
    const rc = await out.wait();
    console.log("SELL AU OK gas", rc.gasUsed.toString());
  } catch (e) {
    if (e.error && e.error.args) console.log("SELL AU ARGS:", e.error.args.map(a => a.toString()));
    else console.log("SELL AU FAIL:", e.message.slice(0, 250));
  }
}
main().catch(e => console.log("ERR", e.message));
