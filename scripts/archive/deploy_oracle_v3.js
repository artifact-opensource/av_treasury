const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "deployed_stack.json");

async function main() {
  const old = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  
  const AvOracle = await ethers.getContractFactory("contracts/av_suite/AvOracle.sol:AvOracle");
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR_ADDR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const oracle = await AvOracle.deploy(
    "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",  // auToken
    "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",  // agToken
    SAFE,                                                // admin (Safe)
    GOVERNOR_ADDR                                        // governor
  );
  await oracle.deployed();
  console.log("AvOracle v3 deployed:", oracle.address);

  // Update deployed_stack.json
  old.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(old, null, 2));

  // Wait for verification
  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", {
      address: oracle.address,
      constructorArguments: [
        "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
        "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
        "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e",
        "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03"
      ]
    });
    old.AvOracle.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(old, null, 2));
    console.log("✅ Verified");
  } catch(e) { console.log("⚠️ Verify:", e.message.split('\n')[0]); }

  // Verify roles
  const GOVERNOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNOR"));
  const ORACLE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ADMIN"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const governorAddr = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const safeAddr = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  console.log("Governor has GOVERNOR:", await oracle.hasRole(GOVERNOR_ROLE, governorAddr));
  console.log("Governor has ORACLE_ADMIN:", await oracle.hasRole(ORACLE_ADMIN_ROLE, governorAddr));
  console.log("Safe has DEFAULT_ADMIN:", await oracle.hasRole(DEFAULT_ADMIN_ROLE, safeAddr));
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
