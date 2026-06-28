const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  // Step 1: Approve
  console.log("1. Approving PM...");
  const au = new ethers.Contract(AU, ["function approve(address, uint256) returns (bool)"], deployer);
  await (await au.approve(POSITION_MANAGER, amount)).wait();
  console.log("   Done.");

  // Step 2: Static call mint to find the right params
  console.log("2. Testing mint with static call...");
  const pmInterface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 300;

  // Use array instead of object for tuple encoding
  const params = [
    AU, WETH, 100, -887200, 887200,
    amount, 0, 0, 0,
    TREASURY, deadline,
  ];

  const calldata = pmInterface.encodeFunctionData("mint", [params]);
  console.log("   Selector:", calldata.substring(0, 10));

  // Static call
  try {
    await ethers.provider.call({
      to: POSITION_MANAGER,
      from: deployer.address,
      data: calldata,
    });
    console.log("   Static call succeeded!");
  } catch(e) {
    console.log("   Static call reverted:", e.message.substring(0, 200));
    if (e.error && e.error.data) {
      console.log("   Revert data:", e.error.data);
      // Try to decode revert reason
      const reason = e.error.data;
      if (reason.startsWith("0x08c379a0")) {
        const decoded = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + reason.slice(10));
        console.log("   Revert reason:", decoded[0]);
      }
    }
    return;
  }

  // Step 3: Send the actual mint transaction
  console.log("3. Sending mint transaction...");
  const tx = await deployer.sendTransaction({
    to: POSITION_MANAGER,
    data: calldata,
    gasLimit: 500000,
  });
  console.log("   Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("   Status:", receipt.status ? "✅ SUCCESS" : "❌ FAILED");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log("   Logs:", receipt.logs.length);

  // Step 4: Return remaining Au to Treasury
  const remaining = await au.balanceOf(deployer.address);
  if (remaining.gt(0)) {
    console.log("4. Returning", ethers.utils.formatUnits(remaining, 18), "Au to Treasury...");
    await (await au.connect(deployer).transfer(TREASURY, remaining)).wait();
    console.log("   Done.");
  }

  console.log("\n✅ All done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
