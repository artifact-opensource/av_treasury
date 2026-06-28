const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0x85509218F94e185E1522c9D8bB96BecDCD918fb4";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
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
  sigBytes[64] = sigBytes[64] + 4; // Safe convention
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
  const safe = new ethers.Contract(SAFE, safeAbi, signer);
  const oracle = await ethers.getContractAt("AvOracle", ORACLE);

  // Remove old pool config and set new one
  // configureTwapPool(AU, realPool, AU, USDC, 600, true)
  // token0IsTarget = true means token0 (AU) is the target token
  console.log("1. Reconfiguring TWAP pool to real AU/USDC pool...");
  const configCalldata = oracle.interface.encodeFunctionData("configureTwapPool", [
    AU, REAL_POOL, AU, USDC, 600, true
  ]);
  const r1 = await execViaSafe(signer, safe, ORACLE, configCalldata);
  console.log("   Status:", r1.status === 1 ? "SUCCESS" : "FAILED");
  if (r1.status !== 1) return;

  console.log("2. Initializing TWAP...");
  const initCalldata = oracle.interface.encodeFunctionData("initializeTwap", [AU]);
  const r2 = await execViaSafe(signer, safe, ORACLE, initCalldata);
  console.log("   Status:", r2.status === 1 ? "SUCCESS" : "FAILED");
  if (r2.status !== 1) return;

  console.log("3. Calling updatePrice(AU)...");
  const tx3 = await oracle.connect(signer).updatePrice(AU);
  const r3 = await tx3.wait();
  console.log("   Status:", r3.status === 1 ? "SUCCESS" : "FAILED");

  console.log("4. Verifying...");
  try {
    const [price, source] = await oracle.getPrice(AU);
    console.log("   getPrice(AU):", price.toString(), "source:", source.toString());
  } catch(e) {
    console.log("   getPrice failed:", e.message.slice(0, 80));
  }
  
  try {
    const twap = await oracle.getTwapPrice(AU);
    console.log("   getTwapPrice(AU):", twap.toString());
  } catch(e) {
    console.log("   getTwapPrice failed:", e.message.slice(0, 80));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
