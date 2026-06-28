const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const poolContract = new ethers.Contract(
    POOL, 
    ["function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)"],
    ethers.provider
  );
  
  const [tickCumulatives] = await poolContract.observe([0, 600]);
  console.log("tickCumulatives:", tickCumulatives.map(t => t.toString()));
  
  const delta = tickCumulatives[0].sub(tickCumulatives[1]);
  console.log("cumulative delta:", delta.toString());
  
  // avgTick = delta / 600
  const avgTick = delta.div(600);
  console.log("avgTick:", avgTick.toString());
  
  // Now let's check what FullMath.mulDiv would do
  // The oracle computes: sqrtPriceX96 = _getSqrtPriceX96(avgTick.toUint24())
  // If avgTick doesn't fit in int24...
  console.log("avgTick fits in int24?", avgTick.gte(-8388608) && avgTick.lte(8388607));
  
  // Let's compute _getSqrtPriceX96 manually
  // sqrt(1.0001^tick) * 2^96
  // For tick = -1537776 (from earlier), this is a very small number
  // 1.0001^(-1537776) ≈ e^(ln(1.0001) * -1537776) ≈ e^(-0.0001 * 1537776) ≈ e^(-153.7) ≈ ~0
  // This would underflow!
  
  // WAIT - the avgTick from our earlier observation was -1537776
  // That means the price of token0 in terms of token1 is 1.0001^(-1537776) which is essentially 0
  // This would make sqrtPriceX96 ≈ 0, and then price = 0
  
  // But the oracle's _getSqrtPriceX96 uses FixedPoint96 which requires sqrtPriceX96 > 0
  // If sqrtPriceX96 = 0, then price = 0 which might not revert...
  
  // Let me actually try calling the oracle with a shorter duration
  // and check if the issue is timeElapsed = 0
  
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Check what the oracle's _observePool returns
  // I'll create a mock oracle that exposes _observePool
  
  // Actually let me check: does getTwapPrice revert because of FullMath underflow?
  // The tick from our 600s TWAP is -1537776
  // _getSqrtPriceX96 computes: uint160 sqrtPriceX96 = _getSqrtPriceX96(int24(avgTick))
  // avgTick = -1537776 which fits in int24 (max int24 = 8388607)
  
  // _getSqrtPriceX96 uses bit manipulation to compute sqrt(1.0001^tick)
  // For very negative ticks, this could underflow
  
  // Let me check: what's the token0 vs token1 relationship?
  // token0 = AU, token1 = WETH
  // If token0IsTarget = true, we want price of AU in WETH
  // price = (sqrtPriceX96 / 2^96)^2 
  // If AU is much less valuable than WETH, tick is very negative, price is very small
  
  // The issue: FullMath.mulDiv in the price calculation might overflow/underflow
  // Or the very small price rounds to 0 and then a division by 0 occurs
  
  // Let me check the token0IsTarget flag
  const oracleAbi = ["function twapPools(address) view returns (tuple(address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget))"];
  const oracle = new ethers.Contract(ORACLE, oracleAbi, ethers.provider);
  const poolInfo = await oracle.twapPools(AU);
  console.log("\nToken0IsTarget:", poolInfo.token0IsTarget);
  console.log("Token0:", poolInfo.token0, "(AU)");
  console.log("Token1:", poolInfo.token1, "(WETH)");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
