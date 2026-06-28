const { ethers } = require("hardhat");
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";

async function check(name, addr, adminRoleType) {
  const c = await ethers.getContractAt([
    "function hasRole(bytes32,address) view returns(bool)",
    "function TIMELOCK_ADMIN_ROLE() view returns(bytes32)",
  ], addr);
  
  let role = ethers.constants.HashZero;
  if (adminRoleType === "TIMELOCK") {
    try { role = await c.TIMELOCK_ADMIN_ROLE(); } catch(e) {}
  }
  
  const has = await c.hasRole(role, DEPLOYER);
  console.log(`${name.padEnd(20)} deployer has ${adminRoleType}: ${has ? "✅ YES" : "❌ NO"}`);
  return has;
}

async function main() {
  console.log("Checking deployer admin status on all contracts...\n");
  
  await check("Staking", "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3", "DEFAULT");
  await check("FlashBuy(old)", "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053", "DEFAULT");
  await check("AvOracle", "0x39E7A01da3fD73df7eED92a52F82237a381A01FE", "DEFAULT");
  await check("DexSimulator", "0xED29f07E7b6F017619D83FD55DA673eE648c613c", "DEFAULT");
  await check("TreasuryAMO", "0xF096cD4D24811B0F824c929907196bCB796bca88", "DEFAULT");
  await check("PID", "0xB8F240870DBc1cD5F9262F8180350A29ea404268", "DEFAULT");
  await check("NFT", "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8", "DEFAULT");
  await check("Timelock", "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77", "TIMELOCK");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
