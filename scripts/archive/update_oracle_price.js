const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0xd17aB635250d4ce5bC7056AADFCcE44EA509a9aF";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
  const oracleAbi = [
    "function updatePrice(address token) external",
    "function getPrice(address token) view returns (uint256 price, uint8 source)",
    "function getTwapPrice(address token) view returns (uint256)",
  ];
  
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
    "function nonce() view returns (uint256)",
  ];
  
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  const oracle = new ethers.Contract(ORACLE, oracleAbi, wallet);
  
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = { verifyingContract: SAFE, chainId };
  const types = {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  };
  
  const nonce = await safe.nonce();
  
  // Call updatePrice via Safe
  const data = oracle.interface.encodeFunctionData("updatePrice", [AU]);
  
  const value = {
    to: ORACLE,
    value: "0",
    data: data,
    operation: 0,
    safeTxGas: 300000,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce: nonce,
  };
  
  const signature = await wallet._signTypedData(domain, types, value);
  const receipt = await safe.execTransaction(
    value.to, value.value, value.data, value.operation,
    value.safeTxGas, value.baseGas, value.gasPrice,
    value.gasToken, value.refundReceiver, signature
  );
  console.log("updatePrice tx:", receipt.hash);
  const result = await receipt.wait();
  console.log(result.status === 1 ? "✅ updatePrice SUCCESS" : "❌ FAILED");
  
  // Now test getPrice
  try {
    const [price, source] = await oracle.getPrice(AU);
    console.log("AU getPrice:", ethers.utils.formatUnits(price, 18), "source:", source);
  } catch(e) { console.log("getPrice error:", e.message.slice(0,80)); }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
