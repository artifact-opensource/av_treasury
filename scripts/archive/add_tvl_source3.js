const { ethers } = require("hardhat");

const NEW_ORACLE = "0xaE0D8aF68f4D610654c0517aA856335f6d92Ff8D";
const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";

async function main() {
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
  // Fund the Safe first from whatever we can
  const safeBal = await ethers.provider.getBalance(SAFE);
  console.log("Safe balance:", ethers.utils.formatEther(safeBal), "ETH");
  
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
  console.log("Safe nonce:", nonce.toString());
  
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
  
  // Get current gas price
  const feeData = await ethers.provider.getFeeData();
  console.log("Current maxFeePerGas:", ethers.utils.formatUnits(feeData.maxFeePerGas, "gwei"), "gwei");
  console.log("Current maxPriorityFeePerGas:", ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, "gwei"), "gwei");
  
  // Calculate max cost: (safeTxGas + baseGas) * maxFeePerGas
  // The Safe is paying gas from its own balance
  // safeTxGas=150000, baseGas=0, maxFee=20gwei => 150000 * 20e9 = 0.003 ETH
  // But Safe only has 0.0006 ETH!
  
  // We need to fund the Safe first
  // Let's calculate how much we need
  const maxFee = ethers.utils.parseUnits("20", "gwei");
  const maxCost = ethers.BigNumber.from("150000").mul(maxFee);
  console.log("Max tx cost:", ethers.utils.formatEther(maxCost), "ETH");
  console.log("Safe shortfall:", ethers.utils.formatEther(maxCost.sub(safeBal)), "ETH");
  
  // Fund the Safe
  const fundAmount = maxCost.sub(safeBal).add(ethers.utils.parseEther("0.001")); // extra for future txs
  const deployerBal = await ethers.provider.getBalance(wallet.address);
  console.log("Deployer balance:", ethers.utils.formatEther(deployerBal), "ETH");
  
  if (deployerBal.gt(fundAmount)) {
    console.log("\nFunding Safe with", ethers.utils.formatEther(fundAmount), "ETH...");
    const fundTx = await wallet.sendTransaction({
      to: SAFE,
      value: fundAmount,
      gasLimit: 21000,
      maxFeePerGas: ethers.utils.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"),
    });
    console.log("Fund tx:", fundTx.hash);
    await fundTx.wait();
    console.log("✅ Safe funded");
  } else {
    console.log("❌ Deployer doesn't have enough ETH to fund Safe");
    console.log("Need:", ethers.utils.formatEther(fundAmount), "Have:", ethers.utils.formatEther(deployerBal));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
