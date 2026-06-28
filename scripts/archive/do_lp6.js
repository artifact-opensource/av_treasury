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

  // Check current state
  const bal = await au.balanceOf(deployer.address);
  const allowance = await au.allowance(deployer.address, POSITION_MANAGER);
  console.log("Deployer Au:", ethers.utils.formatUnits(bal, 18));
  console.log("Allowance PM:", ethers.utils.formatUnits(allowance, 18));

  // Approve if needed
  if (allowance.lt(amount)) {
    console.log("Approving...");
    await (await au.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
    console.log("Done.");
  }

  // Check pool tick
  const slot0Data = await ethers.provider.call({ to: POOL, data: "0x3850c7bd" });
  const sqrtPriceX96 = ethers.BigNumber.from("0x" + slot0Data.slice(2, 66));
  const tickPacked = "0x" + slot0Data.substring(66, 130);
  const tick = ethers.BigNumber.from(tickPacked).fromTwos(24);
  console.log("Pool tick:", tick.toString(), "sqrtPriceX96:", sqrtPriceX96.toString());

  // Build mint calldata
  const pmIface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 600;

  // Try: full range, small amount first
  console.log("\n--- Test 1: Small amount (1 Au), full range ---");
  let p = [AU, WETH, 100, -887200, 887200, ethers.utils.parseUnits("1", 18), 0, 0, 0, deployer.address, deadline];
  let cd = pmIface.encodeFunctionData("mint", [p]);
  try {
    await ethers.provider.call({ to: POSITION_MANAGER, from: deployer.address, data: cd });
    console.log("Static: ✅");
  } catch(e) {
    console.log("Static: ❌", e.message.substring(0, 150));
  }

  // Try: multicall with selfPermit
  console.log("\n--- Test 2: Using multicall ---");
  const pmMultiIface = new ethers.utils.Interface([
    "function multicall(bytes[]) returns (bytes[])",
    "function selfPermit(address token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  ]);

  // Maybe the PM needs a multicall to pull tokens?
  // Let me try: mint via multicall wrapping
  // Actually, let me try calling the PM's mint directly (not via interface)
  const pmContract = new ethers.Contract(POSITION_MANAGER, [
    "function mint(address, address, int24, int24, int24, uint256, uint256, uint256, uint256, address, uint256) external returns (uint256, uint128)",
  ], deployer);

  console.log("\n--- Test 3: Flat params (not tuple) ---");
  try {
    const tx = await pmContract.mint(AU, WETH, 100, -887200, 887200, ethers.utils.parseUnits("1", 18), 0, 0, 0, deployer.address, deadline, { gasLimit: 500000 });
    const receipt = await tx.wait();
    console.log("Tx:", receipt.status ? "✅ SUCCESS" : "❌ REVERT", "Gas:", receipt.gasUsed.toString());
    if (receipt.logs.length > 0) {
      console.log("Logs:", receipt.logs.length);
      for (const log of receipt.logs) {
        console.log("  ", log.address, log.topics[0]);
      }
    }
  } catch(e) {
    console.log("Tx: ❌", e.message.substring(0, 200));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
