const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
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

  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function initializeTwap(address token)",
  ]);

  const nonce = BigNumber.from(await ethers.provider.getStorageAt(SAFE, 5));
  console.log("Safe nonce:", nonce.toString());

  const GAS_LIMIT = 500000;

  // 1. Initialize TWAP timestamp for AU
  const initData = oracleIface.encodeFunctionData("initializeTwap", [AU]);
  const initValue = { to: ORACLE, value: 0, data: initData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce };
  const initSig = await wallet._signTypedData(domain, types, initValue);

  // 2. Configure TWAP pool for AU
  const configData = oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]);
  const configValue = { to: ORACLE, value: 0, data: configData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce.add(1) };
  const configSig = await wallet._signTypedData(domain, types, configValue);

  // Execute both
  const tx1 = await safe.execTransaction(
    ORACLE, 0, initData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, initSig,
    { gasLimit: GAS_LIMIT }
  );
  console.log("1. initializeTwap(AU):", tx1.hash);
  await tx1.wait();
  console.log("   ✅ Confirmed");

  const tx2 = await safe.execTransaction(
    ORACLE, 0, configData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, configSig,
    { gasLimit: GAS_LIMIT }
  );
  console.log("2. configureTwapPool(AU):", tx2.hash);
  await tx2.wait();
  console.log("   ✅ Confirmed");

  // 3. Add Staking as TVL source
  const tvlIface = new ethers.utils.Interface(["function addTvlSource(address source)"]);
  const tvlData = tvlIface.encodeFunctionData("addTvlSource", [STAKING]);
  const tvlValue = { to: ORACLE, value: 0, data: tvlData, operation: 0, safeTxGas: GAS_LIMIT, baseGas: 0, gasPrice: 0, gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero, nonce: nonce.add(2) };
  const tvlSig = await wallet._signTypedData(domain, types, tvlValue);

  const tx3 = await safe.execTransaction(
    ORACLE, 0, tvlData, 0, GAS_LIMIT, 0, 0,
    ethers.constants.AddressZero, ethers.constants.AddressZero, tvlSig,
    { gasLimit: GAS_LIMIT }
  );
  console.log("3. addTvlSource(STAKING):", tx3.hash);
  await tx3.wait();
  console.log("   ✅ Confirmed");
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
