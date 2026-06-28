const { ethers } = require("hardhat");

async function main() {
  const POOL = "0x5E1aA37C424A5cBa4b86AFf533cf369aeF0Def70";
  const poolAbi = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 obsIdx, uint16 obsCard, uint16 obsCardNext, uint8 fee, bool unlocked)",
    "function observe(uint32[] calldata secondsAgos) view returns (int56[] tickCumulatives, uint160[] liquidityCumulatives)",
    "function factory() view returns (address)",
  ];
  
  const pool = new ethers.Contract(POOL, poolAbi, ethers.provider);
  
  const t0 = await pool.token0();
  const t1 = await pool.token1();
  const liq = await pool.liquidity();
  console.log("token0:", t0);
  console.log("token1:", t1);
  console.log("liquidity:", liq.toString());
  
  try {
    const s0 = await pool.slot0();
    console.log("sqrtPriceX96:", s0.sqrtPriceX96.toString());
    console.log("tick:", s0.tick.toString());
    console.log("obsCardinality:", s0.obsCard.toString());
    
    // Price calc
    const sp = Number(s0.sqrtPriceX96.toString());
    const price = (sp / 2**96)**2;
    console.log("price (token1/token0):", price);
  } catch(e) {
    console.log("slot0 failed:", e.message.slice(0, 80));
  }
  
  try {
    const [cumulatives] = await pool.observe([600, 0]);
    const avgTick = cumulatives[1].sub(cumulatives[0]).div(600);
    console.log("TWAP avgTick (600s):", avgTick.toString());
  } catch(e) {
    console.log("observe failed:", e.message.slice(0, 80));
  }
  
  const factory = await pool.factory();
  console.log("factory:", factory);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
