const { ethers } = require("hardhat");
async function main() {
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const pool = new ethers.Contract(POOL, [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function tickSpacing() view returns (int24)",
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ], ethers.provider);
  try { console.log("token0:", await pool.token0()); } catch(e) { console.log("token0 failed"); }
  try { console.log("token1:", await pool.token1()); } catch(e) { console.log("token1 failed"); }
  try { console.log("tickSpacing:", (await pool.tickSpacing()).toString()); } catch(e) { console.log("tickSpacing failed"); }
  try { const s = await pool.slot0(); console.log("sqrtPriceX96:", s[0].toString(), "tick:", s[1].toString()); } catch(e) { console.log("slot0 failed"); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
