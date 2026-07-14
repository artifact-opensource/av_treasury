const hre = require("hardhat");
const fs = require("fs");

const ADDR = JSON.parse(fs.readFileSync("deployments/testnet/addresses.json", "utf8"));
const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
const d = new hre.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

const FQN = {
  AuToken: "contracts/av_suite/AuToken.sol:AuToken",
  AgToken: "contracts/av_suite/AgToken.sol:AgToken",
  MockUSDC: "contracts/av_suite/MockUSDC.sol:MockUSDC",
  TreasuryAMO: "contracts/av_suite/TreasuryAMO.sol:TreasuryAMO",
  PID_Emission_Controller_v2: "contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2",
  AVLPStaking_v2: "contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2",
  AvOracle: "contracts/av_suite/AvOracle.sol:AvOracle",
  TreasuryFlashBuy_v2: "contracts/av_suite/TreasuryFlashBuy_v2.sol:TreasuryFlashBuy_v2",
};
const C = (name, addr) => hre.ethers.getContractAt(FQN[name], addr, d);

async function main() {
  const au = await C("AuToken", ADDR.AuToken);
  const ag = await C("AgToken", ADDR.AgToken);
  const usdc = await C("MockUSDC", ADDR.MockUSDC);
  const amo = await C("TreasuryAMO", ADDR.TreasuryAMO);
  const pid = await C("PID_Emission_Controller_v2", ADDR.PIDEmissionControllerV2);
  const staking = await C("AVLPStaking_v2", ADDR.AVLPStaking_v2);
  const oracle = await C("AvOracle", ADDR.AvOracle);

  console.log("══════════════════════════════════════════════════════");
  console.log("  AV TREASURY TESTNET — LIVE STATE AUDIT");
  console.log("══════════════════════════════════════════════════════");
  console.log("block:", (await provider.getBlockNumber()));

  // ── ORACLE ──
  try {
    const [pau, pag] = await oracle.getAuAgPrices();
    console.log("\n[ORACLE] AU price =", hre.ethers.utils.formatUnits(pau, 18), "(bootstrap mode nominal)");
    console.log("[ORACLE] AG price =", hre.ethers.utils.formatUnits(pag, 18));
    const boot = await oracle.bootstrapMode ? await oracle.bootstrapMode() : "n/a";
    console.log("[ORACLE] bootstrapMode =", boot);
  } catch (e) { console.log("\n[ORACLE] ERR", e.reason || e.message.slice(0,80)); }

  // ── SUPPLY / MINT ──
  console.log("\n[SUPPLY]");
  console.log("  AU total:", hre.ethers.utils.formatUnits(await au.totalSupply(), 18));
  console.log("  AG total:", hre.ethers.utils.formatUnits(await ag.totalSupply(), 18), "(genesis seed + AMO reserve + staking reserve)");

  // ── AMO TREASURY BALANCES ──
  console.log("\n[AMO TREASURY]");
  console.log("  AU held:", hre.ethers.utils.formatUnits(await au.balanceOf(ADDR.TreasuryAMO), 18));
  console.log("  AG reserve:", hre.ethers.utils.formatUnits(await ag.balanceOf(ADDR.TreasuryAMO), 18));
  console.log("  USDC held:", hre.ethers.utils.formatUnits(await usdc.balanceOf(ADDR.TreasuryAMO), 6));
  try { console.log("  lastBuybackTs:", (await amo.lastBuybackTs()).toString()); } catch(e){}
  try { console.log("  reserveCapBps:", (await amo.reserveCapBps()).toString()); } catch(e){}

  // ── PID EMISSION (rates live on staking; PID owns emission) ──
  console.log("\n[PID EMISSION]");
  try {
    console.log("  AU/block (staking):", hre.ethers.utils.formatUnits(await staking.auRewardPerBlock(), 18));
    console.log("  AG/block (staking):", hre.ethers.utils.formatUnits(await staking.agRewardPerBlock(), 18));
    console.log("  totalAGemitted:", hre.ethers.utils.formatUnits(await pid.totalAgEmitted(), 18));
    const EMIT = await pid.EMIT_ROLE();
    console.log("  keeper EMIT_ROLE:", await pid.hasRole(EMIT, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"), "<- our fix");
    console.log("  deployer EMIT_ROLE:", await pid.hasRole(EMIT, d.address));
  } catch(e){ console.log("  ERR", e.reason || e.message.slice(0,80)); }

  // ── STAKING ──
  console.log("\n[STAKING]");
  try {
    const stakes = await staking.getStakes(d.address);
    console.log("  deployer stake (AU, tokenId 0):", hre.ethers.utils.formatUnits(stakes[0] ? stakes[0].amount : 0, 18));
    const ADMIN = await staking.ADMIN_ROLE();
    console.log("  PID is staking admin:", await staking.hasRole(ADMIN, ADDR.PIDEmissionControllerV2));
    console.log("  auRewardPerBlock:", hre.ethers.utils.formatUnits(await staking.auRewardPerBlock(), 18));
    console.log("  agRewardPerBlock:", hre.ethers.utils.formatUnits(await staking.agRewardPerBlock(), 18));
  } catch(e){ console.log("  ERR", e.reason || e.message.slice(0,80)); }

  // ── ROLE WIRING (keeper) ──
  console.log("\n[ROLES]");
  const keeper = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const EXEC = await amo.EXECUTOR_ROLE();
  console.log("  keeper EXEC on AMO:", await amo.hasRole(EXEC, keeper));
  try {
    const FLASH = await hre.ethers.getContractAt("TreasuryFlashBuy_v2", ADDR.TreasuryFlashBuy_v2, d);
    const FEXEC = await FLASH.EXECUTOR_ROLE();
    console.log("  keeper EXEC on FlashBuy:", await FLASH.hasRole(FEXEC, keeper));
  } catch(e){ console.log("  FlashBuy role check skipped"); }
  const EMIT = await pid.EMIT_ROLE();
  console.log("  keeper EMIT on PID:", await pid.hasRole(EMIT, keeper), "<- our fix");

  console.log("\n══════════════════════════════════════════════════════");
}
main().catch(e => { console.log("FATAL", e.reason || e.message.slice(0,160)); process.exit(1); });
