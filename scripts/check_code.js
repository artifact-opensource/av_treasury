const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
async function main() {
  for (const [name, addr] of Object.entries(ADDR)) {
    const code = await hre.ethers.provider.getCode(addr);
    console.log(name.padEnd(22), addr, "code:", code.length > 10 ? "YES(" + code.length + ")" : "NO");
  }
}
main().catch(e => console.log("ERR", e.message));
