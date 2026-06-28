const { ethers } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const ROUTER = "0x61040E143A77F165Ba44543AF4A079F2C809D14b";
  const increaseLiquidityTopic = ethers.utils.id("IncreaseLiquidity(uint256,uint128,uint256,uint256)");

  const currentBlock = await ethers.provider.getBlockNumber();
  const logs = await ethers.provider.getLogs({
    address: PM,
    topics: [increaseLiquidityTopic],
    fromBlock: currentBlock - 5000,
    toBlock: currentBlock,
  });

  // Get unique transactions
  const seenTxs = new Set();
  for (let i = logs.length - 1; i >= 0 && seenTxs.size < 3; i--) {
    seenTxs.add(logs[i].transactionHash);
  }

  for (const txHash of seenTxs) {
    const tx = await ethers.provider.getTransaction(txHash);
    console.log(`\n=== ${txHash} ===`);
    console.log(`To: ${tx.to}`);
    console.log(`Selector: ${tx.data.substring(0, 10)}`);

    // Decode the calldata
    // 0x0d390afd = the function selector
    // After selector, there's an offset pointer, then the data
    const data = tx.data.slice(10); // remove 0x + selector

    // First 32 bytes = offset to the first parameter
    const offset1 = ethers.BigNumber.from("0x" + data.slice(0, 64)).toNumber();
    console.log("Offset1:", offset1);

    // Try to decode as: addLiquidity(address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)
    // Or maybe it takes a struct

    // Let's try decoding the raw data after the selector
    // The data starts with an offset (32 bytes), then the struct data
    const structOffset = 32; // offset is usually 0x20 = 32
    const structData = data.slice(structOffset * 2); // in hex chars

    // Try to decode as flat params
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "address", "int24", "int24", "int24", "uint256", "uint256", "uint256", "uint256", "address", "uint256"],
        "0x" + structData
      );
      console.log("Decoded as flat params:");
      console.log("  token0:", decoded[0]);
      console.log("  token1:", decoded[1]);
      console.log("  tickSpacing:", decoded[2].toString());
      console.log("  tickLower:", decoded[3].toString());
      console.log("  tickUpper:", decoded[4].toString());
      console.log("  amount0Desired:", ethers.utils.formatUnits(decoded[5], 18));
      console.log("  amount1Desired:", ethers.utils.formatUnits(decoded[6], 18));
      console.log("  amount0Min:", ethers.utils.formatUnits(decoded[7], 18));
      console.log("  amount1Min:", ethers.utils.formatUnits(decoded[8], 18));
      console.log("  recipient:", decoded[9]);
      console.log("  deadline:", decoded[10].toString());
    } catch(e) {
      console.log("Flat decode failed:", e.message.substring(0, 100));

      // Try with different param order or extra fields
      try {
        const decoded2 = ethers.utils.defaultAbiCoder.decode(
          ["address", "address", "int24", "int24", "int24", "uint256", "uint256", "uint256", "uint256", "address", "uint256", "uint160"],
          "0x" + structData
        );
        console.log("Decoded with sqrtPriceX96:");
        console.log("  token0:", decoded2[0]);
        console.log("  token1:", decoded2[1]);
        console.log("  tickSpacing:", decoded2[2].toString());
        console.log("  tickLower:", decoded2[3].toString());
        console.log("  tickUpper:", decoded2[4].toString());
        console.log("  amount0Desired:", ethers.utils.formatUnits(decoded2[5], 18));
        console.log("  amount1Desired:", ethers.utils.formatUnits(decoded2[6], 18));
        console.log("  amount0Min:", ethers.utils.formatUnits(decoded2[7], 18));
        console.log("  amount1Min:", ethers.utils.formatUnits(decoded2[8], 18));
        console.log("  recipient:", decoded2[9]);
        console.log("  deadline:", decoded2[10].toString());
        console.log("  sqrtPriceX96:", decoded2[11].toString());
      } catch(e2) {
        console.log("SqrtPrice decode also failed:", e2.message.substring(0, 100));

        // Maybe the first param is an offset to a struct, not the struct itself
        // Let's try: offset (32 bytes) + struct data
        const afterOffset = data.slice(64); // skip the 32-byte offset
        try {
          const decoded3 = ethers.utils.defaultAbiCoder.decode(
            ["address", "address", "int24", "int24", "int24", "uint256", "uint256", "uint256", "uint256", "address", "uint256"],
            "0x" + afterOffset
          );
          console.log("Decoded after offset:");
          console.log("  token0:", decoded3[0]);
          console.log("  token1:", decoded3[1]);
          console.log("  tickSpacing:", decoded3[2].toString());
          console.log("  tickLower:", decoded3[3].toString());
          console.log("  tickUpper:", decoded3[4].toString());
          console.log("  amount0Desired:", ethers.utils.formatUnits(decoded3[5], 18));
          console.log("  amount1Desired:", ethers.utils.formatUnits(decoded3[6], 18));
          console.log("  amount0Min:", ethers.utils.formatUnits(decoded3[7], 18));
          console.log("  amount1Min:", ethers.utils.formatUnits(decoded3[8], 18));
          console.log("  recipient:", decoded3[9]);
          console.log("  deadline:", decoded3[10].toString());
        } catch(e3) {
          console.log("After offset also failed:", e3.message.substring(0, 100));
          console.log("Raw data (first 500):", tx.data.substring(0, 500));
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
