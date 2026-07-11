const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0x1B5F6AC11efFeEBd5371858ce394DD0B8669732b";

const safeAbi = [
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
];

const oracleAbi = [
  "function bootstrapMode() view returns (bool)",
  "function setBootstrapMode(bool)",
];

async function signSafeTx(signer, safe, to, value, data, operation, nonce) {
  const txHash = await safe.getTransactionHash(
    to, value, data, operation, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, nonce
  );
  // Safe expects the raw 32-byte txHash signed (NOT EIP-191 prefixed).
  const sig = await signer.signMessage(ethers.utils.arrayify(txHash));
  const sigBytes = ethers.utils.arrayify(sig);
  // Append Safe EOA signature marker (0x1b/0x1c -> 0x1f/0x20)
  sigBytes[64] = sigBytes[64] + 4;
  return ethers.utils.hexlify(sigBytes);
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", await signer.getAddress());

  const safe = new ethers.Contract(SAFE, safeAbi, signer);
  const oracle = new ethers.Contract(ORACLE, oracleAbi, signer);

  console.log("bootstrapMode BEFORE:", await oracle.bootstrapMode());
  const threshold = await safe.getThreshold();
  console.log("Safe threshold:", threshold.toString());

  const calldata = oracle.interface.encodeFunctionData("setBootstrapMode", [false]);
  const nonce = (await safe.nonce()).toString();
  console.log("Safe nonce:", nonce);

  const sig = await signSafeTx(signer, safe, ORACLE, 0, calldata, 0, nonce);
  console.log("Submitting execTransaction (setBootstrapMode(false))...");

  const tx = await safe.execTransaction(
    ORACLE, 0, calldata, 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, sig,
    { gasLimit: 500000 }
  );
  console.log("Tx submitted:", tx.hash);
  const r = await tx.wait();
  console.log("Status:", r.status === 1 ? "SUCCESS ✅" : "FAILED ❌");
  console.log("bootstrapMode AFTER:", await oracle.bootstrapMode());
  console.log("=== DONE ===");
}

main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
