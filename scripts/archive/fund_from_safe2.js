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
  const fundAmount = ethers.utils.parseEther("0.001");
  
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
  
  // Try without specifying gas options - let ethers handle it
  // The key insight: when gasPrice=0, the Safe itself pays for gas
  // The outer tx gas is still paid by the signer though
  
  // Actually, let me check: does the deployer need ETH for the OUTER tx gas?
  // Yes, the deployer pays for the network transaction that submits the Safe tx
  // The Safe only pays for the INNER call gas
  
  // So the deployer ALWAYS needs ETH for the outer tx, regardless of gasPrice in Safe
  
  const deployerBal = await ethers.provider.getBalance(DEPLOYER);
  const gasPrice = await ethers.provider.getGasPrice();
  const outerGasCost = ethers.BigNumber.from("21000").mul(gasPrice);
  console.log("Deployer balance:", ethers.utils.formatEther(deployerBal));
  console.log("Outer tx gas cost:", ethers.utils.formatEther(outerGasCost));
  console.log("Can afford outer tx?", deployerBal.gte(outerGasCost));
  
  // The deployer has 0.000002 ETH but needs ~0.000126 ETH for a basic transfer
  // This is impossible without external funding
  
  // Can the OTHER owner submit? Let's check owner 2
  const OWNER2 = "0x88dB13685836D44964Ce0595E75cA045CF931312";
  const owner2Bal = await ethers.provider.getBalance(OWNER2);
  console.log("\nOwner 2 balance:", ethers.utils.formatEther(owner2Bal));
  console.log("Owner 2 can afford outer tx?", owner2Bal.gte(outerGasCost));
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
