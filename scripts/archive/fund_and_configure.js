const { ethers } = require("hardhat");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
const DEPLOYER = "0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E";
const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
const ORACLE = "0xbAe5FA893A23330Cb4608d58bBCf52918dA5E60A";
const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
const WETH = "0x4200000000000000000000000000000000000006";
const STAKING = "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9";

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
  console.log("Safe nonce:", nonce.toString());
  
  // Step 0: Fund deployer with 0.002 ETH from Safe
  const fundAmount = ethers.utils.parseEther("0.002");
  console.log("\n=== Step 0: Fund deployer with 0.002 ETH ===");
  
  const fundValue = { to: DEPLOYER, value: fundAmount, data: "0x", operation: 0, safeTxGas: 0, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce };
  const fundSig = await wallet._signTypedData(domain, types, fundValue);
  
  const fundTx = await safe.execTransaction(
    DEPLOYER, fundAmount, "0x", 0, 100000, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, fundSig,
    { gasLimit: 150000 }
  );
  console.log("Fund tx:", fundTx.hash);
  await fundTx.wait();
  console.log("✅ Deployer funded");

  // Check deployer balance
  const bal = await ethers.provider.getBalance(DEPLOYER);
  console.log("Deployer balance:", ethers.utils.formatEther(bal), "ETH");

  // Step 1: Initialize TWAP for AU
  console.log("\n=== Step 1: initializeTwap(AU) ===");
  const oracleIface = new ethers.utils.Interface([
    "function initializeTwap(address token)",
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
  ]);
  
  const initData = oracleIface.encodeFunctionData("initializeTwap", [AU]);
  const GAS_LIMIT = 500000;
  
  const tx1 = await safe.execTransaction(
    ORACLE, 0, initData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero,
    await wallet._signTypedData(domain, types, { to: ORACLE, value: 0, data: initData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce.add(1) }),
    { gasLimit: GAS_LIMIT }
  );
  console.log("initializeTwap tx:", tx1.hash);
  await tx1.wait();
  console.log("✅ Confirmed");

  // Step 2: Configure TWAP pool for AU
  console.log("\n=== Step 2: configureTwapPool(AU) ===");
  const configData = oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]);
  
  const tx2 = await safe.execTransaction(
    ORACLE, 0, configData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero,
    await wallet._signTypedData(domain, types, { to: ORACLE, value: 0, data: configData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce.add(2) }),
    { gasLimit: GAS_LIMIT }
  );
  console.log("configureTwapPool tx:", tx2.hash);
  await tx2.wait();
  console.log("✅ Confirmed");

  // Step 3: Add Staking as TVL source
  console.log("\n=== Step 3: addTvlSource(STAKING) ===");
  const tvlData = oracleIface.encodeFunctionData("addTvlSource", [STAKING]);
  
  const tx3 = await safe.execTransaction(
    ORACLE, 0, tvlData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero,
    await wallet._signTypedData(domain, types, { to: ORACLE, value: 0, data: tvlData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce.add(3) }),
    { gasLimit: GAS_LIMIT }
  );
  console.log("addTvlSource tx:", tx3.hash);
  await tx3.wait();
  console.log("✅ Confirmed");

  console.log("\n=== All oracle configuration complete ===");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
