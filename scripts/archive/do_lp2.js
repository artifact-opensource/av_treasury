const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  // Use Interface to encode the mint call properly
  // Step 1: Approve
  console.log("1. Approving PM...");
  const au = new ethers.Contract(AU, ["function approve(address, uint256) returns (bool)"], deployer);
  await (await au.approve(POSITION_MANAGER, amount)).wait();
  console.log("   Done.");

  const pmInterface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 300;

  // Try narrow range around current price first
  // Current price ≈ 0.01 ETH/Au, tick ≈ -46050 (for tickSpacing=100, that's -46000)
  const currentTick = -46000;

  const calldata = pmInterface.encodeFunctionData("mint", [{
    token0: AU,
    token1: WETH,
    tickSpacing: 100,
    tickLower: -887200,
    tickUpper: 887200,
    amount0Desired: amount,
    amount1Desired: 0,
    amount0Min: 0,
    amount1Min: 0,
    recipient: TREASURY,
    deadline: deadline,
  }]);

  console.log("Calldata:", calldata.substring(0, 100) + "...");

  // Send raw transaction
  const tx = await deployer.sendTransaction({
    to: POSITION_MANAGER,
    data: calldata,
    gasLimit: 500000,
  });

  console.log("Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Status:", receipt.status);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Logs:", receipt.logs.length);
  for (const log of receipt.logs) {
    console.log("  Log:", log.address, log.topics[0]);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
