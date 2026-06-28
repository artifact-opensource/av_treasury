const { ethers } = require("hardhat");

async function main() {
  const oracle = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19");
  
  const GOVERNOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNOR"));
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const governorAddr = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const safeAddr = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  
  console.log("GOVERNOR role granted to GovernorContract?", await oracle.hasRole(GOVERNOR, governorAddr));
  console.log("ORACLE_ADMIN role granted to GovernorContract?", await oracle.hasRole(ORACLE_ADMIN, governorAddr));
  console.log("DEFAULT_ADMIN role granted to GovernorContract?", await oracle.hasRole(DEFAULT_ADMIN, governorAddr));
  console.log("DEFAULT_ADMIN role granted to Safe?", await oracle.hasRole(DEFAULT_ADMIN, safeAddr));
  
  // Check timelock (should be the governor via the timelock)
  const timelock = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  console.log("GOVERNOR role granted to Timelock?", await oracle.hasRole(GOVERNOR, timelock));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
