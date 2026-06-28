const { ethers } = require("hardhat");
const provider = ethers.provider;
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const addr = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
const slot = await provider.getStorageAt(addr, IMPLEMENTATION_SLOT);
const impl = ethers.utils.getAddress("0x" + slot.slice(26));
const code = await provider.getCode(impl);
console.log("Staking proxy:", addr);
console.log("Staking impl: ", impl, "bytecode len:", code.length);
