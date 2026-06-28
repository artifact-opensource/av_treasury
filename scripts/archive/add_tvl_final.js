const { ethers } = require("hardhat");

const NEW_ORACLE = "0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
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
  
  const oracleIface = new ethers.utils.Interface(["function addTvlSource(address source)"]);
  const safeAbi = ["function nonce() view returns (uint256)", "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)"];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
  const nonce = await safe.nonce();
  const addStakingData = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  const txParams = {
    to: NEW_ORACLE,
    value: "0",
    data: addStakingData,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce: nonce,
  };
  
  const signature = await wallet._signTypedData(domain, types, txParams);
  
  // First simulate the inner call to see if it would work
  console.log("Simulating inner call...");
  try {
    const result = await ethers.provider.call({
      from: SAFE,
      to: NEW_ORACLE,
      data: addStakingData,
      gasLimit: 100000,
    });
    console.log("Inner call OK, result:", result.slice(0, 10));
  } catch(e) {
    console.log("Inner call reverts:", e.message.slice(0, 200));
    // If it reverts, we need to figure out why
    return;
  }
  
  // If simulation passes, send with high gas limit
  console.log("\nSending transaction...");
  const receipt = await safe.execTransaction(
    NEW_ORACLE, "0", addStakingData, 0,
    100000, // safeTxGas
    0,      // baseGas
    0,      // gasPrice
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    signature,
    { gasLimit: 200000 }
  );
  
  console.log("Submitted:", receipt.hash);
  const result = await receipt.wait();
  console.log("Status:", result.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
