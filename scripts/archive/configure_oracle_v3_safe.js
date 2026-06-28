const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const ORACLE = "0xd17aB635250d4ce5bC7056AADFCcE44EA509a9aF";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const WETH = "0x4200000000000000000000000000000000000006";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
    "function nonce() view returns (uint256)",
  ];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
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
  console.log("Safe nonce:", nonce.toString());
  
  // Build calls
  const calls = [
    { desc: "Configure AU TWAP", to: ORACLE, data: oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]) },
    { desc: "Add Staking TVL", to: ORACLE, data: oracleIface.encodeFunctionData("addTvlSource", [STAKING]) },
  ];
  
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const currentNonce = nonce.add(i);
    
    console.log(`\n=== ${call.desc} ===`);
    
    const value = {
      to: call.to,
      value: "0",
      data: call.data,
      operation: 0,
      safeTxGas: 300000,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: currentNonce,
    };
    
    const signature = await wallet._signTypedData(domain, types, value);
    const receipt = await safe.execTransaction(
      value.to, value.value, value.data, value.operation,
      value.safeTxGas, value.baseGas, value.gasPrice,
      value.gasToken, value.refundReceiver, signature
    );
    console.log("tx:", receipt.hash);
    const result = await receipt.wait();
    console.log(result.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  }
  
  // Verify
  console.log("\n=== Post-config Verification ===");
  const oracle = new ethers.Contract(ORACLE, [
    "function twapPools(address) view returns (address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function getTvlSourceCount() view returns (uint256)",
    "function getTwapPrice(address token) view returns (uint256)",
    "function getPrice(address token) view returns (uint256 price, uint8 source)",
  ], ethers.provider);
  
  const twap = await oracle.twapPools(AU);
  console.log("AU twapPool set?", twap.pool !== ethers.constants.AddressZero ? "✅" : "❌");
  console.log("TVL sources:", (await oracle.getTvlSourceCount()).toString());
  
  try {
    const price = await oracle.getTwapPrice(AU);
    console.log("AU TWAP price:", ethers.utils.formatUnits(price, 18));
  } catch(e) { console.log("TWAP error:", e.message.slice(0,80)); }
  
  try {
    const [price, source] = await oracle.getPrice(AU);
    console.log("AU getPrice:", ethers.utils.formatUnits(price, 18), "source:", source);
  } catch(e) { console.log("getPrice error:", e.message.slice(0,80)); }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
