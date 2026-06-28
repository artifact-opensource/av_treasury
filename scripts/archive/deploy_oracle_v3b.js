const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "deployed_stack.json");

async function main() {
  const old = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const GOVERNOR_ADDR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  
  const AvOracle = await ethers.getContractFactory("contracts/av_suite/AvOracle.sol:AvOracle");
  const oracle = await AvOracle.deploy(
    "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    SAFE,
    GOVERNOR_ADDR
  );
  await oracle.deployed();
  console.log("AvOracle v3b:", oracle.address);

  old.AvOracle = { proxy: oracle.address, impl: oracle.address, verified: false };
  fs.writeFileSync(FILE, JSON.stringify(old, null, 2));

  await new Promise(r => setTimeout(r, 30000));
  try {
    await require("hardhat").run("verify:verify", {
      address: oracle.address,
      constructorArguments: [
        "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
        "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
        SAFE,
        GOVERNOR_ADDR
      ]
    });
    old.AvOracle.verified = true;
    fs.writeFileSync(FILE, JSON.stringify(old, null, 2));
    console.log("✅ Verified");
  } catch(e) { console.log("⚠️ Verify:", e.message.split('\n')[0]); }

  // Reconfigure
  const DEPLOYER_KEY = "fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de";
  const wallet = new ethers.Wallet(DEPLOYER_KEY, ethers.provider);
  
  const safeAbi = [
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) payable returns (bool success)",
    "function nonce() view returns (uint256)",
  ];
  const safe = new ethers.Contract(SAFE, safeAbi, wallet);
  
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
    "function addTvlSource(address source)",
    "function updatePrice(address token) returns (uint256)",
  ]);
  
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = { verifyingContract: SAFE, chainId };
  const types = {
    SafeTx: [
      { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "data", type: "bytes" }, { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" }, { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" }, { name: "nonce", type: "uint256" },
    ],
  };
  
  const calls = [
    { desc: "Configure AU TWAP", data: oracleIface.encodeFunctionData("configureTwapPool", ["0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08", "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665", "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08", "0x4200000000000000000000000000000000000006", 600, true]) },
    { desc: "Add Staking TVL", data: oracleIface.encodeFunctionData("addTvlSource", ["0x8F638B6C2EBD61A638561B6993930CF25D53ACB9"]) },
    { desc: "Update AU price", data: oracleIface.encodeFunctionData("updatePrice", ["0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08"]) },
  ];
  
  const nonce = await safe.nonce();
  
  for (let i = 0; i < calls.length; i++) {
    console.log(`\n${calls[i].desc}...`);
    const value = {
      to: oracle.address, value: "0", data: calls[i].data, operation: 0,
      safeTxGas: 300000, baseGas: 0, gasPrice: 0,
      gasToken: ethers.constants.AddressZero, refundReceiver: ethers.constants.AddressZero,
      nonce: nonce.add(i),
    };
    const sig = await wallet._signTypedData(domain, types, value);
    const receipt = await safe.execTransaction(value.to, value.value, value.data, value.operation, value.safeTxGas, value.baseGas, value.gasPrice, value.gasToken, value.refundReceiver, sig);
    const result = await receipt.wait();
    console.log(result.status === 1 ? "✅" : "❌", receipt.hash);
  }
  
  // Final verification
  console.log("\n=== Final Oracle Test ===");
  const oracle2 = new ethers.Contract(oracle.address, [
    "function getPrice(address) view returns (uint256 price, uint8 source)",
    "function getTwapPrice(address) view returns (uint256)",
    "function getTvlSourceCount() view returns (uint256)",
  ], ethers.provider);
  
  try {
    const [price, source] = await oracle2.getPrice("0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08");
    console.log("✅ AU getPrice:", ethers.utils.formatUnits(price, 18), "source:", source);
  } catch(e) { console.log("❌ getPrice:", e.message.slice(0,80)); }
  
  try {
    const twap = await oracle2.getTwapPrice("0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08");
    console.log("✅ AU getTwapPrice:", ethers.utils.formatUnits(twap, 18));
  } catch(e) { console.log("❌ getTwapPrice:", e.message.slice(0,80)); }
  
  console.log("TVL sources:", (await oracle2.getTvlSourceCount()).toString());
}
main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message.split('\n')[0]); process.exit(1); });
