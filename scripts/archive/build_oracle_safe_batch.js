const { ethers } = require("hardhat");
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
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
  
  // Build calls
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [
    AU, POOL, AU, WETH, 600, true  // 10min TWAP, token0(AU) is the target
  ]);
  
  const addStakingTvl = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  // Build Safe execTransaction batch
  // Safe.execTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures)
  // For a batch, we use Safe.encodeTransactionData with multiSend, or just submit as separate txs
  
  // Simpler: output individual txs for the Safe UI
  const txs = [
    {
      to: ORACLE,
      value: "0",
      data: configAuTwap,
      description: "Configure AU TWAP (Aerodrome AU/WETH pool, 10min)"
    },
    {
      to: ORACLE,
      value: "0",
      data: addStakingTvl,
      description: "Add Staking as TVL source"
    }
  ];
  
  fs.writeFileSync("scripts/oracle_config_txs.json", JSON.stringify(txs, null, 2));
  
  console.log("=== Oracle Configuration Transactions ===");
  console.log("Submit these from the Safe (which has ORACLE_ADMIN role):\n");
  txs.forEach((tx, i) => {
    console.log(`${i+1}. ${tx.description}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Data: ${tx.data.slice(0, 66)}...`);
    console.log("");
  });
  
  console.log("Saved to scripts/oracle_config_txs.json");
  
  // Simulate both calls
  const provider = ethers.provider;
  for (const tx of txs) {
    try {
      await provider.call({ from: SAFE, to: tx.to, data: tx.data });
      console.log(`✅ Simulation passed: ${tx.description}`);
    } catch(e) { console.log(`❌ Simulation failed: ${e.message.slice(0,80)}`); }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
