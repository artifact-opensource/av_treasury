const { ethers, network } = require("hardhat");

async function main() {
  const ROUTER = "0xF4Ecd78EBEB6d36CF7f80B5B6B41453515fe2785";
  const code = await ethers.provider.getCode(ROUTER);
  
  // Find all PUSH4 selectors
  const found = new Set();
  const codeLower = code.toLowerCase();
  for (let i = 0; i < codeLower.length - 10; i += 2) {
    if (codeLower.substring(i, i + 2) === '63') {
      const sel = codeLower.substring(i + 2, i + 10);
      if (sel !== 'ffffffff' && sel !== '00000000') {
        found.add(sel);
      }
    }
  }
  
  // Look up known selectors
  const known = {
    "c45a0155": "factory()",
    "12210e8a": "refundETH()",
    "4aa4a4fc": "unwrapWETH9(uint256,address)",
    "df2ab5bb": "sweepToken(address,uint256,address)",
    "b5007d1f": "mint(MintParams)",
    "ac9650d8": "multicall(bytes[])",
    "232aa5ac": "createPool(address,address,int24,uint160)",
    "5ae7e1f0": "addLiquidity(address,address,bool,uint256,uint256,uint256,uint256,address,uint256)",
    "f415f087": "addLiquidity(address,address,bool,uint256,uint256,uint256,uint256,address,uint256,uint256)",
  };
  
  console.log("V2 Router selectors:");
  for (const sel of [...found].sort()) {
    const name = known[sel] || "???";
    console.log(`  0x${sel}: ${name}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
