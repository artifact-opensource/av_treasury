const { ethers } = require("hardhat");

async function main() {
  const AU_PROXY = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG_PROXY = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

  // ERC-1967 storage slot for implementation
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  const provider = ethers.provider;

  const auImplSlot = await provider.getStorageAt(AU_PROXY, IMPLEMENTATION_SLOT);
  const agImplSlot = await provider.getStorageAt(AG_PROXY, IMPLEMENTATION_SLOT);

  const auImpl = ethers.utils.getAddress("0x" + auImplSlot.slice(26));
  const agImpl = ethers.utils.getAddress("0x" + agImplSlot.slice(26));

  console.log("AuToken Proxy:", AU_PROXY);
  console.log("AuToken Impl: ", auImpl);
  console.log("");
  console.log("AgToken Proxy:", AG_PROXY);
  console.log("AgToken Impl: ", agImpl);

  // Verify they're not zero
  if (auImpl === ethers.constants.AddressZero) console.log("\n⚠️ Au impl is zero — might be a different proxy pattern!");
  if (agImpl === ethers.constants.AddressZero) console.log("⚠️ Ag impl is zero — might be a different proxy pattern!");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
