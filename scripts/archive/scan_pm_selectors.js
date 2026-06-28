const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  
  // Get the bytecode
  const code = await ethers.provider.getCode(PM);
  
  // Check which function selectors exist in the bytecode
  const selectors = {
    'createAndInit(4)': 'f126fb67',
    'createAndInit(5)': 'c3d854ed',
    'mint(tuple)': '6d70c415',
    'multicall(bytes[])': 'ac9650d8',
    'owner()': '8da5cb5b',
    'factory()': 'c45a0155',
    'name()': '06fdde03',
    'symbol()': '95d89b41',
    'nextTokenId()': '5b5e139f',
    'WETH()': 'ad5c4648',
    'approve(address,uint256)': '095ea7b3',
    'transferFrom(address,address,uint256)': '23b872dd',
    'positions(uint256)': '991ab38c',
    'increaseLiquidity(tuple)': 'e8c4ec4d',
    'decreaseLiquidity(tuple)': '1c04b149',
    'collect(tuple)': 'fc6f5718',
    'burn(uint256)': '42966c68',
    'tokenOfOwnerByIndex(address,uint256)': '2f735c80',
    'balanceOf(address)': '70a08231',
    'totalSupply()': '18160ddd',
    'baseURI()': '6c3b6580',
    'tokenURI(uint256)': 'c87b56dd',
    'initialize(address,address,address)': '0edb7ebc',
    'setOperator(address,bool)': '5b5e139f',
    'poolDeployer()': 'e941a78a',
    'swapRouter()': '198a6b58',
    'quoter()': 'b5007d1f',
  };
  
  console.log("Function selectors in Position Manager bytecode:\n");
  for (const [name, sel] of Object.entries(selectors)) {
    // PUSH4 0xNNNNNNNN is encoded as 0x63NNNNNNNN
    const push4 = '63' + sel;
    const found = code.toLowerCase().includes(push4.toLowerCase());
    if (found) {
      console.log(`  ✅ ${name}: 0x${sel}`);
    }
  }
  
  // Also scan for all PUSH4 instructions to find unknown selectors
  console.log("\n\nAll function selectors in bytecode:");
  const foundSelectors = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (!foundSelectors.has(sel)) {
        foundSelectors.add(sel);
      }
    }
  }
  
  // Map known selectors
  const knownMap = {};
  for (const [name, sel] of Object.entries(selectors)) {
    knownMap[sel.toLowerCase()] = name;
  }
  
  for (const sel of [...foundSelectors].sort()) {
    const name = knownMap[sel] || '???';
    console.log(`  0x${sel}: ${name}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
