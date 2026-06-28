const { ethers } = require("hardhat");
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const WETH = "0x4200000000000000000000000000000000000006";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";

async function main() {
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const governorIface = new ethers.utils.Interface([
    "function executeTransaction(address target, uint256 value, bytes calldata data, uint256 locktime)",
  ]);
  
  // Build oracle config calls
  // AU token: pool has token0=AU, so token0IsTarget=true
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [
    AU, POOL, AU, WETH, 600, true  // 10min TWAP
  ]);
  
  // Add staking as TVL source
  const addStakingTvl = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  // We need to execute these via Governor (which has ORACLE_ADMIN role)
  // Governor.executeTransaction(target, value, data, locktime)
  const targets = [ORACLE, ORACLE];
  const values = [0, 0];
  const datas = [configAuTwap, addStakingTvl];
  const locktimes = [0, 0];
  
  // Encode Governor batch
  const governorBatch = governorIface.encodeFunctionData("executeTransaction", [
    ORACLE, 0, configAuTwap, 0
  ]);
  const governorBatch2 = governorIface.encodeFunctionData("executeTransaction", [
    ORACLE, 0, addStakingTvl, 0
  ]);
  
  // Build Safe batch (via Timelock)
  // Safe → Timelock → Governor → Oracle
  const timelockIface = new ethers.utils.Interface([
    "function executeBatch(address[] targets, uint256[] values, bytes[] calldatas, uint256[] locktimes)",
  ]);
  
  // Actually, the Timelock executes arbitrary calls. 
  // If Timelock is the Governor's executor, we call Governor from Timelock.
  // But Timelock.executeBatch calls targets directly.
  // Let's check: does Timelock call Governor, or does Timelock call Oracle directly?
  
  // The Timelock should call Governor.executeTransaction which then calls Oracle
  // OR Timelock can call Oracle directly if Timelock has the role
  
  // Let's check what roles Timelock has on Oracle
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const GOVERNOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNOR"));
  
  const oracle = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", ORACLE);
  const timelockHasOracleAdmin = await oracle.hasRole(ORACLE_ADMIN, TIMELOCK);
  const timelockHasGovernor = await oracle.hasRole(GOVERNOR_ROLE, TIMELOCK);
  console.log("Timelock has ORACLE_ADMIN on Oracle?", timelockHasOracleAdmin);
  console.log("Timelock has GOVERNOR on Oracle?", timelockHasGovernor);
  
  // If neither, we go through Governor
  if (!timelockHasOracleAdmin && !timelockHasGovernor) {
    console.log("\nNeed to go through Governor");
    // Check if Governor can be called directly (by Timelock)
    // Governor's executor should be Timelock
    const governor = await ethers.getContractAt("contracts/av_suite/GovernorContract.sol:GovernorContract", GOVERNOR);
    const executor = await governor.executor();
    console.log("Governor executor:", executor);
    console.log("Timelock address:", TIMELOCK);
    console.log("Match?", executor.toLowerCase() === TIMELOCK.toLowerCase() ? "✅" : "❌");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
