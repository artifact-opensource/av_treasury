const { ethers } = require("hardhat");

async function main() {
  const FACTORY = "0x33128a8fC17869991970885ff98c4537d53e0E60";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const provider = ethers.provider;
  const factoryAbi = ["function getPool(address, address, uint24) view returns (address)"];
  const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
  
  // Try various fee tiers
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
  
  // Check reverse order too
  for (const fee of fees) {
    const wethAu = await factory.getPool(WETH, AU, fee);
    const wethAg = await factory.getPool(WETH, AG, fee);
    if (wethAu !== ethers.constants.AddressZero) console.log(`WETH/AU ${fee/10000}%: ${wethAu}`);
    if (wethAg !== ethers.constants.AddressZero) console.log(`WETH/AG ${fee/10000}%: ${wethAg}`);
  }
  
  // Check LP NFT for deployed LP
  const lpNFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
  const nftAbi = ["function poolId() view returns (uint256)", "function positionId() view returns (uint256)"];
  const nft = new ethers.Contract(lpNFT, nftAbi, provider);
  try {
    const poolId = await nft.poolId();
    console.log("\nLP NFT poolId:", poolId.toString());
  } catch(e) { console.log("\nLP NFT has no poolId()"); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
