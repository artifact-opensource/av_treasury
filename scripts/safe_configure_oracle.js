const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0x85509218F94e185E1522c9D8bB96BecDCD918fb4";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AU_POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const WETH = "0x4200000000000000000000000000000000000006";

const safeAbi = [
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
];

async function signSafeTx(signer, safe, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce) {
  const txHash = await safe.getTransactionHash(
    to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce
  );
  const sig = await signer.signMessage(ethers.utils.arrayify(txHash));
  // Safe convention: v += 4 for EOA signatures
  const sigBytes = ethers.utils.arrayify(sig);
  sigBytes[64] = sigBytes[64] + 4;
  return ethers.utils.hexlify(sigBytes);
}

async function execViaSafe(signer, safe, target, calldata) {
  const nonce = (await safe.nonce()).toString();
  const sig = await signSafeTx(
    signer, safe, target, 0, calldata, 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, nonce
  );
  const tx = await safe.execTransaction(
    target, 0, calldata, 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, sig
  );
  return await tx.wait();
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployerAddr = await signer.getAddress();
  console.log("Signer:", deployerAddr);

  const safe = new ethers.Contract(SAFE, safeAbi, signer);
  const oracle = await ethers.getContractAt("AvOracle", ORACLE);

  const threshold = await safe.getThreshold();
  console.log("Safe threshold:", threshold.toString());

  // Call 1: configureTwapPool
  console.log("\n1. configureTwapPool(AU, pool, AU, WETH, 600, true)...");
  const configCalldata = oracle.interface.encodeFunctionData("configureTwapPool", [
    AU, AU_POOL, AU, WETH, 600, true
  ]);
  const r1 = await execViaSafe(signer, safe, ORACLE, configCalldata);
  console.log("   Status:", r1.status === 1 ? "SUCCESS ✅" : "FAILED ❌");
  if (r1.status !== 1) {
    console.log("   Gas used:", r1.gasUsed?.toString());
    return;
  }

  // Call 2: initializeTwap
  console.log("\n2. initializeTwap(AU)...");
  const initCalldata = oracle.interface.encodeFunctionData("initializeTwap", [AU]);
  const r2 = await execViaSafe(signer, safe, ORACLE, initCalldata);
  console.log("   Status:", r2.status === 1 ? "SUCCESS ✅" : "FAILED ❌");
  if (r2.status !== 1) return;

  // Call 3: updatePrice(AU) - anyone can call
  console.log("\n3. updatePrice(AU)...");
  const tx3 = await oracle.connect(signer).updatePrice(AU);
  const r3 = await tx3.wait();
  console.log("   Status:", r3.status === 1 ? "SUCCESS ✅" : "FAILED ❌");

  // Verify
  console.log("\n4. Verifying getPrice(AU)...");
  try {
    const [price, dec] = await oracle.getPrice(AU);
    console.log("   getPrice(AU):", ethers.utils.formatUnits(price, dec));
    console.log("   Decimals:", dec.toString());
  } catch(e) {
    console.log("   getPrice(AU) FAILED:", e.message.slice(0, 80));
  }

  console.log("\n5. Verifying getTwapPrice(AU)...");
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("   getTwapPrice(AU):", price.toString());
  } catch(e) {
    console.log("   getTwapPrice(AU) FAILED:", e.message.slice(0, 80));
  }

  console.log("\n=== COMPLETE ===");
  console.log("Oracle:", ORACLE);
}

main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
