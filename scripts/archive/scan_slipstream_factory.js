const { ethers } = require("hardhat");

async function main() {
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const code = await ethers.provider.getCode(SLIPSTREAM_FACTORY);
  
  // Find all PUSH4 selectors
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') {
        found.add(sel);
      }
    }
  }
  
  // Known Aerodrome Slipstream selectors
  const known = {
    "232aa5ac": "createPool(address,address,int24,uint160)",
    "1e355be6": "createPool(address,address,int24,uint160,bool)",
    "c04b7998": "setOwner(address)",
    "8da5cb5b": "owner()",
    "f887ea40": "createPool(address,address,bool,int24,uint160)",  // maybe?
    "f220a9b1": "createPool(address,address,bool,int24,uint160,bool)",
    "5ae7e1f0": "mint(address,address,bool,int24,uint160,uint256,uint256,uint256,uint256,address,uint256)",
    "b5007d1f": "mint((address,address,bool,int24,uint160,uint256,uint256,uint256,uint256,address,uint256))",
    "ac9650d8": "multicall(bytes[])",
    "ba2b09e0": "setPoolDeployer(address)",
    "c45a0155": "factory()",
    "0c9fc45e": "isPoolDeployer(address)",
  };
  
  console.log("Slipstream Factory selectors:");
  for (const sel of [...found].sort()) {
    const name = known[sel] || "???";
    console.log(`  0x${sel}: ${name}`);
  }
  
  // Check if there's a poolDeployer function
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function poolDeployer() view returns (address)",
    "function isPoolDeployer(address) view returns (bool)",
    "function owner() view returns (address)",
  ], ethers.provider);
  
  try { console.log("\npoolDeployer:", await factory.poolDeployer()); } catch(e) { console.log("poolDeployer() not found"); }
  try { console.log("isPoolDeployer(deployer):", await factory.isPoolDeployer("0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E")); } catch(e) { console.log("isPoolDeployer() not found"); }
  try { console.log("owner:", await factory.owner()); } catch(e) { console.log("owner() not found"); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
