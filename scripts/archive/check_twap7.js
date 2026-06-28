const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const iface = new ethers.utils.Interface(["function getPool(address, address, uint24) view returns (address)"]);
  const abiCoder = ethers.utils.defaultAbiCoder;
  
  // Just check AU/WETH 0.3% which is most likely
  const pairs = [["AU/WETH", AU, WETH], ["AG/WETH", AG, WETH], ["AU/AG", AU, AG]];
  for (const [label, a, b] of pairs) {
    for (const fee of [100, 500, 3000, 10000]) {
      try {
        const data = iface.encodeFunctionData("getPool", [a, b, fee]);
        const result = await provider.call({ to: FACTORY, data });
        const pool = abiCoder.decode(["address"], result)[0];
        if (pool !== "0x0000000000000000000000000000000000000000") {
          console.log(`${label} fee ${fee/10000}%: ${pool}`);
        }
      } catch(e) { console.log(`${label} fee ${fee/10000}%: ERROR ${e.message.slice(0,40)}`); }
    }
  }
  console.log("Done");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
