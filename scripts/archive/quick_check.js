const { ethers } = require("hardhat");
async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const [d] = await ethers.getSigners();
  const au = new ethers.Contract(AU, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
  ], ethers.provider);
  const bal = await au.balanceOf(d.address);
  const allow = await au.allowance(d.address, PM);
  console.log("Deployer:", d.address);
  console.log("Balance:", ethers.utils.formatUnits(bal, 18));
  console.log("Allowance PM:", ethers.utils.formatUnits(allow, 18));

  // Check PM's token0 and token1 for the pool
  const pool = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const p = new ethers.Contract(pool, [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function tickSpacing() view returns (int24)",
  ], ethers.provider);
  console.log("\nPool token0:", await p.token0());
  console.log("Pool token1:", await p.token1());
  console.log("Pool tickSpacing:", (await p.tickSpacing()).toString());
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
