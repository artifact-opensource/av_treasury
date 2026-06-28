const { ethers } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";

  // Look for direct calls to PM with mint selector
  const currentBlock = await ethers.provider.getBlockNumber();

  // Get recent transactions TO the PM
  // We can't filter by "to" with getLogs, so let's look at the mint NFT Transfer events
  const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
  const logs = await ethers.provider.getLogs({
    address: PM,
    topics: [transferTopic, ethers.utils.hexZeroPad("0x0000000000000000000000000000000000000000", 32), null, null],
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock,
  });

  console.log(`Found ${logs.length} NFT mints in last 10000 blocks`);

  // Get unique transactions
  const seenTxs = new Set();
  for (let i = logs.length - 1; i >= 0 && seenTxs.size < 5; i--) {
    seenTxs.add(logs[i].transactionHash);
  }

  for (const txHash of seenTxs) {
    const tx = await ethers.provider.getTransaction(txHash);
    console.log(`\n=== ${txHash} ===`);
    console.log(`To: ${tx.to}`);
    console.log(`Selector: ${tx.data.substring(0, 10)}`);
    console.log(`Data length: ${tx.data.length}`);

    if (tx.to && tx.to.toLowerCase() === PM.toLowerCase()) {
      console.log("DIRECT PM CALL!");
      // Try to decode
      const selector = tx.data.substring(0, 10);
      console.log("Selector:", selector);

      if (selector === "0xb5007d1f" || selector === "0x6d70c415") {
        // Mint function - the data after selector is the tuple
        // For tuple params, the encoding is: offset (32 bytes) + tuple_data
        const afterSelector = tx.data.slice(10);
        console.log("After selector:", afterSelector.substring(0, 200));

        // The offset should be 0x20 (32 bytes) since there's only one param
        const offset = ethers.BigNumber.from("0x" + afterSelector.slice(0, 64)).toNumber();
        console.log("Offset:", offset);

        // The tuple data starts at offset * 2 (hex chars) after the offset field
        const tupleStart = (offset) * 2;
        const tupleData = "0x" + afterSelector.slice(tupleStart);

        // Try decoding as the 12-param struct
        try {
          const decoded = ethers.utils.defaultAbiCoder.decode(
            ["tuple(address,address,int24,int24,int24,uint256,uint256,uint256,uint256,address,uint256,uint160)"],
            tupleData
          );
          console.log("12-param decode:", JSON.stringify(decoded[0], null, 2));
        } catch(e) {
          console.log("12-param failed:", e.message.substring(0, 80));
        }
      }
    } else {
      console.log("Via:", tx.to);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
