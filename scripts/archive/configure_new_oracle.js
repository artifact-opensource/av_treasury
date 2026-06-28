const { ethers } = require("hardhat");
const fs = require("fs");

const NEW_ORACLE = "0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
const WETH = "0x4200000000000000000000000000000000000006";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
  // EIP-712 for Safe
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
  
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const safeAbi = ["function nonce() view returns (uint256)", "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)"];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
  const nonce = await safe.nonce();
  console.log("Safe nonce:", nonce.toString());
  
  // Transaction 1: Configure AU TWAP
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]);
  
  // Transaction 2: Add Staking as TVL source
  const addStaking = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  const txs = [
    { desc: "Configure AU TWAP (Aerodrome AU/WETH, 10min)", data: configAuTwap },
    { desc: "Add Staking as TVL source", data: addStaking },
  ];
  
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const currentNonce = nonce.add(i);
    
    console.log(`\n=== ${tx.desc} ===`);
    
    const value = {
      to: NEW_ORACLE,
      value: "0",
      data: tx.data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: currentNonce,
    };
    
    const signature = await wallet._signTypedData(domain, types, value);
    const receipt = await safe.execTransaction(
      NEW_ORACLE, "0", tx.data, 0, 0, 0, 0,
      ethers.constants.AddressZero, ethers.constants.AddressZero, signature
    );
    
    console.log("Submitted:", receipt.hash);
    const result = await receipt.wait();
    console.log("Status:", result.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
