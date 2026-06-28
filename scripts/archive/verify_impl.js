const { ethers } = require("hardhat");

async function main() {
  const auImpl = "0x4682C375969DBb1CDcbA1Eaedab7FC288c8fBb61";
  const agImpl = "0xBFD228862E407775D5911FD1a0fEF6bAb49534Da";
  const provider = ethers.provider;

  const auCode = await provider.getCode(auImpl);
  const agCode = await provider.getCode(agImpl);

  console.log("AuToken impl bytecode length:", auCode.length, auCode.length > 2 ? "✅ has code" : "❌ NO CODE");
  console.log("AgToken impl bytecode length:", agCode.length, agCode.length > 2 ? "✅ has code" : "❌ NO CODE");

  // Also verify proxy points back correctly
  const AU_PROXY = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG_PROXY = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";

  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const auSlot = await provider.getStorageAt(AU_PROXY, IMPLEMENTATION_SLOT);
  const agSlot = await provider.getStorageAt(AG_PROXY, IMPLEMENTATION_SLOT);
  const auImplOnChain = ethers.utils.getAddress("0x" + auSlot.slice(26));
  const agImplOnChain = ethers.utils.getAddress("0x" + agSlot.slice(26));

  console.log("\nOn-chain verification:");
  console.log("Au proxy → impl:", auImplOnChain, auImplOnChain.toLowerCase() === auImpl.toLowerCase() ? "✅" : "❌");
  console.log("Ag proxy → impl:", agImplOnChain, agImplOnChain.toLowerCase() === agImpl.toLowerCase() ? "✅" : "❌");
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
