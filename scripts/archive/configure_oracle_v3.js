const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0xd17aB635250d4ce5bC7056AADFCcE44EA509a9aF";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const WETH = "0x4200000000000000000000000000000000000006";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  const oracle = new ethers.Contract(ORACLE, [
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ], wallet);
  
  // 1. Configure AU TWAP
  console.log("Configuring AU TWAP...");
  const tx1 = await oracle.configureTwapPool(AU, POOL, AU, WETH, 600, true);
  console.log("  tx:", tx1.hash);
  await tx1.wait();
  console.log("  ✅ AU TWAP configured");
  
  // 2. Add Staking as TVL source
  console.log("Adding Staking TVL source...");
  const tx2 = await oracle.addTvlSource(STAKING);
  console.log("  tx:", tx2.hash);
  await tx2.wait();
  console.log("  ✅ Staking added as TVL source");
  
  // 3. Verify configuration
  console.log("\n=== Verification ===");
  const twapPool = await oracle.twapPools(AU);
  console.log("AU twapPool:", twapPool.pool, twapPool.pool !== ethers.constants.AddressZero ? "✅" : "❌");
  console.log("  token0:", twapPool.token0);
  console.log("  token1:", twapPool.token1);
  console.log("  twapDuration:", twapPool.twapDuration.toString());
  console.log("  token0IsTarget:", twapPool.token0IsTarget);
  
  const tvlCount = await oracle.getTvlSourceCount();
  console.log("TVL source count:", tvlCount.toString());
  
  // 4. Test price
  console.log("\n=== Price Test ===");
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("AU TWAP price (raw):", price.toString());
    console.log("AU TWAP price (18 dec):", ethers.utils.formatUnits(price, 18));
  } catch(e) { console.log("getTwapPrice error:", e.message.slice(0,80)); }
  
  try {
    const [price, source] = await oracle.getPrice(AU);
    console.log("AU getPrice:", price.toString(), "source:", source);
  } catch(e) { console.log("getPrice error:", e.message.slice(0,80)); }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
