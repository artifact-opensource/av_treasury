const { ethers } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";

  // Find the implementation
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const impl = await ethers.provider.getStorageAt(PM, implSlot);
  const implAddr = "0x" + impl.slice(26);
  console.log("Implementation:", implAddr);

  // Get recent Mint events from the PM
  // Mint event signature: IncreaseLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
  // IncreaseLiquidity selector: 0x30670488
  const increaseLiquidityTopic = ethers.utils.id("IncreaseLiquidity(uint256,uint128,uint256,uint256)");

  // Get logs from the last 1000 blocks
  const currentBlock = await ethers.provider.getBlockNumber();
  const logs = await ethers.provider.getLogs({
    address: PM,
    topics: [increaseLiquidityTopic],
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock,
  });

  console.log(`Found ${logs.length} IncreaseLiquidity events in last 10000 blocks`);

  if (logs.length > 0) {
    // Get the last successful mint transaction
    const lastLog = logs[logs.length - 1];
    console.log("\nLast IncreaseLiquidity event:");
    console.log("  Tx hash:", lastLog.transactionHash);
    console.log("  Block:", lastLog.blockNumber);

    // Get the transaction
    const tx = await ethers.provider.getTransaction(lastLog.transactionHash);
    console.log("  From:", tx.from);
    console.log("  To:", tx.to);
    console.log("  Data length:", tx.data.length);
    console.log("  Data:", tx.data.substring(0, 200) + "...");
  }

  // Also look for Transfer events (NFT minting)
  const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
  const transferLogs = await ethers.provider.getLogs({
    address: PM,
    topics: [transferTopic, null, null, null],
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock,
  });
  console.log(`\nFound ${transferLogs.length} Transfer events in last 10000 blocks`);

  if (transferLogs.length > 0) {
    const last = transferLogs[transferLogs.length - 1];
    const tx = await ethers.provider.getTransaction(last.transactionHash);
    console.log("  Tx hash:", last.transactionHash);
    console.log("  Data:", tx.data.substring(0, 200) + "...");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
