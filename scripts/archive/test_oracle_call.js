const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Try with different gas limits
  for (const gas of [100000, 500000, 1000000, 3000000]) {
    try {
      const result = await ethers.provider.call({
        to: ORACLE,
        data: "0x63cde84b0000000000000000000000000c5a9a970b9c9b77a1ddb1cd62f279ce6cda2f08",
        gasLimit: gas,
      });
      console.log(`gas=${gas}: ✅ result=${result.slice(0,30)}...`);
    } catch(e) {
      console.log(`gas=${gas}: ❌ ${e.error?.message?.slice(0,80) || e.message.slice(0,80)}`);
    }
  }
  
  // Also check: does the oracle revert on ALL calls or just getTwapPrice?
  // Try getTvlSourceCount (pure view, no pool interaction)
  try {
    const result = await ethers.provider.call({
      to: ORACLE,
      data: "0x2096e13d", // getTvlSourceCount()
    });
    console.log("\ngetTvlSourceCount():", result.toString());
  } catch(e) {
    console.log("\ngetTvlSourceCount() also reverted:", e.message.slice(0,80));
  }
  
  // Try twapPools(AU)
  try {
    const result = await ethers.provider.call({
      to: ORACLE,
      data: "0x96a6ed790000000000000000000000000c5a9a970b9c9b77a1ddb1cd62f279ce6cda2f08", // twapPools(AU)
    });
    const pool = ethers.utils.defaultAbiCoder.decode(["address", "address", "address", "uint256", "bool"], result);
    console.log("\ntwapPools(AU):", pool);
  } catch(e) {
    console.log("\ntwapPools(AU) reverted:", e.message.slice(0,80));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
