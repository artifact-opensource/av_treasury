const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
async function main() {
  const [d, , , trader] = await hre.ethers.getSigners();
  const lpnft = await hre.ethers.getContractAt("contracts/av_suite/QuasiCrystalLPNFT.sol:QuasiCrystalLPNFT", ADDR.QuasiCrystalLPNFT, d);
  const POS = { agReserve: 1000, auReserve: 1000, liquidityAmount: 1000, volume24h: 0, volatilityIndex: 1, liquidityDepth: 1, timeHeld: 0, openedAt: 0 };
  try {
    const tx = await lpnft.connect(d).mint(trader.address, POS);
    const rc = await tx.wait();
    const ev = rc.events.find(e => e.event === "Transfer");
    console.log("mint OK, tokenId:", ev ? ev.args.tokenId.toString() : "no Transfer event");
  } catch (e) {
    if (e.error && e.error.args) console.log("ARGS:", e.error.args.map(a => a.toString()));
    else console.log("FAIL:", e.message.slice(0, 200));
  }
}
main().catch(e => console.log("ERR", e.message));
