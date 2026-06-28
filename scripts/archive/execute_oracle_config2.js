const { ethers } = require("hardhat");
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  console.log("Deployer:", wallet.address);
  
  const txs = JSON.parse(fs.readFileSync("scripts/oracle_config_txs.json", "utf-8"));
  
  // Use EIP-712 typed data signing for Safe v1.3
  const chainId = (await ethers.provider.getNetwork()).chainId;
  
  // Domain separator for Safe v1.3
  const domain = {
    verifyingContract: SAFE,
    chainId: chainId,
  };
  
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
  
  // Get nonce
  const safeAbi = ["function nonce() view returns (uint256)", "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)"];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
  const nonce = await safe.nonce();
  console.log("Safe nonce:", nonce.toString());
  
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const currentNonce = nonce.add(i);
    
    console.log(`\n=== Transaction ${i+1}: ${tx.description} ===`);
    
    const value = {
      to: tx.to,
      value: tx.value,
      data: tx.data,
      operation: 0, // Call
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: currentNonce,
    };
    
    const signature = await wallet._signTypedData(domain, types, value);
    console.log("Signature:", signature.slice(0, 30) + "...");
    
    const receipt = await safe.execTransaction(
      tx.to,
      tx.value,
      tx.data,
      0,
      0,
      0,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      signature
    );
    
    console.log("Submitted:", receipt.hash);
    const result = await receipt.wait();
    console.log("Status:", result.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
