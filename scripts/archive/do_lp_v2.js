const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PM = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  const au = new ethers.Contract(AU, [
    "function approve(address, uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
  ], deployer);

  await (await au.approve(PM, ethers.constants.MaxUint256)).wait();
  console.log("Approved. Balance:", ethers.utils.formatUnits(await au.balanceOf(deployer.address), 18));

  const deadline = Math.floor(Date.now() / 1000) + 600;
  const sqrtPriceX96 = ethers.BigNumber.from("7922816251426433759354395033");

  // Define ABIs properly
  const abi12 = [
    {
      name: "mint", type: "function", stateMutability: "nonpayable",
      inputs: [{
        name: "params", type: "tuple",
        components: [
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "tickSpacing", type: "int24" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "sqrtPriceX96", type: "uint160" },
        ]
      }],
      outputs: [
        { name: "tokenId", type: "uint256" },
        { name: "liquidity", type: "uint128" },
      ]
    }
  ];

  const abi11 = [
    {
      name: "mint", type: "function", stateMutability: "nonpayable",
      inputs: [{
        name: "params", type: "tuple",
        components: [
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "tickSpacing", type: "int24" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ]
      }],
      outputs: [
        { name: "tokenId", type: "uint256" },
        { name: "liquidity", type: "uint128" },
      ]
    }
  ];

  const abiFlat = [
    {
      name: "mint", type: "function", stateMutability: "nonpayable",
      inputs: [
        { name: "token0", type: "address" },
        { name: "token1", type: "address" },
        { name: "tickSpacing", type: "int24" },
        { name: "tickLower", type: "int24" },
        { name: "tickUpper", type: "int24" },
        { name: "amount0Desired", type: "uint256" },
        { name: "amount1Desired", type: "uint256" },
        { name: "amount0Min", type: "uint256" },
        { name: "amount1Min", type: "uint256" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
      outputs: [
        { name: "tokenId", type: "uint256" },
        { name: "liquidity", type: "uint128" },
      ]
    }
  ];

  const sqrtStr = "7922816251426433759354395033";
  const amtStr = amount.toString();

  const variants = [
    { label: "12-param tuple (with sqrtPriceX96)", abi: abi12, params: [[
      AU, WETH, 100, -887200, 887200,
      amtStr, 0, 0, 0,
      TREASURY, deadline, sqrtStr,
    ]]},
    { label: "11-param tuple", abi: abi11, params: [[
      AU, WETH, 100, -887200, 887200,
      amtStr, 0, 0, 0,
      TREASURY, deadline,
    ]]},
    { label: "flat params", abi: abiFlat, params: [AU, WETH, 100, -887200, 887200, amtStr, 0, 0, 0, TREASURY, deadline] },
  ];

  for (const v of variants) {
    const iface = new ethers.utils.Interface(v.abi);
    const calldata = iface.encodeFunctionData("mint", [v.params]);
    const sel = calldata.substring(0, 10);
    console.log(`\n${v.label} (${sel})...`);

    try {
      await ethers.provider.call({ to: PM, from: deployer.address, data: calldata });
      console.log("  ✅ Static OK");

      const tx = await deployer.sendTransaction({ to: PM, data: calldata, gasLimit: 500000 });
      const receipt = await tx.wait();
      console.log("  Tx:", receipt.status ? "✅ MINED" : "❌ REVERT", "Gas:", receipt.gasUsed.toString());

      if (receipt.status) {
        const remaining = await au.balanceOf(deployer.address);
        if (remaining.gt(0)) {
          await (await au.transfer(TREASURY, remaining)).wait();
          console.log("  Returned", ethers.utils.formatUnits(remaining, 18), "Au");
        }
        console.log("\n🎉 DONE!");
        return;
      }
    } catch(e) {
      console.log("  ❌", e.message.substring(0, 150));
    }
  }
  console.log("\nAll variants failed.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
