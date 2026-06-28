const { ethers } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const increaseLiquidityTopic = ethers.utils.id("IncreaseLiquidity(uint256,uint128,uint256,uint256)");

  const currentBlock = await ethers.provider.getBlockNumber();
  const logs = await ethers.provider.getLogs({
    address: PM,
    topics: [increaseLiquidityTopic],
    fromBlock: currentBlock - 5000,
    toBlock: currentBlock,
  });

  // Get the last 5 unique transactions
  const seenTxs = new Set();
  const uniqueLogs = [];
  for (let i = logs.length - 1; i >= 0 && uniqueLogs.length < 5; i--) {
    if (!seenTxs.has(logs[i].transactionHash)) {
      seenTxs.add(logs[i].transactionHash);
      uniqueLogs.push(logs[i]);
    }
  }

  for (const log of uniqueLogs) {
    const tx = await ethers.provider.getTransaction(log.transactionHash);
    console.log(`\n=== Tx ${log.transactionHash} ===`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Selector: ${tx.data.substring(0, 10)}`);

    // If it's calling the PM directly, decode the mint params
    if (tx.to && tx.to.toLowerCase() === PM.toLowerCase()) {
      console.log("  Direct PM call!");
      console.log("  Full data:", tx.data.substring(0, 300));
    } else {
      console.log("  Via router:", tx.to);
      // The router call might contain a mint call inside
      console.log("  Data:", tx.data.substring(0, 300));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
