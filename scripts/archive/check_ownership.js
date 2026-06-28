const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";

const contracts = [
  ["QuasiCrystalLPNFT", "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8"],
  ["AVLPStaking_v2", "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3"],
  ["PID_Emission_Ctrl", "0xB8F240870DBc1cD5F9262F8180350A29ea404268"],
  ["ArtifactTimelock", "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77"],
  ["GovernorContract", "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03"],
  ["FlashLoan", "0x8DE65Bf42802EFBCbbdaaA89041FE7cd9C9858FA"],
  ["TreasuryFlashBuy", "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053"],
  ["AvOracle", "0x39E7A01da3fD73df7eED92a52F82237a381A01FE"],
  ["DexSimulator", "0xED29f07E7b6F017619D83FD55DA673eE648c613c"],
  ["TreasuryAMO", "0xF096cD4D24811B0F824c929907196bCB796bca88"],
];

async function main() {
  console.log("Checking ownership/admin for all contracts...\n");

  for (const [name, addr] of contracts) {
    const code = await ethers.provider.getCode(addr);
    if (code === "0x") { console.log(`❌ ${name} — NO CODE`); continue; }

    // Try owner() — Ownable
    try {
      const c = await ethers.getContractAt(["function owner() view returns(address)"], addr);
      const owner = await c.owner();
      const status = owner.toLowerCase() === SAFE.toLowerCase() ? "✅ SAFE" : 
                     owner.toLowerCase() === DEPLOYER.toLowerCase() ? "⚠️ DEPLOYER" : `❓ ${owner}`;
      console.log(`${name.padEnd(22)} owner() = ${status}`);
      continue;
    } catch(e) {}

    // Try getRoleMember(DEFAULT_ADMIN_ROLE) — AccessControl
    try {
      const c = await ethers.getContractAt([
        "function hasRole(bytes32,address) view returns(bool)",
        "function getRoleMember(bytes32,uint256) view returns(address)"
      ], addr);
      const DEFAULT_ADMIN = ethers.constants.HashZero;
      const hasSafe = await c.hasRole(DEFAULT_ADMIN, SAFE);
      const hasDeployer = await c.hasRole(DEFAULT_ADMIN, DEPLOYER);
      let status = "";
      if (hasSafe) status += "✅ SAFE ";
      if (hasDeployer) status += "⚠️ DEPLOYER ";
      if (!hasSafe && !hasDeployer) {
        const member = await c.getRoleMember(DEFAULT_ADMIN, 0);
        status = `❓ ${member}`;
      }
      console.log(`${name.padEnd(22)} ADMIN_ROLE = ${status}`);
      continue;
    } catch(e) {}

    // Try TimelockController pattern (TIMELOCK_ADMIN_ROLE)
    try {
      const c = await ethers.getContractAt([
        "function hasRole(bytes32,address) view returns(bool)",
        "function TIMELOCK_ADMIN_ROLE() view returns(bytes32)"
      ], addr);
      const adminRole = await c.TIMELOCK_ADMIN_ROLE();
      const hasSafe = await c.hasRole(adminRole, SAFE);
      const hasDeployer = await c.hasRole(adminRole, DEPLOYER);
      let status = "";
      if (hasSafe) status += "✅ SAFE ";
      if (hasDeployer) status += "⚠️ DEPLOYER ";
      console.log(`${name.padEnd(22)} TIMELOCK_ADMIN = ${status || "❓ none"}`);
      continue;
    } catch(e) {}

    console.log(`${name.padEnd(22)} — cannot determine ownership`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
