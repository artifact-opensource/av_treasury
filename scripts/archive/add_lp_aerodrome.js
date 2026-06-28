/**
 * Add one-sided LP to Aerodrome Slipstream (Au/ETH) via Gnosis Safe
 * 
 * The Position Manager uses Uniswap V3-style mint with MintParams struct.
 * Function selector: 0xb5007d1f = mint((address,address,int24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))
 */

const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const AU_TOKEN = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";

  const AU_AMOUNT = ethers.utils.parseUnits("100000", 18); // 100K Au
  const PRICE_LOWER = 0.0085;
  const PRICE_UPPER = 0.0115;
  const TICK_SPACING = 100;

  console.log("=".repeat(60));
  console.log("  AERODROME SLIPSTREAM LP — Au/ETH");
  console.log("=".repeat(60));
  console.log(`  Deployer:  ${deployerAddress}`);
  console.log(`  Treasury:  ${TREASURY}`);
  console.log(`  Amount:    100,000 Au (one-sided)`);
  console.log(`  Range:     ${PRICE_LOWER} - ${PRICE_UPPER} ETH/Au`);
  console.log("=".repeat(60));

  // Token ordering
  const [token0, token1] = AU_TOKEN.toLowerCase() < WETH.toLowerCase()
    ? [AU_TOKEN, WETH] : [WETH, AU_TOKEN];
  const isAuToken0 = token0 === AU_TOKEN;
  console.log(`\n  token0: ${isAuToken0 ? "Au" : "WETH"} (${token0})`);
  console.log(`  token1: ${isAuToken0 ? "WETH" : "Au"} (${token1})`);

  // Calculate ticks
  let tickLower, tickUpper;
  if (isAuToken0) {
    tickLower = Math.floor(Math.log(PRICE_LOWER) / Math.log(1.0001));
    tickUpper = Math.ceil(Math.log(PRICE_UPPER) / Math.log(1.0001));
  } else {
    tickLower = Math.floor(Math.log(1 / PRICE_UPPER) / Math.log(1.0001));
    tickUpper = Math.ceil(Math.log(1 / PRICE_LOWER) / Math.log(1.0001));
  }
  tickLower = Math.floor(tickLower / TICK_SPACING) * TICK_SPACING;
  tickUpper = Math.ceil(tickUpper / TICK_SPACING) * TICK_SPACING;
  console.log(`  Tick lower: ${tickLower}`);
  console.log(`  Tick upper: ${tickUpper}`);

  // Check if pool exists
  const factory = new ethers.Contract(SLIPSTREAM_FACTORY, [
    "function getPool(address, address, int24) view returns (address)",
  ], ethers.provider);

  let poolAddress;
  try { poolAddress = await factory.getPool(token0, token1, TICK_SPACING); } catch(e) {}
  const poolExists = poolAddress && poolAddress !== ethers.constants.AddressZero;
  console.log(`  Pool exists: ${poolExists} ${poolExists ? poolAddress : ""}`);

  // Build contract interfaces using the REAL function selector
  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function mint(tuple(address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    "function createPool(address token0, address token1, int24 tickSpacing, uint160 sqrtPriceX96) payable returns (address pool)",
  ], deployer);

  const auToken = new ethers.Contract(AU_TOKEN, [
    "function approve(address, uint256) returns (bool)",
  ], deployer);

  // Calculate sqrtPriceX96 for pool creation
  const priceMid = (PRICE_LOWER + PRICE_UPPER) / 2; // 0.01
  const sqrtPriceMid = Math.sqrt(priceMid); // 0.1
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceMidScaled = ethers.BigNumber.from(Math.floor(sqrtPriceMid * 1e15)).mul(1000);
  const sqrtPriceX96 = Q96.mul(sqrtPriceMidScaled).div(ethers.BigNumber.from(10).pow(18));
  console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);

  // Build calldatas
  const approveCalldata = auToken.interface.encodeFunctionData("approve", [POSITION_MANAGER, AU_AMOUNT]);

  const createPoolCalldata = pm.interface.encodeFunctionData("createPool", [
    token0, token1, TICK_SPACING, sqrtPriceX96
  ]);

  // For one-sided: Au only, 0 WETH
  const amount0Desired = isAuToken0 ? AU_AMOUNT : 0;
  const amount1Desired = isAuToken0 ? 0 : AU_AMOUNT;

  // Deadline: max uint256 (like the real user tx)
  const MAX_UINT256 = ethers.constants.MaxUint256;

  const mintParams = {
    token0, token1,
    tickSpacing: TICK_SPACING,
    tickLower, tickUpper,
    amount0Desired, amount1Desired,
    amount0Min: 0, amount1Min: 0,
    recipient: TREASURY,
    deadline: MAX_UINT256,
  };

  const mintCalldata = pm.interface.encodeFunctionData("mint", [mintParams]);

  // Verify the function selectors
  console.log(`\n  Approve selector: ${approveCalldata.slice(0, 10)}`);
  console.log(`  CreatePool selector: ${createPoolCalldata.slice(0, 10)}`);
  console.log(`  Mint selector: ${mintCalldata.slice(0, 10)}`);

  // Safe execution helper
  const safe = new ethers.Contract(TREASURY, [
    "function nonce() view returns (uint256)",
    "function getTransactionHash(address, uint256, bytes, uint8, uint256, uint256, uint256, address, address, uint256) view returns (bytes32)",
    "function execTransaction(address, uint256, bytes, uint8, uint256, uint256, uint256, address, address, bytes) payable returns (bool)",
    "function approveHash(bytes32) external",
  ], deployer);

  async function executeSafeTx(to, value, data, gasLimit = 500000) {
    const currentNonce = await safe.nonce();
    const txHash = await safe.getTransactionHash(
      to, value, data, 0, 0, 0, 0, ethers.constants.AddressZero, ethers.constants.AddressZero, currentNonce
    );
    
    const approveTx = await safe.approveHash(txHash);
    await approveTx.wait();
    
    const sigR = ethers.utils.hexZeroPad(deployerAddress, 32);
    const sigS = ethers.utils.hexZeroPad("0x00", 32);
    const signature = sigR + sigS.slice(2) + "01";
    
    const execTx = await safe.execTransaction(
      to, value, data, 0, 0, 0, 0, ethers.constants.AddressZero, ethers.constants.AddressZero, signature,
      { gasLimit }
    );
    const receipt = await execTx.wait();
    console.log(`  ✅ Executed: ${execTx.hash} (status: ${receipt.status})`);
    return execTx.hash;
  }

  // Execute
  console.log("\n" + "=".repeat(60));
  console.log("  EXECUTING VIA TREASURY SAFE");
  console.log("=".repeat(60));

  // Step 1: Approve
  console.log("\n  📦 Step 1: Approve AuToken for Position Manager...");
  await executeSafeTx(AU_TOKEN, 0, approveCalldata);

  // Step 2: Create pool if needed
  if (!poolExists) {
    console.log("\n  📦 Step 2: Create and initialize Au/ETH pool...");
    await executeSafeTx(POSITION_MANAGER, 0, createPoolCalldata, 2000000);
    
    poolAddress = await factory.getPool(token0, token1, TICK_SPACING);
    console.log(`  Pool created at: ${poolAddress}`);
  }

  // Step 3: Mint position
  console.log("\n  📦 Step 3: Mint LP position (100K Au, one-sided)...");
  await executeSafeTx(POSITION_MANAGER, 0, mintCalldata, 2000000);

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ LP POSITION CREATED");
  console.log("=".repeat(60));
  console.log(`  Pool:     ${poolAddress}`);
  console.log(`  Range:    ${PRICE_LOWER} - ${PRICE_UPPER} ETH/Au`);
  console.log(`  Ticks:    ${tickLower} to ${tickUpper}`);
  console.log(`  Amount:   100,000 Au (one-sided)`);
  console.log(`  Owner:    ${TREASURY}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ FAILED:", error.message);
    process.exit(1);
  });
