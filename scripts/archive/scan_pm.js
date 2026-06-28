const { ethers } = require("hardhat");
async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const code = await ethers.provider.getCode(PM);

  const targets = {
    "0x6d70c415": "mint(tuple)",
    "0x9e32ec9d": "mint(flat)",
    "0xb5007d1f": "mint(MintParams)",
    "0x88316456": "addLiquidity",
    "0x232aa5ac": "createPool",
    "0xac9650d8": "multicall",
    "0x0c49ccbe": "decreaseLiquidity",
    "0xfc6f7865": "collect",
    "0x12210e8a": "refundETH",
    "0x4aa4a4fc": "unwrapWETH9",
    "0xdf2ab5bb": "sweepToken",
    "0x42966c68": "burn",
    "0xa34123a7": "collect",
    "0x2f6f691f": "increaseLiquidity",
    "0x13ead562": "createAndInitializePoolIfNecessary",
  };

  console.log("Position Manager selectors:");
  for (const [sel, name] of Object.entries(targets)) {
    if (code.toLowerCase().includes(sel.toLowerCase())) {
      console.log(`  ✅ 0x${sel}: ${name}`);
    }
  }

  // Also find all selectors
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') found.add(sel);
    }
  }
  console.log(`\nAll ${found.size} selectors:`);
  for (const sel of [...found].sort()) {
    const name = targets[sel] || "???";
    console.log(`  0x${sel}: ${name}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
