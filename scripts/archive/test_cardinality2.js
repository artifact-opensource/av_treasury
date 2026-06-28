const { ethers } = require("hardhat");

async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const provider = ethers.provider;
  
  // Call slot0 via raw call
  const slot0Sig = "0x3850c7bd";
  try {
    const result = await provider.call({ to: POOL, data: slot0Sig });
    const [sqrtPriceX96, tick, obsIndex, obsCard, obsCardNext, feeProtocol, unlocked] = 
      ethers.utils.defaultAbiCoder.decode(["uint160", "int24", "uint16", "uint16", "uint16", "uint8", "bool"], result);
    console.log("sqrtPriceX96:", sqrtPriceX96.toString());
    console.log("tick:", tick.toString());
    console.log("observationIndex:", obsIndex.toString());
    console.log("observationCardinality:", obsCard.toString());
    console.log("observationCardinalityNext:", obsCardNext.toString());
    console.log("feeProtocol:", feeProtocol.toString());
    console.log("unlocked:", unlocked);
  } catch(e) {
    console.log("slot0 raw call failed:", e.message.slice(0, 80));
  }
  
  // Now try observe with different durations
  for (const dur of [1, 5, 10, 30, 60, 120, 300, 600, 1800]) {
    const obsSig = "0x883bdbfd" + ethers.utils.defaultAbiCoder.encode(["uint32[]"], [[dur, 0]]).slice(2);
    try {
      const result = await provider.call({ to: POOL, data: obsSig });
      const [tickCumulatives, secPerLiq] = 
        ethers.utils.defaultAbiCoder.decode(["int56[]", "uint160[]"], result);
      const delta = tickCumulatives[0].sub(tickCumulatives[1]);
      console.log(`observe([${dur}, 0]): ✅ delta=${delta.toString()}, avgTick=${delta.div(dur).toString()}`);
    } catch(e) {
      console.log(`observe([${dur}, 0]): ❌ revert`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
