const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const GOVERNOR = "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03";
  const TIMELOCK = "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77";
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  
  // Full Governor ABI
  const abi = [
    "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
    "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
    "function proposalThreshold() view returns (uint256)",
    "function votingDelay() view returns (uint256)",
    "function votingPeriod() view returns (uint256)",
    "function quorum(uint256) view returns (uint256)",
    "function state(uint256 proposalId) view returns (uint8)",
    "function proposer() view returns (address)",
  ];
  
  const governor = new ethers.Contract(GOVERNOR, abi, provider);
  
  try { console.log("proposalThreshold:", (await governor.proposalThreshold()).toString()); } catch(e) {}
  try { console.log("votingDelay:", (await governor.votingDelay()).toString()); } catch(e) {}
  try { console.log("votingPeriod:", (await governor.votingPeriod()).toString()); } catch(e) {}
  try { console.log("quorum:", (await governor.quorum(0)).toString()); } catch(e) {}
  try { console.log("proposer:", await governor.proposer()); } catch(e) {}
  
  // Try propose() - standard OZ propose
  const oracleIface = new ethers.utils.Interface([
    "function configureTwapPool(address token, address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)",
  ]);
  
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const configAuTwap = oracleIface.encodeFunctionData("configureTwapPool", [AU, POOL, AU, WETH, 600, true]);
  
  try {
    await provider.call({
      from: TIMELOCK,
      to: GOVERNOR,
      data: governor.interface.encodeFunctionData("propose", [[ORACLE], [0], [configAuTwap], "Configure AU TWAP"]),
    });
    console.log("✅ Governor.propose() from Timelock SIMULATION PASSED");
  } catch(e) { console.log("❌ Governor.propose() failed:", e.message.slice(0,100)); }
  
  try {
    await provider.call({
      from: TIMELOCK,
      to: GOVERNOR,
      data: governor.interface.encodeFunctionData("execute", [[ORACLE], [0], [configAuTwap], ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Configure AU TWAP"))]),
    });
    console.log("✅ Governor.execute() from Timelock SIMULATION PASSED");
  } catch(e) { console.log("❌ Governor.execute() failed:", e.message.slice(0,100)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
