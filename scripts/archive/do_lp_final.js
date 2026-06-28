const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  const au = new ethers.Contract(AU, [
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
  ], deployer);

  // Approve
  const allowance = await au.allowance(deployer.address, POSITION_MANAGER);
  if (allowance.lt(amount)) {
    console.log("Approving...");
    await (await au.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
  }
  console.log("Au balance:", ethers.utils.formatUnits(await au.balanceOf(deployer.address), 18));

  // The correct ABI: mint with 12 params (extra uint160 at end = sqrtPriceX96)
  const pmIface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 600;
  const sqrtPriceX96 = ethers.BigNumber.from("7922816251426433759354395033"); // 0.01 ETH/Au
  // Also try with 0
  const sqrtPriceX96Alt = ethers.constants.Zero;

  const params = [
    AU, WETH, 100, -887200, 887200,
    amount, 0, 0, 0,
    TREASURY, deadline, sqrtPriceX96,
  ];

  const calldata = pmIface.encodeFunctionData("mint", [params]);
  console.log("Selector:", calldata.substring(0, 10));

  // Static call
  console.log("Static call...");
  try {
    await ethers.provider.call({ to: POSITION_MANAGER, from: deployer.address, data: calldata });
    console.log("✅ Static call succeeded!");
  } catch(e) {
    console.log("❌ Static:", e.message.substring(0, 200));
    return;
  }

  // Send tx
  console.log("Sending...");
  const tx = await deployer.sendTransaction({ to: POSITION_MANAGER, data: calldata, gasLimit: 500000 });
  const receipt = await tx.wait();
  console.log("Status:", receipt.status ? "✅ SUCCESS" : "❌ REVERT", "Gas:", receipt.gasUsed.toString());
  console.log("Logs:", receipt.logs.length);

  // Return remaining Au
  const remaining = await au.balanceOf(deployer.address);
  if (remaining.gt(0)) {
    console.log("Returning", ethers.utils.formatUnits(remaining, 18), "Au...");
    await (await au.transfer(TREASURY, remaining)).wait();
  }
  console.log("Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
