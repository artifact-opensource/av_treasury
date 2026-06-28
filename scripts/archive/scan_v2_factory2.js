const { ethers } = require("hardhat");

async function main() {
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const code = await ethers.provider.getCode(V2_FACTORY);
  
  // Find all PUSH4 selectors (0x63xx)
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') {
        found.add(sel);
      }
    }
  }
  
  // Print all found selectors
  console.log(`Found ${found.size} selectors:`);
  for (const sel of [...found].sort()) {
    console.log(`  0x${sel}`);
  }
  
  // Now try to call the factory with common ABI to see what it actually is
  // Let's try a generic call to getPool
  const factory = new ethers.Contract(V2_FACTORY, [
    "function getPool(address,address) view returns (address)",
    "function getPool(address,address,bool) view returns (address)",
    "function allPairs(uint256) view returns (address)",
    "function allPairsLength() view returns (uint256)",
  ], ethers.provider);
  
  try { console.log("\nallPairsLength:", (await factory.allPairsLength()).toString()); } catch(e) { console.log("allPairsLength failed"); }
  try { console.log("allPairs(0):", await factory.allPairs(0)); } catch(e) { console.log("allPairs(0) failed"); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
