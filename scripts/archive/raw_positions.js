const { ethers, network } = require("hardhat");
async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const code = await ethers.provider.getCode(PM);
  console.log("positions(uint256) in code:", code.toLowerCase().includes("99fbab88"));
  
  // Try a raw eth_call with just the selector + tokenId
  const sel = "0x99fbab88";
  const tokenId = ethers.utils.hexZeroPad("0x01", 32); // position 1
  const data = sel + tokenId.slice(2);
  
  const result = await ethers.provider.call({
    to: PM,
    data: data
  });
  console.log("Raw positions(1) result:", result);
  
  // If we get data back, try to decode it
  if (result && result !== "0x") {
    // Try decoding as (uint96, address, address, address, int24, int24, int24, uint128, uint256, uint256, uint128, uint128)
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["uint96", "address", "address", "address", "int24", "int24", "int24", "uint128", "uint256", "uint256", "uint128", "uint128"],
        result
      );
      console.log("Decoded (with operator):", {
        nonce: decoded[0].toString(),
        operator: decoded[1],
        token0: decoded[2],
        token1: decoded[3],
        tickSpacing: decoded[4].toString(),
        tickLower: decoded[5].toString(),
        tickUpper: decoded[6].toString(),
        liquidity: decoded[7].toString(),
      });
    } catch(e) {
      console.log("Decode with operator failed:", e.message.substring(0,80));
    }
    
    // Try without operator
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["uint96", "address", "address", "int24", "int24", "int24", "uint128", "uint256", "uint256", "uint128", "uint128"],
        result
      );
      console.log("Decoded (no operator):", {
        nonce: decoded[0].toString(),
        token0: decoded[1],
        token1: decoded[2],
        tickSpacing: decoded[3].toString(),
        tickLower: decoded[4].toString(),
        tickUpper: decoded[5].toString(),
        liquidity: decoded[6].toString(),
      });
    } catch(e) {
      console.log("Decode without operator failed:", e.message.substring(0,80));
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
