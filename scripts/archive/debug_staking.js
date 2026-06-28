const { ethers } = require("hardhat");

async function main() {
  const STAKING = "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

  // Check raw storage slots
  console.log("=== STAKING RAW STORAGE ===");
  for (let i = 0; i < 30; i++) {
    const val = await ethers.provider.getStorageAt(STAKING, i);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`  slot[${i}] = ${val}`);
    }
  }

  console.log("\n=== AMO RAW STORAGE ===");
  const AMO = "0xF096cD4D24811B0F824c929907196bCB796bca88";
  for (let i = 0; i < 30; i++) {
    const val = await ethers.provider.getStorageAt(AMO, i);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`  slot[${i}] = ${val}`);
    }
  }

  console.log("\n=== FLASHBUY RAW STORAGE ===");
  const FB = "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053";
  for (let i = 0; i < 20; i++) {
    const val = await ethers.provider.getStorageAt(FB, i);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`  slot[${i}] = ${val}`);
    }
  }

  console.log("\n=== ORACLE RAW STORAGE ===");
  const ORACLE = "0x39E7A01da3fD73df7eED92a52F82237a381A01FE";
  for (let i = 0; i < 20; i++) {
    const val = await ethers.provider.getStorageAt(ORACLE, i);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`  slot[${i}] = ${val}`);
    }
  }

  console.log("\n=== DEXSIM RAW STORAGE ===");
  const DS = "0xED29f07E7b6F017619D83FD55DA673eE648c613c";
  for (let i = 0; i < 20; i++) {
    const val = await ethers.provider.getStorageAt(DS, i);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`  slot[${i}] = ${val}`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
