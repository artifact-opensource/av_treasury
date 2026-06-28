const { ethers } = require("hardhat");
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";

async function check(name, addr, abi) {
  console.log(`\n=== ${name} (${addr}) ===`);
  const c = await ethers.getContractAt(abi, addr);
  
  // Governor - try admin()
  if (name === "GovernorContract") {
    try {
      // Governor's admin is set via changeAdmin or _admin
      const admin = await ethers.provider.getStorageAt(addr, "0x57"); // common admin slot
      console.log("  storage slot 0x57:", admin);
    } catch(e) {}
    // Try to call timelock/timelock()
    for (const fn of ["timelock", "proposalThreshold", "votingDelay", "votingPeriod", "quorumNumerator"]) {
      try { const r = await c[fn](); console.log(`  ${fn}() = ${r.toString().slice(0,42)}`); } catch(e) {}
    }
    // GovernorCompatibilityBlower admin
    try {
      const tx = await c.populateTransaction.changeAdmin(SAFE);
      console.log("  Can call changeAdmin:", tx.data ? "yes" : "no");
    } catch(e) { console.log("  changeAdmin error:", e.message.split('\n')[0]); }
  }
  
  // FlashLoan - immutable treasury
  if (name === "FlashLoan") {
    for (const fn of ["treasury", "dex", "auToken", "owner"]) {
      try { const r = await c[fn](); console.log(`  ${fn}() = ${r}`); } catch(e) {}
    }
  }
  
  // FlashBuy - immutable
  if (name === "TreasuryFlashBuy") {
    for (const fn of ["treasury", "flashLoan", "oracle", "dexSimulator", "owner", "staking"]) {
      try { const r = await c[fn](); console.log(`  ${fn}() = ${r}`); } catch(e) {}
    }
  }
  
  // DexSimulator - check owner
  if (name === "DexSimulator") {
    for (const fn of ["owner", "admin", "auToken", "agToken"]) {
      try { const r = await c[fn](); console.log(`  ${fn}() = ${r}`); } catch(e) {}
    }
    // Try Ownable owner slot
    try {
      const slot0 = await ethers.provider.getStorageAt(addr, "0x00");
      console.log("  storage[0]:", slot0);
    } catch(e) {}
  }
}

async function main() {
  await check("GovernorContract", "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03", [
    "function timelock() view returns(address)",
    "function votingDelay() view returns(uint256)",
    "function votingPeriod() view returns(uint256)",
    "function quorumNumerator() view returns(uint256)",
    "function proposalThreshold() view returns(uint256)",
    "function changeAdmin(address)",
  ]);
  
  await check("FlashLoan", "0x8DE65Bf42802EFBCbbdaaA89041FE7cd9C9858FA", [
    "function treasury() view returns(address)",
    "function dex() view returns(address)",
    "function auToken() view returns(address)",
  ]);
  
  await check("TreasuryFlashBuy", "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053", [
    "function treasury() view returns(address)",
    "function flashLoan() view returns(address)",
    "function oracle() view returns(address)",
    "function dexSimulator() view returns(address)",
  ]);
  
  await check("DexSimulator", "0xED29f07E7b6F017619D83FD55DA673eE648c613c", [
    "function owner() view returns(address)",
    "function auToken() view returns(address)",
    "function agToken() view returns(address)",
  ]);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
