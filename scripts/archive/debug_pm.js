const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Try different proxy patterns
  // 1. ERC-1967
  const implSlot1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d648bbc";
  const impl1967 = await ethers.provider.getStorageAt(PM, implSlot1967);
  console.log("ERC-1967 impl:", impl1967);
  
  // 2. OpenZeppelin Transparent proxy admin slot
  const adminSlot = "0xb53127684a568b31733613b10f0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b";
  const admin = await ethers.provider.getStorageAt(PM, adminSlot);
  console.log("Transparent proxy admin:", admin);
  
  // 3. Check storage slot 0 (often implementation address in custom proxies)
  for (let i = 0; i <= 10; i++) {
    const slot = await ethers.provider.getStorageAt(PM, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const addr = "0x" + slot.slice(26);
      try {
        const checksummed = ethers.utils.getAddress(addr);
        const code = await ethers.provider.getCode(checksummed);
        if (code.length > 100) {
          console.log(`Slot ${i}: ${checksummed} (code: ${code.length})`);
        }
      } catch(e) {}
    }
  }
  
  // Try calling createAndInitializePoolIfNecessary directly
  // The function might exist but with different parameters
  const pm = new ethers.Contract(PM, [
    "function createAndInitializePoolIfNecessary(address, address, int24, uint160) returns (address)",
  ], ethers.provider);
  
  // Try a static call first
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceX96 = Q96.div(10); // 0.01 ETH/Au
  
  const [token0, token1] = AU.toLowerCase() < WETH.toLowerCase() ? [AU, WETH] : [WETH, AU];
  
  console.log("\nTrying createAndInitializePoolIfNecessary staticcall...");
  console.log("token0:", token0);
  console.log("token1:", token1);
  console.log("tickSpacing: 100");
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  
  try {
    const result = await pm.callStatic.createAndInitializePoolIfNecessary(token0, token1, 100, sqrtPriceX96);
    console.log("Result:", result);
  } catch(e) {
    console.log("Static call failed:", e.message.substring(0,200));
  }
  
  // Also try with tickSpacing=1
  console.log("\nTrying with tickSpacing=1...");
  try {
    const result = await pm.callStatic.createAndInitializePoolIfNecessary(token0, token1, 1, sqrtPriceX96);
    console.log("Result:", result);
  } catch(e) {
    console.log("Static call failed:", e.message.substring(0,200));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
