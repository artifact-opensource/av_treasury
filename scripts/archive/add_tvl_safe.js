const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0x5332953B7EEa5092b1C620849256cFaF15E5cB53";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
  // First simulate
  const oracleAbi = ["function addTvlSource(address source)"];
  const oracle = new ethers.Contract(ORACLE, oracleAbi, ethers.provider);
  try {
    await ethers.provider.call({ from: SAFE, to: ORACLE, data: oracle.interface.encodeFunctionData("addTvlSource", [STAKING]) });
    console.log("✅ Simulation passed");
  } catch(e) { console.log("❌ Simulation failed:", e.message.slice(0,80)); return; }
  
  // Submit via Safe
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
    "function nonce() view returns (uint256)",
  ];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  const nonce = await safe.nonce();
  console.log("Nonce:", nonce.toString());
  
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = { verifyingContract: SAFE, chainId };
  const types = {
    SafeTx: [
      { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "data", type: "bytes" }, { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" }, { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" }, { name: "nonce", type: "uint256" },
    ],
  };
  
  const value = {
    to: ORACLE, value: "0",
    data: oracle.interface.encodeFunctionData("addTvlSource", [STAKING]),
    operation: 0, safeTxGas: 500000, baseGas: 0, gasPrice: 0,
    gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero,
    nonce,
  };
  
  const sig = await wallet._signTypedData(domain, types, value);
  const receipt = await safe.execTransaction(
    value.to, value.value, value.data, value.operation,
    value.safeTxGas, value.baseGas, value.gasPrice,
    value.gasToken, value.refundReceiver, sig
  );
  console.log("tx:", receipt.hash);
  const result = await receipt.wait();
  console.log(result.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
