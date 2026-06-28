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
  // Oracle ABI (only need encodeFunctionData)
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const governorIface = new ethers.utils.Interface([
    "function proposeTransaction(address target, uint256 value, bytes calldata data, uint256 locktime) returns (uint256)",
  ]);
  
  const timelockIface = new ethers.utils.Interface([
    "function executeBatch(address[] targets, uint256[] values, bytes[] calldatas, uint256[] locktimes)",
  ]);
  
  // Step 1: Oracle config calls
  // AU: token0=AU in the pool, so token0IsTarget=true
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [
    AU, POOL, AU, WETH, 600, true  // 10min TWAP, token0(AU) is the target
  ]);
  
  // Add Staking as TVL source
  const addStakingTvl = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  // Step 2: Governor calls (Timelock → Governor → Oracle)
  const govCall1 = governorIface.encodeFunctionData("proposeTransaction", [
    ORACLE, 0, configAuTwap, 0
  ]);
  const govCall2 = governorIface.encodeFunctionData("proposeTransaction", [
    ORACLE, 0, addStakingTvl, 0
  ]);
  
  // Step 3: Timelock batch (Safe → Timelock)
  const batch = timelockIface.encodeFunctionData("executeBatch", [
    [GOVERNOR, GOVERNOR],  // targets
    [0, 0],                // values
    [govCall1, govCall2],  // calldatas (Governor calls Oracle)
    [0, 0]                 // locktimes
  ]);
  
  // Output the transaction data for the Safe to submit
  console.log("=== Safe Transaction ===");
  console.log("To:", TIMELOCK);
  console.log("Value:", 0);
  console.log("Data:", batch);
  console.log("");
  console.log("=== Decoded ===");
  console.log("Timelock.executeBatch:");
  console.log("  Target 1: Governor.proposeTransaction(ORACLE, 0, configureTwapPool(AU, POOL,, WETH, 600, true))");
  console.log("  Target 2: Governor.proposeTransaction(ORACLE, 0, addTvlSource(STAKING))");
  
  // Save to file for the Safe UI
  const safeTx = {
    to: TIMELOCK,
    value: "0",
    data: batch,
    operation: 0, // Call
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: "0x0000000000000000000000000000000000000000",
    refundReceiver: "0x0000000000000000000000000000000000000000",
  };
  fs.writeFileSync("scripts/oracle_config_safe_tx.json", JSON.stringify(safeTx, null, 2));
  console.log("\nSaved to scripts/oracle_config_safe_tx.json");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
