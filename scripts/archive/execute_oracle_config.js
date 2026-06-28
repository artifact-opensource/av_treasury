const { ethers } = require("hardhat");
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER_KEY = process.env.DEVELOPER_WALLET_PRIVATE_KEY || "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  console.log("Deployer:", wallet.address);
  
  const txs = JSON.parse(fs.readFileSync("scripts/oracle_config_txs.json", "utf-8"));
  
  // Submit each tx from deployer to the Safe via execTransaction
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  ];
  
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    console.log(`\n=== Transaction ${i+1}: ${tx.description} ===`);
    
    // Signatures: owner signature (type 0 = EOA)
    // pack(0x19, 0x01, safe, txHash) prefixed with EIP191
    // Actually for Safe v1.3: keccak256(0x1901 || domainSeparator || safeTxHash)
    
    // Simpler: use the @safe-global/safe-ethers-lib or manual encoding
    // For threshold=1, single owner signature
    
    // Compute safeTxHash
    const safeTxHash = await safe.getSafeTxHash(
      tx.to,
      tx.value,
      tx.data,
      0, // Call
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
      ethers.constants.AddressZero, // gasToken
      ethers.constants.AddressZero, // refundReceiver
    );
    
    console.log("safeTxHash:", safeTxHash);
    
    // Sign with deployer key
    const signature = await wallet.signMessage(ethers.utils.arrayify(safeTxHash));
    console.log("Signature:", signature.slice(0, 30) + "...");
    
    // Execute
    const receipt = await safe.execTransaction(
      tx.to,
      tx.value,
      tx.data,
      0, // Call
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
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
