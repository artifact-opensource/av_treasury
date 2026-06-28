const { ethers } = require("hardhat");

async function main() {
  const FACTORY = ethers.utils.getAddress("0x33128a8fC17869991970885ff98c4537d53e0E60");
  const AU = ethers.utils.getAddress("0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08");
  const AG = ethers.utils.getAddress("0x1D31719389Bd8b17277Ba367c26b830aE34D3674");
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const provider = ethers.provider;
  const factoryAbi = ["function getPool(address, address, uint24) view returns (address)"];
  const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
  
  const fees = [100, 500, 3000, 10000];
  console.log("=== Pool Discovery ===");
  for (const fee of fees) {
    const auWeth = await factory.getPool(AU, WETH, fee);
    const agWeth = await factory.getPool(AG, WETH, fee);
    const auAg = await factory.getPool(AU, AG, fee);
    if (auWeth !== ethers.constants.AddressZero) console.log(`AU/WETH ${fee/10000}%: ${auWeth}`);
    if (agWeth !== ethers.constants.AddressZero) console.log(`AG/WETH ${fee/10000}%: ${agWeth}`);
    if (auAg !== ethers.constants.AddressZero) console.log(`AU/AG ${fee/10000}%: ${auAg}`);
  }
  
  for (const fee of fees) {
    const wethAu = await factory.getPool(WETH, AU, fee);
    const wethAg = await factory.getPool(WETH, AG, fee);
    if (wethAu !== ethers.constants.AddressZero) console.log(`WETH/AU ${fee/10000}%: ${wethAu}`);
    if (wethAg !== ethers.constants.AddressZero) console.log(`WETH/AG ${fee/10000}%: ${wethAg}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
