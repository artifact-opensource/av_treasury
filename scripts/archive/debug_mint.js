const { ethers } = require("hardhat");
async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const factory = new ethers.Contract("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A", [
    "function createPool(address,address,int24,uint160) returns (address)",
  ], ethers.provider);
  
  // Check pool code
  const code = await ethers.provider.getCode(POOL);
  console.log("Pool code length:", code.length);
  
  // Try to call slot0 directly
  try {
    const slot0 = await ethers.provider.call({
      to: POOL,
      data: "0x3850c7bd", // slot0()
    });
    console.log("slot0 raw:", slot0);
    const sqrtPriceX96 = ethers.BigNumber.from("0x" + slot0.slice(2, 66));
    const tick = ethers.BigNumber.from("0x" + slot0.slice(66, 130)).fromTwos(24);
    console.log("sqrtPriceX96:", sqrtPriceX96.toString());
    console.log("tick:", tick.toString());
  } catch(e) {
    console.log("slot0 call failed:", e.message.substring(0,80));
  }
  
  // Check if pool is initialized (has non-zero sqrtPriceX96)
  // If sqrtPriceX96 is 0, the pool exists but hasn't been initialized
  // The mint function should initialize it, but maybe it needs a specific tick range
  
  // Let's try a static call to mint to see the revert reason
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const amount = ethers.utils.parseUnits("100000", 18);
  
  const pmInterface = new ethers.utils.Interface([
    "function mint((address,address,int24,int24,int24,uint256,uint256,uint256,uint256,address,uint256)) returns (uint256,uint128)",
  ]);
  
  // Try with tickLower=0, tickUpper=0 (let the PM figure out the range)
  // Actually that won't work. Let me try with the full range but aligned to tickSpacing
  // tickSpacing=100, so ticks must be multiples of 100
  // Full range: MIN_TICK = -887272, MAX_TICK = 887272
  // Aligned: -887200, 887200
  
  // Actually, let me try calling mint with a static call first
  const calldata = pmInterface.encodeFunctionData("mint", [{
    token0: AU,
    token1: WETH,
    tickSpacing: 100,
    tickLower: -887200,
    tickUpper: 887200,
    amount0Desired: amount,
    amount1Desired: 0,
    amount0Min: 0,
    amount1Min: 0,
    recipient: TREASURY,
    deadline: Math.floor(Date.now() / 1000) + 300,
  }]);
  
  try {
    const result = await ethers.provider.call({
      to: PM,
      from: "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E",
      data: calldata,
    });
    console.log("Static call succeeded:", result);
  } catch(e) {
    console.log("Static call reverted:", e.message.substring(0, 200));
    if (e.error && e.error.data) {
      console.log("Revert data:", e.error.data);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
