const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  const au = new ethers.Contract(AU, [
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
  ], deployer);

  // Ensure approval
  await (await au.approve(PM, ethers.constants.MaxUint256)).wait();
  console.log("Approved. Balance:", ethers.utils.formatUnits(await au.balanceOf(deployer.address), 18));

  // Try ALL possible mint signatures
  const sigs = [
    { sel: "0xb5007d1f", abi: "mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96)) returns (uint256,uint128)" },
    { sel: "0x6d70c415", abi: "mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256,uint128)" },
    { sel: "0x9e32ec9d", abi: "mint(address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) returns (uint256,uint128)" },
  ];

  const deadline = Math.floor(Date.now() / 1000) + 600;
  const sqrtPriceX96 = ethers.BigNumber.from("7922816251426433759354395033");

  for (const {sel, abi} of sigs) {
    const iface = new ethers.utils.Interface(["function " + abi + " external"]);

    let params;
    if (sel === "0xb5007d1f") {
      params = [[AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, TREASURY, deadline, sqrtPriceX96]];
    } else if (sel === "0x6d70c415") {
      params = [[AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, TREASURY, deadline]];
    } else {
      params = [AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, TREASURY, deadline];
    }

    const calldata = iface.encodeFunctionData("mint", params);
    console.log(`\nTrying ${sel}...`);

    try {
      await ethers.provider.call({ to: PM, from: deployer.address, data: calldata });
      console.log("  ✅ Static call succeeded!");

      // Send it
      const tx = await deployer.sendTransaction({ to: PM, data: calldata, gasLimit: 500000 });
      const receipt = await tx.wait();
      console.log("  Tx:", receipt.status ? "✅ MINED" : "❌ REVERT", "Gas:", receipt.gasUsed.toString());

      if (receipt.status) {
        // Return remaining
        const remaining = await au.balanceOf(deployer.address);
        if (remaining.gt(0)) {
          await (await au.transfer(TREASURY, remaining)).wait();
          console.log("  Returned", ethers.utils.formatUnits(remaining, 18), "Au");
        }
        console.log("\n🎉 DONE!");
        return;
      }
    } catch(e) {
      console.log("  ❌", e.message.substring(0, 120));
    }
  }

  console.log("\nAll mint variants failed.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
