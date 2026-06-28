const { ethers } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
  const currentBlock = await ethers.provider.getBlockNumber();

  const logs = await ethers.provider.getLogs({
    address: PM,
    topics: [transferTopic, ethers.utils.hexZeroPad("0x0000000000000000000000000000000000000000", 32), null, null],
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock,
  });

  // Count selectors
  const selectorCounts = {};
  const uniqueTxs = new Set();
  for (let i = logs.length - 1; i >= 0; i--) {
    const txHash = logs[i].transactionHash;
    if (uniqueTxs.has(txHash)) continue;
    if (uniqueTxs.size >= 50) break;
    uniqueTxs.add(txHash);

    const tx = await ethers.provider.getTransaction(txHash);
    const sel = tx.data.substring(0, 10);
    const to = tx.to;
    const key = `${to}|${sel}`;
    selectorCounts[key] = (selectorCounts[key] || 0) + 1;
  }

  console.log("Selector distribution (top 20):");
  const sorted = Object.entries(selectorCounts).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sorted.slice(0, 20)) {
    const [to, sel] = key.split("|");
    console.log(`  ${count}x ${to} ${sel}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
