const { ethers } = require("hardhat");
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const provider = ethers.provider;

const contracts = {
  QuasiCrystalLPNFT: "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8",
  AVLPStaking_v2: "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9",
  PID_Emission_Ctrl: "0xB8F240870DBc1cD5F9262F8180350A29ea404268",
  ArtifactTimelock: "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77",
  GovernorContract: "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03",
  FlashLoan: "0x4DDD1873964E5C2E3BE6712E199812903E6696B9",
  TreasuryFlashBuy: "0xCE73711EE793AF348837C09B729680B12DF6D8C0",
  AvOracle: "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19",
  DexSimulator: "0x2C1BD0E498CEA315DA7486A41FB3DD991DA302B2",
  TreasuryAMO: "0xF096cD4D24811B0F824c929907196bCB796bca88",
};

async function main() {
  for (const [name, addr] of Object.entries(contracts)) {
    const slot = await provider.getStorageAt(addr, IMPLEMENTATION_SLOT);
    const impl = ethers.utils.getAddress("0x" + slot.slice(26));
    const code = await provider.getCode(addr);
    const isProxy = impl !== ethers.constants.AddressZero;
    console.log(`${name.padEnd(22)} proxy=${addr}  impl=${impl}  bytecode=${code.length > 2 ? "has code" : "NO"}  ${isProxy ? "� PROXY" : "📍 EOA/NON-UUPS"}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
