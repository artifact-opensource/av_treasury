const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
  
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const governorIface = new ethers.utils.Interface([
    "function proposeTransaction(address target, uint256 value, bytes calldata data, uint256 locktime) returns (uint256)",
  ]);
  
  // Build individual calls
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]);
  const addStakingTvl = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  // First simulate: Governor.proposeTransaction from Timelock
  console.log("=== Simulating Governor.proposeTransaction from Timelock ===");
  
  // Simulate TWAP config
  try {
    await provider.call({
      from: GOVERNOR,  // msg.sender for the inner call context
      to: ORACLE,
      data: configAuTwap,
    });
    console.log("✅ configureTwapPool(AU) simulation PASSED");
  } catch(e) { console.log("❌ configureTwapPool failed:", e.message.slice(0,80)); }
  
  try {
    await provider.call({
      from: GOVERNOR,
      to: ORACLE,
      data: addStakingTvl,
    });
    console.log("✅ addTvlSource(STAKING) simulation PASSED");
  } catch(e) { console.log("❌ addTvlSource failed:", e.message.slice(0,80)); }
  
  // Now simulate the full flow: Timelock → Governor → Oracle
  const govCall1 = governorIface.encodeFunctionData("proposeTransaction", [ORACLE, 0, configAuTwap, 0]);
  
  try {
    await provider.call({
      from: TIMELOCK,
      to: GOVERNOR,
      data: govCall1,
    });
    console.log("✅ Governor.proposeTransaction from Timelock SIMULATION PASSED");
  } catch(e) { console.log("❌ Governor.proposeTransaction failed:", e.message.slice(0,80)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
