const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  const au = new ethers.Contract(AU, [
    "function approve(address, uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
  ], deployer);

  const deployerBal = await au.balanceOf(deployer.address);
  console.log("Deployer Au balance:", ethers.utils.formatUnits(deployerBal, 18));

  // Use deployer's own 300K Au
  // Step 1: Approve PM
  console.log("1. Approving PositionManager...");
  await (await au.approve(POSITION_MANAGER, amount)).wait();
  console.log("   Done.");

  // Step 2: Mint LP (one-sided, Au only)
  console.log("2. Minting LP position...");
  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function mint((address,address,int24,int24,int24,uint256,uint256,uint256,uint256,address,uint256)) returns (uint256, uint128)",
  ], deployer);

  const params = [
    AU,          // token0
    WETH,        // token1
    100,         // tickSpacing
    -887200,     // tickLower
    887200,      // tickUpper
    amount,      // amount0Desired
    0,           // amount1Desired
    0,           // amount0Min
    0,           // amount1Min
    TREASURY,    // recipient
    Math.floor(Date.now() / 1000) + 300,  // deadline
  ];

  const tx = await pm.mint(params, { gasLimit: 500000 });
  const receipt = await tx.wait();
  console.log("   ✅ LP minted! Gas:", receipt.gasUsed.toString());

  // Step 3: Return remaining Au to Treasury
  const remaining = await au.balanceOf(deployer.address);
  if (remaining.gt(0)) {
    console.log("3. Returning remaining", ethers.utils.formatUnits(remaining, 18), "Au to Treasury...");
    await (await au.transfer(TREASURY, remaining)).wait();
    console.log("   Done.");
  }

  console.log("\n✅ All done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
