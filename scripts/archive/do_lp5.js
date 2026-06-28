const { ethers } = require("hardhat");

async function main() {
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("100000", 18);

  // Check pool tick
  const slot0Data = await ethers.provider.call({ to: "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665", data: "0x3850c7bd" });
  const sqrtPriceX96 = ethers.BigNumber.from("0x" + slot0Data.slice(2, 66));
  // tick is at offset 20 (2+40 chars), 3 bytes (6 hex chars)
  const tickHex = "0x" + slot0Data.slice(58, 66) + slot0Data.slice(50, 58).substring(0, 4);
  // Actually, just decode manually
  // ABI encoding: uint160 (32 bytes), int24 (32 bytes), ...
  // sqrtPriceX96: bytes 0-31 (chars 2-65)
  // tick: bytes 32-63 (chars 66-129)
  const tickPacked = "0x" + slot0Data.substring(66, 130);
  const tickSigned = ethers.BigNumber.from(tickPacked).fromTwos(24);
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("tick:", tickSigned.toString());

  // Now try minting with different params
  const pmInterface = new ethers.utils.Interface([
    "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity)",
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const currentTick = tickSigned.toNumber();
  const tickLower = Math.floor(currentTick / 100) * 100 - 100; // one tick below
  const tickUpper = tickLower + 200; // two ticks wide

  console.log("\nTrying with narrow range around current price:");
  console.log("  tickLower:", tickLower, "tickUpper:", tickUpper);

  // Try narrow range first
  const params = [AU, WETH, 100, tickLower, tickUpper, amount, 0, 0, 0, deployer.address, deadline];
  const calldata = pmInterface.encodeFunctionData("mint", [params]);

  try {
    await ethers.provider.call({ to: POSITION_MANAGER, from: deployer.address, data: calldata });
    console.log("  Static call: ✅");
  } catch(e) {
    console.log("  Static call: ❌", e.message.substring(0, 120));
    
    // Try full range
    console.log("\nTrying full range...");
    const params2 = [AU, WETH, 100, -887200, 887200, amount, 0, 0, 0, deployer.address, deadline];
    const calldata2 = pmInterface.encodeFunctionData("mint", [params2]);
    try {
      await ethers.provider.call({ to: POSITION_MANAGER, from: deployer.address, data: calldata2 });
      console.log("  Static call: ✅");
    } catch(e2) {
      console.log("  Static call: ❌", e2.message.substring(0, 120));
      
      // Try with small amount
      console.log("\nTrying small amount (1 Au)...");
      const smallAmount = ethers.utils.parseUnits("1", 18);
      const params3 = [AU, WETH, 100, -887200, 887200, smallAmount, 0, 0, 0, deployer.address, deadline];
      const calldata3 = pmInterface.encodeFunctionData("mint", [params3]);
      try {
        await ethers.provider.call({ to: POSITION_MANAGER, from: deployer.address, data: calldata3 });
        console.log("  Static call: ✅");
      } catch(e3) {
        console.log("  Static call: ❌", e3.message.substring(0, 120));
        
        // Maybe the issue is that we need to use multicall (wrap ETH, etc.)
        // Or maybe the PositionManager needs the tokens transferred to it first
        // Let me check the PM's AU balance requirement
        
        // Check if there's a multicall version
        console.log("\nTrying multicall approach...");
        const pmMulti = new ethers.utils.Interface([
          "function multicall(bytes[]) returns (bytes[])",
        ]);
        
        // Encode: approve + mint
        // Actually, the PM should pull tokens from msg.sender
        // The issue might be that the PM can't pull because the tokens aren't approved properly
        
        // Let me check the approval
        const au = new ethers.Contract(AU, [
          "function allowance(address, address) view returns (uint256)",
        ], ethers.provider);
        const allowance = await au.allowance(deployer.address, POSITION_MANAGER);
        console.log("  Deployer->PM allowance:", ethers.utils.formatUnits(allowance, 18));
        
        // Check if there's a transferFrom in the PM flow
        // The PM should use transferFrom to pull tokens from msg.sender
        // If allowance is 0, that's the issue
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
