const { ethers } = require("hardhat");

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAI = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb";

async function main() {
  // 1. Check old oracle's TWAP pool
  const OLD_ORACLE = "0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D";
  const oracleAbi = [
    "function twapPools(address) view returns (address pool, address targetToken, address quoteToken, uint32 twapPeriod, bool active)",
    "function priceFeeds(address) view returns (address aggregator, uint8 primarySource, uint8 secondarySource, uint16 maxDeviationBps, bool active)",
    "function cachedPrices(address) view returns (uint256 price, uint256 timestamp, uint8 source, bool valid)",
  ];
  
  const oldOracle = new ethers.Contract(OLD_ORACLE, oracleAbi, ethers.provider);
  
  console.log("=== OLD ORACLE ===");
  try {
    const twap = await oldOracle.twapPools(AU);
    console.log("TWAP pool:", twap.pool);
    console.log("  active:", twap.active, "period:", twap.twapPeriod.toString());
    
    // Check if this pool has liquidity
    if (twap.pool !== ethers.constants.AddressZero) {
      const poolAbi = ["function liquidity() view returns (uint128)", "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 obsIdx, uint16 obsCard, uint16 obsCardNext, uint8 fee, bool unlocked)"];
      const pool = new ethers.Contract(twap.pool, poolAbi, ethers.provider);
      try {
        const liq = await pool.liquidity();
        console.log("  liquidity:", liq.toString());
        const s0 = await pool.slot0();
        console.log("  sqrtPriceX96:", s0.sqrtPriceX96.toString());
        console.log("  tick:", s0.tick.toString());
      } catch(e) {
        console.log("  pool call failed:", e.message.slice(0, 60));
      }
    }
  } catch(e) {
    console.log("Old oracle twapPools failed:", e.message.slice(0, 60));
  }
  
  try {
    const feed = await oldOracle.priceFeeds(AU);
    console.log("Price feed aggregator:", feed.aggregator);
    console.log("  active:", feed.active);
  } catch(e) {}
  
  try {
    const cached = await oldOracle.cachedPrices(AU);
    console.log("Cached price:", cached.price.toString(), "valid:", cached.valid, "source:", cached.source);
  } catch(e) {}

  // 2. Search Aerodrome factory for AU pools
  console.log("\n=== SEARCHING AERODROME FACTORY ===");
  const FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const factoryAbi = [
    "function allPoolsLength() view returns (uint256)",
    "function allPools(uint256) view returns (address)",
  ];
  const factory = new ethers.Contract(FACTORY, factoryAbi, ethers.provider);
  const len = await factory.allPoolsLength();
  console.log("Total pools:", len.toString());
  
  const poolAbi = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)",
    "function factory() view returns (address)",
  ];
  
  const found = [];
  // Search last 200 pools (most recent)
  const start = Math.max(0, len.toNumber() - 200);
  for (let i = start; i < len.toNumber(); i++) {
    const addr = await factory.allPools(i);
    const pool = new ethers.Contract(addr, poolAbi, ethers.provider);
    try {
      const t0 = await pool.token0();
      if (t0 === AU) {
        const t1 = await pool.token1();
        const liq = await pool.liquidity();
        found.push({ addr, t0, t1, liq: liq.toString() });
      } else {
        const t1 = await pool.token1();
        if (t1 === AU) {
          const liq = await pool.liquidity();
          found.push({ addr, t0, t1, liq: liq.toString() });
        }
      }
    } catch(e) {}
  }
  
  console.log("AU pools found (last 200):", found.length);
  for (const p of found) {
    console.log(" ", p.addr, "liq:", p.liq, "pair:", p.t0, "/", p.t1);
  }

  // 3. Also check Uniswap V3 factory
  console.log("\n=== CHECKING UNISWAP V3 ===");
  const UNI_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
  const uniFactoryAbi = ["function getPool(address, address, uint24) view returns (address)"];
  const uniFactory = new ethers.Contract(UNI_FACTORY, uniFactoryAbi, ethers.provider);
  const fees = [100, 500, 3000, 10000];
  for (const fee of fees) {
    for (const [name, token] of [["WETH", WETH], ["USDC", USDC], ["DAI", DAI]]) {
      try {
        const pool = await uniFactory.getPool(AU, token, fee);
        if (pool !== ethers.constants.AddressZero) {
          const p = new ethers.Contract(pool, poolAbi, ethers.provider);
          const liq = await p.liquidity();
          console.log(`AU/${name} fee=${fee}:`, pool, "liq:", liq.toString());
        }
      } catch(e) {}
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
