const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";

  // Get slot0 from pool
  const slot0Data = await ethers.provider.call({ to: POOL, data: "0x3850c7bd" });
  console.log("Raw slot0:", slot0Data);

  // Decode manually
  // ABI encoding pads each value to 32 bytes
  const sqrtPriceX96 = ethers.BigNumber.from("0x" + slot0Data.slice(2, 66));
  const tick = ethers.BigNumber.from("0x" + slot0Data.slice(68, 130)).fromTwos(24);

  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("tick:", tick.toString());

  // The sqrtPriceX96 I used: 7922816251426433759354395033
  // = 0x199999999999999999999999 (approx)
  console.log("My sqrtPriceX96:", "7922816251426433759354395033");
  console.log("Pool sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("Match:", sqrtPriceX96.toString() === "7922816251426433759354395033");

  // Check pool's tick spacing
  const tsData = await ethers.provider.call({ to: POOL, data: "0xd0c93a7c" }); // tickSpacing()
  console.log("\ntickSpacing raw:", tsData);
  const ts = ethers.BigNumber.from("0x" + tsData.slice(2, 66)).fromTwos(24);
  console.log("tickSpacing:", ts.toString());

  // Check factory
  const factoryData = await ethers.provider.call({ to: POOL, data: "0xc45a0155" }); // factory()
  console.log("\nfactory:", "0x" + factoryData.slice(26));

  // Check if pool is unlocked (initialized)
  const unlocked = slot0Data.slice(194, 196) === "01";
  console.log("unlocked:", unlocked);

  // Maybe the issue is that mint() with sqrtPriceX96 is only for uninitialized pools
  // and for initialized pools we should use a different function
  // Let me check if there's an increaseLiquidity function

  // Actually, let me try calling mint with sqrtPriceX96 = 0 for initialized pool
  // Or maybe the 11-param version should work for initialized pools

  // Let me check the pool's liquidity
  const liqData = await ethers.provider.call({ to: POOL, data: "0x18160ddd" }); // liquidity()
  const liquidity = ethers.BigNumber.from("0x" + liqData.slice(2, 66));
  console.log("\nPool liquidity:", liquidity.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
