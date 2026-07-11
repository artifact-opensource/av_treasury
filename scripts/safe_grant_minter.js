const { ethers } = require("hardhat");

// Treasury Gnosis Safe (holds AgToken admin per Sirius instruction)
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const AGT = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674"; // AgToken proxy
const NEW_PID = "0x43E2ecdA40B3a5F1cEC1BBD5e8147B27a3659dfD"; // NEW PID controller (minter)

const safeAbi = [
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
];

const agAbi = [
  "function MINTER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
];

async function signSafeTx(signer, safe, to, value, data, operation, nonce) {
  const txHash = await safe.getTransactionHash(
    to, value, data, operation, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, nonce
  );
  const sig = await signer.signMessage(ethers.utils.arrayify(txHash));
  const sigBytes = ethers.utils.arrayify(sig);
  sigBytes[64] = sigBytes[64] + 4; // Safe EOA signature marker
  return ethers.utils.hexlify(sigBytes);
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", await signer.getAddress());

  const safe = new ethers.Contract(SAFE, safeAbi, signer);
  const ag = new ethers.Contract(AGT, agAbi, signer);

  const MR = await ag.MINTER_ROLE();
  console.log("MINTER_ROLE:", MR);
  console.log("hasRole(MINTER, NEW PID 0x43E2) BEFORE:", await ag.hasRole(MR, NEW_PID));

  const threshold = await safe.getThreshold();
  console.log("Safe threshold:", threshold.toString());

  const calldata = ag.interface.encodeFunctionData("grantRole", [MR, NEW_PID]);
  const nonce = (await safe.nonce()).toString();
  console.log("Safe nonce:", nonce);

  const sig = await signSafeTx(signer, safe, AGT, 0, calldata, 0, nonce);
  console.log("Submitting execTransaction via Safe...");

  const tx = await safe.execTransaction(
    AGT, 0, calldata, 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, sig
  );
  console.log("Tx submitted:", tx.hash);
  const r = await tx.wait();
  console.log("Status:", r.status === 1 ? "SUCCESS ✅" : "FAILED ❌");

  console.log("hasRole(MINTER, NEW PID 0x43E2) AFTER:", await ag.hasRole(MR, NEW_PID));
  console.log("=== DONE ===");
}

main().then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
