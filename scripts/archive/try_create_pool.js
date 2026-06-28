const { ethers } = require("hardhat");

async function main() {
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const [deployer] = await ethers.getSigners();
  
  // The createPool selector is 0x232aa5ac
  // Let's just try calling it directly with our signer
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function createPool(address,address,int24,uint160) returns (address)",
  ], deployer);
  
  // sqrtPriceX96 for 0.01 ETH/Au (Au has 18 decimals, WETH has 18)
  // price = 0.01 = 1e16
  // sqrtPriceX96 = sqrt(price) * 2^96
  // sqrt(1e16) = 1e8
  // sqrtPriceX96 = 1e8 * 2^96 = 1e8 * 79228162514264337593543950336
  // = 7922816251426433759354395033600000000
  // In hex that's too big, let's compute properly
  const price = ethers.utils.parseUnits("0.01", 18); // 0.01 ETH per Au
  const sqrtPriceX96 = ethers.BigNumber.from("7922816251426433759354395033"); // pre-computed
  
  console.log("Attempting createPool...");
  console.log("  token0:", AU);
  console.log("  token1:", WETH);
  console.log("  tickSpacing:", 100);
  console.log("  sqrtPriceX96:", sqrtPriceX96.toString());
  
  try {
    const tx = await factory.createPool(AU, WETH, 100, sqrtPriceX96);
    const receipt = await tx.wait();
    console.log("\n✅ SUCCESS! Pool created!");
    console.log("Gas used:", receipt.gasUsed.toString());
    for (const log of receipt.logs) {
      console.log("Log:", log.address, log.topics[0]);
    }
  } catch(e) {
    console.log("\n❌ Failed:", e.error?.message || e.message.substring(0, 150));
    console.log("Error data:", e.error?.data || "none");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
