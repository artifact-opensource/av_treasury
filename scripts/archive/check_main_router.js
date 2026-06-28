const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const ROUTER = "0x9bD062f6E0270601D044c3f0A1B4636F384d7A37";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  // This router is the most common one (0x57335dda selector)
  // Let me just try calling it with the same calldata pattern

  // First, check what this router is
  const code = await ethers.provider.getCode(ROUTER);
  console.log("Router code length:", code.length);

  // Check if it's verified on Basescan by looking at its selectors
  const found = new Set();
  for (let i = 0; i < code.length - 10; i += 2) {
    if (code.substring(i, i + 2).toLowerCase() === '63') {
      const sel = code.substring(i + 2, i + 10).toLowerCase();
      if (sel !== 'ffffffff' && sel !== '00000000') found.add(sel);
    }
  }

  // Check for 0x57335dda
  console.log("Has 0x57335dda:", found.has("57335dda"));
  console.log("Has 0xcf586c5c:", found.has("cf586c5c"));
  console.log("Has 0x0d390afd:", found.has("0d390afd"));
  console.log("Has 0xb5007d1f:", found.has("b5007d1f"));
  console.log("Has 0x6d70c415:", found.has("6d70c415"));
  console.log("Has 0xac9650d8 (multicall):", found.has("ac9650d8"));
  console.log("Has 0x88316456 (addLiquidity):", found.has("88316456"));
  console.log("Has 0x3593bc73 (exactInput):", found.has("3593bc73"));
  console.log("Has 0x414bf389 (exactOutputSingle):", found.has("414bf389"));

  // Print all selectors
  console.log("\nAll selectors:");
  for (const sel of [...found].sort()) {
    console.log(`  0x${sel}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
