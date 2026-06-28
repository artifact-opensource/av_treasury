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
  const sqrtPriceX96 = "7922816251426433759354395033";

  // Manually encode: mint((address,address,int24,int24,int24,uint256,uint256,uint256,uint256,address,uint256,uint160))
  // Selector: 0xb5007d1f
  const selector = "0xb5007d1f";

  // Encode as a tuple (struct) - this is a dynamic type
  // When it's the only arg, encoding is: offset (32 bytes) + length-prefixed data
  // Actually for tuples, defaultAbiCoder.encode with ["tuple(...)"] handles it
  const tupleTypes = [{
    type: "tuple",
    components: [
      { type: "address" },  // token0
      { type: "address" },  // token1
      { type: "int24" },    // tickSpacing
      { type: "int24" },    // tickLower
      { type: "int24" },    // tickUpper
      { type: "uint256" },  // amount0Desired
      { type: "uint256" },  // amount1Desired
      { type: "uint256" },  // amount0Min
      { type: "uint256" },  // amount1Min
      { type: "address" },  // recipient
      { type: "uint256" },  // deadline
      { type: "uint160" },  // sqrtPriceX96
    ]
  }];

  const encoded = ethers.utils.defaultAbiCoder.encode(tupleTypes, [[
    AU, WETH, 100, -887200, 887200,
    amount, 0, 0, 0,
    TREASURY, deadline, sqrtPriceX96,
  ]]);

  const calldata = selector + encoded.slice(2);
  console.log("Calldata length:", calldata.length);
  console.log("Selector:", calldata.substring(0, 10));

  // Static call
  console.log("Static call...");
  try {
    const result = await ethers.provider.call({ to: PM, from: deployer.address, data: calldata });
    console.log("✅ Static OK. Result:", result.substring(0, 100));
  } catch(e) {
    console.log("❌ Static:", e.message.substring(0, 200));

    // Try without sqrtPriceX96 (11 params)
    console.log("\nTrying 11-param version (selector 0x6d70c415)...");
    const sel11 = "0x6d70c415";
    const enc11 = ethers.utils.defaultAbiCoder.encode([{
      type: "tuple",
      components: [
        { type: "address" }, { type: "address" }, { type: "int24" },
        { type: "int24" }, { type: "int24" }, { type: "uint256" },
        { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
        { type: "address" }, { type: "uint256" },
      ]
    }], [[
      AU, WETH, 100, -887200, 887200,
      amount, 0, 0, 0,
      TREASURY, deadline,
    ]]);
    const cd11 = sel11 + enc11.slice(2);
    try {
      await ethers.provider.call({ to: PM, from: deployer.address, data: cd11 });
      console.log("✅ 11-param static OK");
    } catch(e2) {
      console.log("❌ 11-param:", e2.message.substring(0, 200));

      // Try with small amount
      console.log("\nTrying small amount (1 Au)...");
      const smallAmt = ethers.utils.parseUnits("1", 18);
      const encSmall = ethers.utils.defaultAbiCoder.encode(tupleTypes, [[
        AU, WETH, 100, -887200, 887200,
        smallAmt, 0, 0, 0,
        TREASURY, deadline, sqrtPriceX96,
      ]]);
      const cdSmall = selector + encSmall.slice(2);
      try {
        await ethers.provider.call({ to: PM, from: deployer.address, data: cdSmall });
        console.log("✅ Small amount static OK");
      } catch(e3) {
        console.log("❌ Small:", e3.message.substring(0, 200));
      }
    }
    return;
  }

  // Send the real tx
  console.log("Sending...");
  const tx = await deployer.sendTransaction({ to: PM, data: calldata, gasLimit: 500000 });
  const receipt = await tx.wait();
  console.log("Status:", receipt.status ? "✅ SUCCESS" : "❌ REVERT", "Gas:", receipt.gasUsed.toString());
  console.log("Logs:", receipt.logs.length);

  if (receipt.status) {
    const remaining = await au.balanceOf(deployer.address);
    if (remaining.gt(0)) {
      await (await au.transfer(TREASURY, remaining)).wait();
      console.log("Returned", ethers.utils.formatUnits(remaining, 18), "Au");
    }
    console.log("\n🎉 DONE!");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
