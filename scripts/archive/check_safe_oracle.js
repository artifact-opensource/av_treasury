const { ethers } = require("hardhat");

async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const GOVERNOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNOR"));
  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const provider = ethers.provider;
  const abi = [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, abi, provider);
  
  console.log("=== Oracle Roles ===");
  console.log("Safe has DEFAULT_ADMIN:", await oracle.hasRole(DEFAULT_ADMIN, SAFE));
  console.log("Safe has ORACLE_ADMIN:", await oracle.hasRole(ORACLE_ADMIN, SAFE));
  console.log("Safe has GOVERNOR:", await oracle.hasRole(GOVERNOR_ROLE, SAFE));
  console.log("Governor has ORACLE_ADMIN:", await oracle.hasRole(ORACLE_ADMIN, GOVERNOR));
  
  // Check DEFAULT_ADMIN can grant ORACLE_ADMIN to Safe
  const adminRole = await oracle.getRoleAdmin(ORACLE_ADMIN);
  console.log("\nORACLE_ADMIN admin role:", adminRole);
  console.log("Admin is DEFAULT_ADMIN?", adminRole === DEFAULT_ADMIN);
  
  // If Safe has DEFAULT_ADMIN, it can grant ORACLE_ADMIN to itself
  if (await oracle.hasRole(DEFAULT_ADMIN, SAFE)) {
    console.log("\n✅ Safe can grant ORACLE_ADMIN to itself!");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
