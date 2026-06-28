const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x5332953B7EEa5092b1C620849256cFaF15E5cB53";
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const abi = ["function hasRole(bytes32, address) view returns (bool)", "function getRoleAdmin(bytes32) view returns (bytes32)"];
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  console.log("Safe has DEFAULT_ADMIN:", await oracle.hasRole(DEFAULT_ADMIN, SAFE));
  console.log("Safe has ORACLE_ADMIN:", await oracle.hasRole(ORACLE_ADMIN, SAFE));
  console.log("Governor has ORACLE_ADMIN:", await oracle.hasRole(ORACLE_ADMIN, GOVERNOR));
  
  const adminOfOracleAdmin = await oracle.getRoleAdmin(ORACLE_ADMIN);
  console.log("Admin of ORACLE_ADMIN role:", adminOfOracleAdmin);
  console.log("Is DEFAULT_ADMIN?", adminOfOracleAdmin === DEFAULT_ADMIN);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.slice(0,60)); process.exit(1); });
