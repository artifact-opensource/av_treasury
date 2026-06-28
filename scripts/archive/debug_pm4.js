const { ethers, network } = require("hardhat");

async function main() {
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Let me check the actual recent mint transaction on the PM
  // to reverse-engineer the exact calldata format
  
  // From Basescan, the recent tx uses MethodID 0xb5007d1f
  // which is mint(MintParams)
  
  // But 0xb5007d1f is NOT in the bytecode as a PUSH4!
  // Wait — let me re-check. The bytecode scan might have missed it.
  const code = await ethers.provider.getCode(PM);
  
  // Check for 0xb5007d1f
  const sel = "63b5007d1f";
  const found = code.toLowerCase().includes(sel.toLowerCase());
  console.log("0xb5007d1f (mint V3-style) in bytecode:", found);
  
  // Check for 0x88316456 (multicall with deadline)
  const sel2 = "6388316456";
  const found2 = code.toLowerCase().includes(sel2.toLowerCase());
  console.log("0x88316456 (multicall256) in bytecode:", found2);
  
  // Check for 0x12210e8a (refundETH)
  const sel3 = "6312210e8a";
  const found3 = code.toLowerCase().includes(sel3.toLowerCase());
  console.log("0x12210e8a (refundETH) in bytecode:", found3);
  
  // Let me check the ACTUAL interface by looking at the PM as an ERC721
  const pm = new ethers.Contract(PM, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
    "function owner() view returns (address)",
    "function factory() view returns (address)",
  ], ethers.provider);
  
  console.log("\nPM name:", await pm.name());
  console.log("PM symbol:", await pm.symbol());
  try { console.log("PM totalSupply:", (await pm.totalSupply()).toString()); } catch(e) { console.log("totalSupply failed"); }
  try { console.log("PM balanceOf(deployer):", (await pm.balanceOf("0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E")).toString()); } catch(e) { console.log("balanceOf failed"); }
  
  // Try to find the positions() function
  // In V3, positions(uint256) returns a tuple
  const pm2 = new ethers.Contract(PM, [
    "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  ], ethers.provider);
  
  // Try reading position 1
  try {
    const pos = await pm2.positions(1);
    console.log("\nPosition 1:");
    console.log("  nonce:", pos.nonce.toString());
    console.log("  token0:", pos.token0);
    console.log("  token1:", pos.token1);
    console.log("  fee:", pos.fee.toString());
    console.log("  tickLower:", pos.tickLower.toString());
    console.log("  tickUpper:", pos.tickUpper.toString());
    console.log("  liquidity:", pos.liquidity.toString());
  } catch(e) {
    console.log("\npositions(1) failed:", e.reason || e.message.substring(0,100));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
