const { ethers, network } = require("hardhat");

async function main() {
  const ROUTER = "0xF4Ecd78EBEB6d36CF7f80B5B6B41453515fe2785";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const [deployer] = await ethers.getSigners();
  
  // Check router
  const router = new ethers.Contract(ROUTER, [
    "function WETH() view returns (address)",
    "function factory() view returns (address)",
    "function defaultFactory() view returns (address)",
    "function addLiquidity(address, address, bool, uint256, uint256, uint256, uint256, address, uint256) returns (uint256, uint256, uint256)",
  ], ethers.provider);
  
  try { console.log("WETH:", await router.WETH()); } catch(e) { console.log("WETH failed:", e.message.substring(0,60)); }
  try { console.log("factory:", await router.factory()); } catch(e) { console.log("factory failed:", e.message.substring(0,60)); }
  try { console.log("defaultFactory:", await router.defaultFactory()); } catch(e) { console.log("defaultFactory failed:", e.message.substring(0,60)); }
  
  // Scan selectors
  const code = await ethers.provider.getCode(ROUTER);
  const targets = {
    "addLiquidity": "88316456",
    "swapExactTokensForTokens": "38ed1739",
    "getAmountsOut": "d9ca4125",
    "WETH": "ad5c4648",
    "factory": "c45a0155",
  };
  
  console.log("\nRouter selectors:");
  for (const [name, sel] of Object.entries(targets)) {
    const found = code.toLowerCase().includes(sel.toLowerCase());
    console.log(`  ${name} (0x${sel}): ${found ? "✅" : "❌"}`);
  }
  
  // Try getAmountsOut to verify the router works
  const routerFull = new ethers.Contract(ROUTER, [
    "function getAmountsOut(uint256, address[], address[]) returns (uint256[])",
  ], ethers.provider);
  
  // Try standard Velodrome V2 Router
  const router2 = new ethers.Contract(ROUTER, [
    "function getAmountsOut(uint256, address[], bool[]) returns (uint256[])",
  ], ethers.provider);
  
  try {
    const amounts = await router2.getAmountsOut(
      ethers.utils.parseUnits("1", 18),
      [AU, WETH],
      [false]
    );
    console.log("\n1 Au =", ethers.utils.formatEther(amounts[1]), "WETH");
  } catch(e) {
    console.log("\ngetAmountsOut with bool[] failed:", e.message.substring(0,80));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
