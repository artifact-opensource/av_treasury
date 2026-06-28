const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  
  // Check PM code
  const code = await ethers.provider.getCode(PM);
  console.log("PM code length:", code.length);
  console.log("PM code first 200 chars:", code.substring(0, 200));
  
  // Try basic calls that should work on any contract
  const pm = new ethers.Contract(PM, [
    "function owner() view returns (address)",
    "function factory() view returns (address)",
    "function WETH() view returns (address)",
    "function nextTokenId() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
  ], ethers.provider);
  
  try { console.log("owner:", await pm.owner()); } catch(e) { console.log("owner failed:", e.reason || e.message.substring(0,80)); }
  try { console.log("factory:", await pm.factory()); } catch(e) { console.log("factory failed:", e.reason || e.message.substring(0,80)); }
  try { console.log("WETH:", await pm.WETH()); } catch(e) { console.log("WETH failed:", e.reason || e.message.substring(0,80)); }
  try { console.log("nextTokenId:", (await pm.nextTokenId()).toString()); } catch(e) { console.log("nextTokenId failed:", e.reason || e.message.substring(0,80)); }
  try { console.log("name:", await pm.name()); } catch(e) { console.log("name failed:", e.reason || e.message.substring(0,80)); }
  try { console.log("symbol:", await pm.symbol()); } catch(e) { console.log("symbol failed:", e.reason || e.message.substring(0,80)); }
  
  // Check the implementation using different methods
  // Maybe it's a minimal proxy (EIP-1167)
  // Clone pattern: code starts with 0x3d604d...
  if (code.startsWith("0x3d60")) {
    console.log("\nThis is a minimal proxy (EIP-1167 clone)!");
  }
  
  // Check if it's a Gnosis Safe proxy (starts with 0x60806040...)
  console.log("\nCode starts with:", code.substring(0, 20));
  
  // Try to find the implementation by checking known proxy patterns
  // Slot 0: often the implementation in custom proxies
  const slot0 = await ethers.provider.getStorageAt(PM, 0);
  console.log("Slot 0:", slot0);
  
  // Check if slot 0 is a valid address with code
  const addr0 = "0x" + slot0.slice(26);
  try {
    const c0 = ethers.utils.getAddress(addr0);
    const code0 = await ethers.provider.getCode(c0);
    console.log("Slot 0 as address:", c0, "code:", code0.length);
  } catch(e) {}
  
  // Try the _implementation slot used by some proxies
  // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
  const implSlot2 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d648bbc";
  const impl2 = await ethers.provider.getStorageAt(PM, implSlot2);
  console.log("ERC1967 impl:", impl2);
  
  // Try the admin slot
  const adminSlot = "0xb53127684a568b31733613b10f0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b";
  const admin = await ethers.provider.getStorageAt(PM, adminSlot);
  console.log("Admin slot:", admin);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
