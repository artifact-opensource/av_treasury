const { ethers } = require("hardhat");

async function main() {
  const V2_FACTORY = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Scan V2 Factory selectors
  const code = await ethers.provider.getCode(V2_FACTORY);
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
  
  const known = {
    "a1671295": "createPool(address,address)",
    "b4618538": "createPool(address,address,bool)",
    "d723e604": "createPool(address,address,bool,bool)",
    "09db8e70": "createPool(address,address,bool,bool,uint256)",
    "c45a0155": "factory()",
    "ad5c4648": "WETH()",
    "02751cec": "swapExactETHForTokens(uint256,address[],address,uint256)",
    "7ff36ab5": "swapExactTokensForETH(uint256,address[],address,uint256)",
    "18cbafe5": "swapExactTokensForTokens(uint256,address[],address,uint256)",
    "38ed1739": "swapExactTokensForTokens(uint256,address[],address,uint256)",
    "b6f9de95": "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)",
    "791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,address[],address,uint256)",
    "ac3b9678": "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
    "0a5574bb": "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)",
    "e8e33700": "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)",
    "23cf2832": "getPool(address,address)",
    "f6372b5c": "getPool(address,address,bool)",
  };
  
  console.log("V2 Factory selectors:");
  for (const sel of [...found].sort()) {
    const name = known[sel] || "???";
    console.log(`  0x${sel}: ${name}`);
  }
  
  // Try createPool on V2 factory
  const factory = new ethers.Contract(V2_FACTORY, [
    "function createPool(address,address) returns (address)",
    "function createPool(address,address,bool) returns (address)",
    "function getPool(address,address) view returns (address)",
    "function getPool(address,address,bool) view returns (address)",
  ], ethers.provider);
  
  // Check if pool already exists
  try {
    const pool = await factory.getPool(AU, WETH);
    console.log("\nExisting pool (2 args):", pool);
  } catch(e) { console.log("\ngetPool(2) failed"); }
  
  try {
    const pool = await factory.getPool(AU, WETH, false);
    console.log("Existing pool (3 args, volatile):", pool);
  } catch(e) { console.log("getPool(3, volatile) failed"); }
  
  try {
    const pool = await factory.getPool(AU, WETH, true);
    console.log("Existing pool (3 args, stable):", pool);
  } catch(e) { console.log("getPool(3, stable) failed"); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
