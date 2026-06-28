const { ethers } = require("hardhat");
const provider = ethers.provider;

async function main() {
  const AU_PROXY = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG_PROXY = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

  // Address book "original" impls
  const AU_OLD_IMPL = "0xe195d283A5e1c58B9C5D5a196656C2E1a39ad6F8";
  const AG_OLD_IMPL = "0x1DE8199a739cA80688E98a55f4b4a90D8D86229c";

  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  const auSlot = await provider.getStorageAt(AU_PROXY, IMPLEMENTATION_SLOT);
  const agSlot = await provider.getStorageAt(AG_PROXY, IMPLEMENTATION_SLOT);
  const auImpl = ethers.utils.getAddress("0x" + auSlot.slice(26));
  const agImpl = ethers.utils.getAddress("0x" + agSlot.slice(26));

  // Check old impls have code
  const auOldCode = await provider.getCode(AU_OLD_IMPL);
  const agOldCode = await provider.getCode(AG_OLD_IMPL);

  // Check new impls have code
  const auNewCode = await provider.getCode(auImpl);
  const agNewCode = await provider.getCode(agImpl);

  console.log("=== AuToken ===");
  console.log("Proxy:", AU_PROXY);
  console.log("Address book impl:", AU_OLD_IMPL, "bytecode:", auOldCode.length > 2 ? "✅" : "❌");
  console.log("On-chain impl:    ", auImpl, "bytecode:", auNewCode.length > 2 ? "✅" : "❌");
  console.log("Match?", auImpl.toLowerCase() === AU_OLD_IMPL.toLowerCase() ? "✅ SAME" : "❌ DIFFERENT — TOKEN WAS UPGRADED");

  console.log("\n=== AgToken ===");
  console.log("Proxy:", AG_PROXY);
  console.log("Address book impl:", AG_OLD_IMPL, "bytecode:", agOldCode.length > 2 ? "✅" : "❌");
  console.log("On-chain impl:    ", agImpl, "bytecode:", agNewCode.length > 2 ? "✅" : "❌");
  console.log("Match?", agImpl.toLowerCase() === AG_OLD_IMPL.toLowerCase() ? "✅ SAME" : "❌ DIFFERENT — TOKEN WAS UPGRADED");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
