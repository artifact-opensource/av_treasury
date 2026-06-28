const { ethers } = require("hardhat");

const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const REAL_POOL = "0x5E1aA37C424A5cBa4b86AFf533cf369aeF0Def70";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const safeAbi = [
  "function nonce() view returns (uint256)",
  "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
];

async function signSafeTx(signer, safe, to, value, data, operation, nonce) {
  const txHash = await safe.getTransactionHash(
    to, value, data, operation, 0, 0, 0, ethers.constants.AddressZero, ethers.constants.AddressZero, nonce
  );
  const sig = await signer.signMessage(ethers.utils.arrayify(txHash));
  const sigBytes = ethers.utils.arrayify(sig);
  sigBytes[64] = sigBytes[64] + 4;
  return ethers.utils.hexlify(sigBytes);
}

async function execViaSafe(signer, safe, target, calldata) {
  const nonce = (await safe.nonce()).toString();
  const sig = await signSafeTx(signer, safe, target, 0, calldata, 0, nonce);
  const tx = await safe.execTransaction(
    target, 0, calldata, 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, sig
  );
  return await tx.wait();
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployerAddr = await signer.getAddress();
  const bal = await ethers.provider.getBalance(deployerAddr);
  console.log("Deployer:", deployerAddr);
  console.log("Balance:", ethers.utils.formatEther(bal), "ETH");

  if (bal.lt(ethers.utils.parseEther("0.0005"))) {
    console.log("ERROR: Need at least 0.0005 ETH");
    process.exit(1);
  }

  // 1. Deploy
  console.log("\n1. Deploying AvOracle v5...");
  const factory = await ethers.getContractFactory("AvOracle");
  const oracle = await factory.connect(signer).deploy(AU, AG, SAFE, SAFE);
  await oracle.deployed();
  console.log("   Oracle:", oracle.address);

  const safe = new ethers.Contract(SAFE, safeAbi, signer);

  // 2. Configure TWAP pool (AU is token0 in pool, so token0IsTarget = true)
  console.log("2. configureTwapPool(AU, realPool, AU, USDC, 600, true)...");
  const configCalldata = oracle.interface.encodeFunctionData("configureTwapPool", [
    AU, REAL_POOL, AU, USDC, 600, true
  ]);
  const r2 = await execViaSafe(signer, safe, oracle.address, configCalldata);
  console.log("   Status:", r2.status === 1 ? "SUCCESS" : "FAILED");
  if (r2.status !== 1) return;

  // 3. Initialize TWAP
  console.log("3. initializeTwap(AU)...");
  const initCalldata = oracle.interface.encodeFunctionData("initializeTwap", [AU]);
  const r3 = await execViaSafe(signer, safe, oracle.address, initCalldata);
  console.log("   Status:", r3.status === 1 ? "SUCCESS" : "FAILED");
  if (r3.status !== 1) return;

  // 4. updatePrice
  console.log("4. updatePrice(AU)...");
  const tx4 = await oracle.connect(signer).updatePrice(AU);
  const r4 = await tx4.wait();
  console.log("   Status:", r4.status === 1 ? "SUCCESS" : "FAILED");

  // 5. Verify
  console.log("5. Verifying...");
  try {
    const [price, source] = await oracle.getPrice(AU);
    console.log("   getPrice(AU):", price.toString(), "source:", source.toString());
    // Price should be ~8500 (0.0085 USDC * 1e6 for 6-decimal USDC, but in 18-decimal it's 8.5e15)
    // Actually: raw tick price = token1/token0 * 1e18 = USDC/AU * 1e18
    // With tick=-323985: 1.0001^tick = 8.5e-15, * 1e18 = 8500
    // So price should be ~8500 (representing 0.0085 USDC per AU in 18-decimal fixed point)
    console.log("   Expected: ~8500 (0.0085 USDC/AU in 18-decimal)");
  } catch(e) {
    console.log("   getPrice failed:", e.message.slice(0, 80));
  }

  try {
    const twap = await oracle.getTwapPrice(AU);
    console.log("   getTwapPrice(AU):", twap.toString());
  } catch(e) {
    console.log("   getTwapPrice failed:", e.message.slice(0, 80));
  }

  console.log("\n=== COMPLETE ===");
  console.log("Oracle:", oracle.address);
  console.log("Verify: npx hardhat verify --network base", oracle.address, AU, AG, SAFE, SAFE);
}

main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
