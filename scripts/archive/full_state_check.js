const { ethers } = require("hardhat");
const fs = require("fs");

const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

const contracts = [
  ["QuasiCrystalLPNFT", "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8", [
    "function name() view returns(string)",
    "function symbol() view returns(string)",
    "function ownerOf(uint256) view returns(address)",
    "function totalSupply() view returns(uint256)",
  ]],
  ["AVLPStaking_v2", "0xd81Ca2F4E2c29d5d92fb6a224767c011c769b1E3", [
    "function auToken() view returns(address)",
    "function agToken() view returns(address)",
    "function lpNFT() view returns(address)",
    "function totalStaked() view returns(uint256)",
    "function rewardRates() view returns(uint256,uint256)",
    "function pidController() view returns(address)",
  ]],
  ["PID_Emission_Ctrl", "0xB8F240870DBc1cD5F9262F8180350A29ea404268", [
    "function treasuryAMO() view returns(address)",
    "function stakingContract() view returns(address)",
    "function targetTVL() view returns(uint256)",
    "function bootstrapActive() view returns(bool)",
  ]],
  ["ArtifactTimelock", "0x8BdfA2Bd3F42D3dF1f73f13eBE71ab132A269C77", [
    "function getMinDelay() view returns(uint256)",
    "function PROPOSER_ROLE() view returns(bytes32)",
    "function EXECUTOR_ROLE() view returns(bytes32)",
  ]],
  ["GovernorContract", "0x3A88006e036B94f9c9463A9210D9B3d7FF6ECa03", [
    "function executorAddress() view returns(address)",
    "function votingDelay() view returns(uint256)",
    "function votingPeriod() view returns(uint256)",
    "function quorumNumerator() view returns(uint256)",
    "function proposalThreshold() view returns(uint256)",
  ]],
  ["FlashLoan", "0x8DE65Bf42802EFBCbbdaaA89041FE7cd9C9858FA", [
    "function treasury() view returns(address)",
    "function dex() view returns(address)",
  ]],
  ["TreasuryFlashBuy", "0xaff7261f8CACA80d292A58E3fAEf72F0268F8053", [
    "function treasury() view returns(address)",
    "function flashLoan() view returns(address)",
    "function oracle() view returns(address)",
    "function dexSimulator() view returns(address)",
  ]],
  ["AvOracle", "0x39E7A01da3fD73df7eED92a52F82237a381A01FE", [
    "function latestAnswer() view returns(int256)",
    "function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)",
    "function auToken() view returns(address)",
    "function weth() view returns(address)",
  ]],
  ["DexSimulator", "0xED29f07E7b6F017619D83FD55DA673eE648c613c", [
    "function auToken() view returns(address)",
    "function agToken() view returns(address)",
  ]],
  ["TreasuryAMO", "0xF096cD4D24811B0F824c929907196bCB796bca88", [
    "function auToken() view returns(address)",
    "function reserveToken() view returns(address)",
    "function aerodromeRouter() view returns(address)",
    "function staking() view returns(address)",
    "function flashLoan() view returns(address)",
    "function flashBuy() view returns(address)",
    "function pidController() view returns(address)",
    "function treasury() view returns(address)",
  ]],
];

async function main() {
  const report = [];

  for (const [name, addr, abi] of contracts) {
    const c = await ethers.getContractAt(abi, addr);
    const entry = { name, addr, state: {}, errors: [] };

    for (const fn of abi) {
      const fnName = fn.match(/function (\w+)/)[1];
      try {
        const result = await c[fnName]();
        entry.state[fnName] = typeof result === "object" ? result.toString() : result.toString();
      } catch(e) {
        entry.errors.push(`${fnName}: ${e.message.split('\n')[0].slice(0, 80)}`);
      }
    }
    report.push(entry);
  }

  // Print report
  for (const entry of report) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`📍 ${entry.name} (${entry.addr})`);
    console.log(`${"═".repeat(60)}`);
    for (const [k, v] of Object.entries(entry.state)) {
      console.log(`  ${k.padEnd(25)} ${v}`);
    }
    if (entry.errors.length) {
      console.log(`  ⚠️ ERRORS:`);
      entry.errors.forEach(e => console.log(`    - ${e}`));
    }
  }

  // Save JSON
  fs.writeFileSync("contract_state_report.json", JSON.stringify(report, null, 2));
  console.log(`\n✅ Saved to contract_state_report.json`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
