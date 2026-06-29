const { ethers } = require("hardhat");

const ORACLE = "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";

const abi = [
  "function twapPools(address) view returns (address pool, address targetToken, address quoteToken, uint32 twapPeriod, bool active)",
  "function priceFeeds(address) view returns (address aggregator, uint8 primarySource, uint8 secondarySource, uint16 maxDeviationBps, bool active)",
  "function cachedPrices(address) view returns (uint256 price, uint256 timestamp, uint8 source, bool valid)",
  "function getPrice(address) view returns (uint256, uint8)",
  "function getTwapPrice(address) view returns (uint256)",
];

async function main() {
  const oracle = new ethers.Contract(ORACLE, abi, ethers.provider);
  
  console.log("=== AG on Oracle v5 ===");
  const feed = await oracle.priceFeeds(AG);
  console.log("Price feed:", feed.aggregator, "active:", feed.active, "primarySource:", feed.primarySource);
  
  const twap = await oracle.twapPools(AG);
  console.log("TWAP pool:", twap.pool, "active:", twap.active, "quoteToken:", twap.quoteToken);
  
  const cached = await oracle.cachedPrices(AG);
  console.log("Cached:", cached.price.toString(), "valid:", cached.valid, "source:", cached.source);
  
  console.log("\n=== AU on Oracle v5 (reference) ===");
  const auFeed = await oracle.priceFeeds(AU);
  console.log("AU feed:", auFeed.aggregator, "active:", auFeed.active);
  const auTwap = await oracle.twapPools(AU);
  console.log("AU TWAP:", auTwap.pool, "active:", auTwap.active);
  const auCached = await oracle.cachedPrices(AU);
  console.log("AU cached:", auCached.price.toString(), "valid:", auCached.valid, "source:", auCached.source);
  
  // Check how AG is minted — look at AgToken
  console.log("\n=== AgToken mint logic ===");
  const AG_TOKEN = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  const agAbi = [
    "function oracle() view returns (address)",
    "function AU() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
    "function treasury() view returns (address)",
    "function getMintPrice() view returns (uint256)",
    "function mintPrice() view returns (uint256)",
    "function AUPrice() view returns (uint256)",
  ];
  const ag = new ethers.Contract(AG_TOKEN, agAbi, ethers.provider);
  
  try { console.log("totalSupply:", (await ag.totalSupply()).toString()); } catch(e) {}
  try { console.log("oracle:", await ag.oracle()); } catch(e) {}
  try { console.log("AU:", await ag.AU()); } catch(e) {}
  try { console.log("owner:", await ag.owner()); } catch(e) {}
  try { console.log("treasury:", await ag.treasury()); } catch(e) {}
  try { console.log("mintPrice:", (await ag.mintPrice()).toString()); } catch(e) {}
  try { console.log("AUPrice:", (await ag.AUPrice()).toString()); } catch(e) {}
  try { 
    const [price, src] = await oracle.getPrice(AU);
    console.log("oracle.getPrice(AU):", price.toString(), "src:", src.toString());
  } catch(e) {
    console.log("oracle.getPrice(AU) failed:", e.message.slice(0, 60));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
