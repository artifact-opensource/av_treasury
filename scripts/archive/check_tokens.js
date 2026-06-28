const { ethers, network } = require("hardhat");

async function main() {
  const AU_TOKEN = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const USDC = "0x833589fcD6EDB6e08f4c7a32D7278e5112C0C0b8";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // USDC on Base — check if it works
  const usdc = new ethers.Contract(USDC, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
  ], ethers.provider);
  
  try { console.log("USDC name:", await usdc.name()); } catch(e) { console.log("USDC name failed:", e.message.substring(0,80)); }
  try { console.log("USDC symbol:", await usdc.symbol()); } catch(e) { console.log("USDC symbol failed:", e.message.substring(0,80)); }
  try { console.log("USDC decimals:", (await usdc.decimals()).toString()); } catch(e) { console.log("USDC decimals failed:", e.message.substring(0,80)); }
  
  // Try WETH
  const weth = new ethers.Contract(WETH, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ], ethers.provider);
  
  try { console.log("WETH name:", await weth.name()); } catch(e) { console.log("WETH name failed:", e.message.substring(0,80)); }
  try { console.log("WETH symbol:", await weth.symbol()); } catch(e) { console.log("WETH symbol failed:", e.message.substring(0,80)); }
  try { console.log("WETH decimals:", (await weth.decimals()).toString()); } catch(e) { console.log("WETH decimals failed:", e.message.substring(0,80)); }
  
  // Check AuToken
  const auToken = await ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", AU_TOKEN);
  console.log("AuToken decimals:", (await auToken.decimals()).toString());
  console.log("AuToken symbol:", await auToken.symbol());
  
  // Check deployer USDC balance
  const [deployer] = await ethers.getSigners();
  try { 
    const usdcBal = await usdc.balanceOf(await deployer.getAddress());
    console.log("Deployer USDC balance:", ethers.utils.formatUnits(usdcBal, 6));
  } catch(e) { console.log("USDC balanceOf failed:", e.message.substring(0,80)); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
