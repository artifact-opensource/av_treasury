const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const LP_NFT = "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8";
  
  // Check what this NFT is - try common interfaces
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256) view returns (string)",
    "function ownerOf(uint256) view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function factory() view returns (address)",
    "function positions(uint256) view returns (tuple(uint96 nonce, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1))",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
  ];
  
  const nft = new ethers.Contract(LP_NFT, abi, provider);
  
  try { console.log("Name:", await nft.name()); } catch(e) { console.log("No name()"); }
  try { console.log("Symbol:", await nft.symbol()); } catch(e) { console.log("No symbol()"); }
  try { console.log("Token0:", await nft.token0()); } catch(e) { console.log("No token0()"); }
  try { console.log("Token1:", await nft.token1()); } catch(e) { console.log("No token1()"); }
  try { console.log("Factory:", await nft.factory()); } catch(e) { console.log("No factory()"); }
  try { console.log("Total supply:", (await nft.totalSupply()).toString()); } catch(e) { console.log("No totalSupply()"); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
