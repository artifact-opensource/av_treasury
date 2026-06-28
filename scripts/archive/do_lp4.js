const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  // Check pool state more carefully
  // Get slot0 data
  const slot0Data = await ethers.provider.call({ to: POOL, data: "0x3850c7bd" });
  // Parse: sqrtPriceX96 (uint160), tick (int24), observationIndex (uint16), observationCardinality (uint16), observationCardinalityNext (uint16), feeProtocol (uint8), unlocked (bool)
  const sqrtPriceX96 = ethers.BigNumber.from("0x" + slot0Data.slice(2, 66));
  // tick is 24-bit signed int at bytes 20-23
  const tickRaw = "0x" + slot0Data.slice(58, 66) + slot0Data.slice(50, 58).slice(0, 4);
  // Actually let me just parse it properly
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ["uint160", "int24", "uint16", "uint16", "uint16", "uint8", "bool"],
    slot0Data
  );
  console.log("Pool slot0:");
  console.log("  sqrtPriceX96:", decoded[0].toString());
  console.log("  tick:", decoded[1].toString());
  console.log("  observationIndex:", decoded[2].toString());
  console.log("  observationCardinality:", decoded[3].toString());
  console.log("  unlocked:", decoded[6]);

  // The pool IS initialized (sqrtPriceX96 > 0)
  // Current tick should be near -46050 for price 0.01
  
  // Let me try minting with a narrow range around current tick
  // Current tick ≈ -46050, aligned to tickSpacing=100: -46000
  // Range: -46100 to -45900 (very narrow, ±1 tick)
  // Actually for one-sided, we want the full range or at least a wide range
  
  // Let me try with recipient = deployer (not Treasury)
  const pmInterface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 300;

  // Try different parameter combinations
  const attempts = [
    { label: "Full range, recipient=deployer", params: [AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, deployer.address, deadline] },
    { label: "Full range, recipient=Treasury", params: [AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e", deadline] },
    { label: "Narrow range around price", params: [AU, WETH, 100, -46100, -45900, amount, 0, 0, 0, deployer.address, deadline] },
    { label: "Below current price (one-sided Au)", params: [AU, WETH, 100, -887200, -46000, amount, 0, 0, 0, deployer.address, deadline] },
    { label: "Above current price (one-sided ETH)", params: [AU, WETH, 100, -46000, 887200, amount, 0, 0, 0, deployer.address, deadline] },
  ];

  for (const attempt of attempts) {
    const calldata = pmInterface.encodeFunctionData("mint", [attempt.params]);
    try {
      await ethers.provider.call({
        to: POSITION_MANAGER,
        from: deployer.address,
        data: calldata,
      });
      console.log(`\n✅ ${attempt.label}: SUCCESS (static)`);
      
      // If static call succeeds, send the real tx
      console.log("   Sending transaction...");
      const tx = await deployer.sendTransaction({
        to: POSITION_MANAGER,
        data: calldata,
        gasLimit: 500000,
      });
      const receipt = await tx.wait();
      console.log("   Status:", receipt.status ? "✅ MINED" : "❌ REVERTED");
      console.log("   Gas:", receipt.gasUsed.toString());
      console.log("   Logs:", receipt.logs.length);
      
      if (receipt.status) {
        // Check remaining balance and return to Treasury
        const au = new ethers.Contract(AU, ["function balanceOf(address) view returns (uint256)"], ethers.provider);
        const remaining = await au.balanceOf(deployer.address);
        if (remaining.gt(0)) {
          console.log("   Returning", ethers.utils.formatUnits(remaining, 18), "Au to Treasury...");
          const auFull = new ethers.Contract(AU, ["function transfer(address, uint256) returns (bool)"], deployer);
          await (await auFull.transfer("0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e", remaining)).wait();
        }
        console.log("\n🎉 LP added successfully!");
        return;
      }
    } catch(e) {
      console.log(`❌ ${attempt.label}: ${e.message.substring(0, 100)}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
