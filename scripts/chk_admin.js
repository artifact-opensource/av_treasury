const hre = require("hardhat"); const fs = require("fs");
(async () => {
  const ADDR = JSON.parse(fs.readFileSync("deployments/testnet/addresses.json", "utf8"));
  const P = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
  const d = new hre.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", P);
  const staking = await hre.ethers.getContractAt("contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2", ADDR.AVLPStaking_v2, d);
  const ADMIN = await staking.ADMIN_ROLE();
  console.log("ADMIN_ROLE:", ADMIN);
  for (const [k, v] of Object.entries(ADDR)) {
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
      try { if (await staking.hasRole(ADMIN, v)) console.log("  ADMIN:", k, v); } catch (e) {}
    }
  }
  // AMO role check
  const amo = await hre.ethers.getContractAt("contracts/av_suite/TreasuryAMO.sol:TreasuryAMO", ADDR.TreasuryAMO, d);
  const EXEC = await amo.EXECUTOR_ROLE();
  console.log("AMO EXECUTOR holders:");
  for (const [k, v] of Object.entries(ADDR)) {
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
      try { if (await amo.hasRole(EXEC, v)) console.log("  EXEC:", k, v); } catch (e) {}
    }
  }
})().catch(e => console.log("FATAL", e.reason || e.message.slice(0, 120)));
