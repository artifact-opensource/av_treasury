const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  const safe = new ethers.Contract(SAFE, [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
  ], wallet);

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

  const nonce = ethers.BigNumber.from(await ethers.provider.getStorageAt(SAFE, 5));
  
  // Send 0.001 ETH from Safe to deployer
  const fundAmount = ethers.utils.parseEther("0.001");
  
  // With gasPrice=0, safeTxGas=0, baseGas=0: the Safe pays for everything
  const value = {
    to: DEPLOYER,
    value: fundAmount,
    data: "0x",
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce,
  };
  
  const sig = await wallet._signTypedData(domain, types, value);
  console.log("Submitting fund transaction (gasPrice=0, Safe pays gas)...");
  
  const tx = await safe.execTransaction(
    DEPLOYER, fundAmount, "0x", 0, 0, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, sig,
    { gasLimit: 500000, type: 0, gasPrice: 0 }
  );
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  const deployerBal = await ethers.provider.getBalance(DEPLOYER);
  console.log("Deployer balance:", ethers.utils.formatEther(deployerBal), "ETH");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
