const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  
  // getPool(address,address,uint24) selector = 0x1698ee82
  const factoryAddr = "0x33128a8fC17869991970885ff98c4537d53e0E60";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Use staticCall with raw abi
  const abiCoder = ethers.utils.defaultAbiCoder;
  const iface = new ethers.utils.Interface(["function getPool(address, address, uint24) view returns (address)"]);
  
  for (const fee of [100, 500, 3000, 10000]) {
    for (const [a, b] of [[AU, WETH], [AG, WETH], [AU, AG], [WETH, AU], [WETH, AG]]) {
      try {
        const data = iface.encodeFunctionData("getPool", [a, b, fee]);
        const result = await provider.call({ to: factoryAddr, data });
        const pool = abiCoder.decode(["address"], result)[0];
        if (pool !== "0x0000000000000000000000000000000000000000") {
          console.log(`Pool found: ${a.slice(0,6)}/${b.slice(0,6)} fee=${fee/10000}% → ${pool}`);
        }
      } catch(e) {}
    }
  }
  console.log("Done");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
