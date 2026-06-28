const { ethers, network } = require("hardhat");

async function main() {
  const candidates = [
    "0x090b2A6bb475c00e2256e2095A60887cD710803b",  // Factory slot 2 (18542 bytes)
    "0x0AD08370c76Ff426F534bb2AFFD9b5555338ee68",  // Factory slot 4 (1804 bytes)
    "0x827922686190790b37229fd06084350E74485b72",  // Pool0 slot 4 (49086 bytes)
    "0x5C3F18F06CC09CA1910767A34a20F771039E37C0",  // Pool0 slot 5 (5300 bytes)
  ];
  
  for (const addr of candidates) {
    console.log(`\n--- ${addr} ---`);
    
    // Try common interfaces
    const contract = new ethers.Contract(addr, [
      "function owner() view returns (address)",
      "function factory() view returns (address)",
      "function WETH() view returns (address)",
      "function name() view returns (string)",
      "function nextTokenId() view returns (uint256)",
      "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
    ], ethers.provider);
    
    try { console.log("owner:", await contract.owner()); } catch(e) {}
    try { console.log("factory:", await contract.factory()); } catch(e) {}
    try { console.log("WETH:", await contract.WETH()); } catch(e) {}
    try { console.log("name:", await contract.name()); } catch(e) {}
    try { 
      const nextId = await contract.nextTokenId();
      console.log("nextTokenId:", nextId.toString());
      console.log(">>> THIS IS THE NonfungiblePositionManager! <<<");
    } catch(e) {}
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
