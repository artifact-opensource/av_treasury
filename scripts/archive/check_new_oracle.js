const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
  
  const abi = [
    "function twapPools(address) view returns (address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function getTvlSourceCount() view returns (uint256)",
    "function tvlSources(uint256) view returns (address)",
    "function getTwapPrice(address token) view returns (uint256)",
    "function getPrice(address token) view returns (uint256 price, uint8 decimals)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  console.log("=== New Oracle Status ===");
  
  const pool = await oracle.twapPools(AU);
  console.log("AU TWAP pool:", pool.pool, pool.pool !== ethers.constants.AddressZero ? "✅" : "❌");
  console.log("  token0IsTarget:", pool.token0IsTarget);
  console.log("  twapDuration:", pool.twapDuration.toString());
  
  const tvlCount = await oracle.getTvlSourceCount();
  console.log("TVL sources:", tvlCount.toString());
  if (tvlCount.gt(0)) {
    for (let i = 0; i < tvlCount.toNumber(); i++) {
      console.log(`  [${i}]:`, await oracle.tvlSources(i));
    }
  }
  
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("AU TWAP price:", price.toString());
  } catch(e) { console.log("getTwapPrice:", e.message.slice(0,60)); }
  
  try {
    const [p, d] = await oracle.getPrice(AU);
    console.log("AU getPrice:", p.toString(), "decimals:", d);
  } catch(e) { console.log("getPrice:", e.message.slice(0,60)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
