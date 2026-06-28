const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  // Uniswap V3 Factory on Base - lowercase, let ethers handle checksum
  const factoryAddr = "0x33128a8fC17869991970885ff98c4537d53e0e60";
  const AU = "0x0c5a9a970b9c9b77a1ddb1cd62f279ce6cda2f08";
  const AG = "0x1d31719389bd8b17277ba367c26b830ae34d3674";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const factoryAbi = ["function getPool(address, address, uint24) view returns (address)"];
  const factory = new ethers.Contract(factoryAddr, factoryAbi, provider);
  
  const fees = [100, 500, 3000, 10000];
  for (const fee of fees) {
    const auWeth = await factory.getPool(AU, WETH, fee);
    const agWeth = await factory.getPool(AG, WETH, fee);
    const auAg = await factory.getPool(AU, AG, fee);
    if (auWeth !== "0x0000000000000000000000000000000000000000") console.log(`AU/WETH ${fee/10000}%: ${auWeth}`);
    if (agWeth !== "0x0000000000000000000000000000000000000000") console.log(`AG/WETH ${fee/10000}%: ${agWeth}`);
    if (auAg !== "0x0000000000000000000000000000000000000000") console.log(`AU/AG ${fee/10000}%: ${auAg}`);
  }
  
  for (const fee of fees) {
    const wethAu = await factory.getPool(WETH, AU, fee);
    const wethAg = await factory.getPool(WETH, AG, fee);
    if (wethAu !== "0x0000000000000000000000000000000000000000") console.log(`WETH/AU ${fee/10000}%: ${wethAu}`);
    if (wethAg !== "0x0000000000000000000000000000000000000000") console.log(`WETH/AG ${fee/10000}%: ${wethAg}`);
  }
  
  console.log("\nDone - no pools found means no liquidity was created yet");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
