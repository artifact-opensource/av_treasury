const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const WETH = "0x4200000000000000000000000000000000000006";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";

async function main() {
  // Use Safe as signer (it has DEFAULT_ADMIN role)
  const safe = await ethers.getContractAt("GnosisSafe", SAFE);
  const oracle = await ethers.getContractAt("contracts/av_suite/AvOracle.sol:AvOracle", ORACLE);
  
  // Get Safe owners
  const owners = await safe.getOwners();
  console.log("Safe owners:", owners);
  console.log("Safe threshold:", (await safe.getThreshold()).toString());
  
  // We need to submit via the Governor (which has GOVERNOR + ORACLE_ADMIN roles)
  // OR directly from Safe (DEFAULT_ADMIN can grant ORACLE_ADMIN, or Safe can be admin)
  
  // Check if Safe has ORACLE_ADMIN
  const ORACLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const safeHasAdmin = await oracle.hasRole(ORACLE_ADMIN, SAFE);
  const safeHasGovernor = await oracle.hasRole(await oracle.GOVERNOR(), SAFE);
  console.log("Safe has ORACLE_ADMIN?", safeHasAdmin);
  console.log("Safe has GOVERNOR?", safeHasGovernor);
  
  // Check DEFAULT_ADMIN can grant ORACLE_ADMIN to Safe
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const safeHasDefaultAdmin = await oracle.hasRole(DEFAULT_ADMIN_ROLE, SAFE);
  console.log("Safe has DEFAULT_ADMIN?", safeHasDefaultAdmin);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
