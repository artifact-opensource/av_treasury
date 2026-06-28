const { ethers } = require("hardhat");
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

const contracts = [
  ["NFT", "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8"],
  ["Staking", "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3"],
  ["PID", "0xB8F240870DBc1cD5F9262F8180350A29ea404268"],
  ["Timelock", "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77"],
  ["TreasuryAMO", "0xF096cD4D24811B0F824c929907196bCB796bca88"],
];

async function main() {
  const DEFAULT_ADMIN = ethers.constants.HashZero;
  
  for (const [name, addr] of contracts) {
    const c = await ethers.getContractAt([
      "function hasRole(bytes32,address) view returns(bool)",
      "function TIMELOCK_ADMIN_ROLE() view returns(bytes32)"
    ], addr);
    
    let adminRole = DEFAULT_ADMIN;
    if (name === "Timelock") {
      try { adminRole = await c.TIMELOCK_ADMIN_ROLE(); } catch(e) {}
    }
    
    const hasDeployer = await c.hasRole(adminRole, DEPLOYER);
    const hasSafe = await c.hasRole(adminRole, SAFE);
    
    console.log(`${name.padEnd(15)} deployer: ${hasDeployer ? "✅" : "❌"}  safe: ${hasSafe ? "✅" : "❌"}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
