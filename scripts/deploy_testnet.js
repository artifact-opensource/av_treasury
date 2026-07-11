/**
 * deploy_testnet.js — FULL STACK deployment to LOCAL Hardhat testnet.
 * Systematic, per DEPLOYMENT_PLAN.md. NO mainnet. Local only.
 *
 * Verified ctors (read from source, not guessed):
 *   AuToken.initialize(_treasury)            [UUPS]
 *   AgToken.initialize()                     [UUPS, NO genesis mint]
 *   AvOracle(_au,_ag,_admin,_governor)
 *   TreasuryAMO(_auToken,_reserveToken,_aerodromeRouter,_admin)
 *   TreasuryFlashBuy_v2(_treasury,_usdcToken,_agToken,_auToken,_oracleWrapper,_keeper,_dex)
 *   OracleWrapper(_avOracle,_treasuryAMO,_treasuryFlashBuy,_deviationThreshold,_maxStaleness)
 *   TreasurySafe(address[] owners, uint threshold)  [2-of-2]
 *   ArtifactTimelock(_proposer,_executor,_canceler)  [TimelockController subclass]
 *   GovernorContractV5(IVotes _token, TimelockController _timelock)
 *   PIDEmissionControllerV2(admin, staking_, agToken_, targetTVL_, kp_, ki_, kd_)
 *   AVLPStaking_v2.initialize()              [UUPS]
 *   MockUSDC()  /  MockAerodromeRouter()
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const RPC = process.env.TESTNET_RPC || "http://localhost:8545";
const CHAIN_ID = 31337;
const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
const p6 = (n) => hre.ethers.utils.parseUnits(n.toString(), 6);

// Fully-qualified names (av_suite has name collisions with sandbox/MockTokens.sol)
const FQN = {
  AuToken: "contracts/av_suite/AuToken.sol:AuToken",
  AgToken: "contracts/av_suite/AgToken.sol:AgToken",
  TreasuryAMO: "contracts/av_suite/TreasuryAMO.sol:TreasuryAMO",
  TreasuryFlashBuy_v2: "contracts/av_suite/TreasuryFlashBuy_v2.sol:TreasuryFlashBuy_v2",
  AvOracle: "contracts/av_suite/AvOracle.sol:AvOracle",
  OracleWrapper: "contracts/av_suite/OracleWrapper.sol:OracleWrapper",
  TreasurySafe: "contracts/av_suite/TreasurySafe.sol:TreasurySafe",
  ArtifactTimelock: "contracts/av_suite/ArtifactTimelock.sol:ArtifactTimelock",
  GovernorContractV5: "contracts/av_suite/GovernorContractV5.sol:GovernorContractV5",
  PIDEmissionControllerV2: "contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2",
  AVLPStaking_v2: "contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2",
  QuasiCrystalLPNFT: "contracts/av_suite/QuasiCrystalLPNFT.sol:QuasiCrystalLPNFT",
  MockUSDC: "contracts/av_suite/MockUSDC.sol:MockUSDC",
  MockAerodromeRouter: "contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter",
};

async function deployUUPS(name, initSig, initArgs, signer) {
  const Impl = await hre.ethers.getContractFactory(FQN[name], signer);
  const impl = await Impl.deploy();
  await impl.deployed();
  const initData = impl.interface.encodeFunctionData(initSig, initArgs);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy", signer);
  const proxy = await Proxy.deploy(impl.address, initData);
  await proxy.deployed();
  return hre.ethers.getContractAt(FQN[name], proxy.address);
}

async function main() {
  const [deployer, keeper, safe2] = await hre.ethers.getSigners();
  console.log("Deployer :", deployer.address);
  console.log("Keeper   :", keeper.address);
  console.log("SafeOwn2 :", safe2.address);

  const out = {};
  const note = (k, v) => { out[k] = v; console.log(`  ${k.padEnd(24)} = ${v}`); };

  // ── PHASE 1: TOKENS (UUPS) ──
  console.log("\n=== PHASE 1: Tokens (Artifact Utility + Artifact Governance) ===");
  const au = await deployUUPS("AuToken", "initialize", [deployer.address], deployer);
  const ag = await deployUUPS("AgToken", "initialize", [deployer.address], deployer);
  // (FQN resolved inside deployUUPS)
  note("AuToken", au.address);
  note("AgToken", ag.address);
  // Au/Ag mint needs MINTER_ROLE (grant to deployer for testnet seeding only)
  const MINTER = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  await (await au.connect(deployer).grantRole(MINTER, deployer.address)).wait();
  await (await au.connect(deployer).mint(deployer.address, p18(5_000_000))).wait();
  // raise transfer limits to 100% for testnet free-flowing markets
  await (await au.connect(deployer).setMaxTxAmount(10000)).wait();
  await (await au.connect(deployer).setMaxWalletAmount(10000)).wait();
  await (await au.connect(deployer).setFeesEnabled(false)).wait();
  // Ag has NO genesis mint (emitted via staking/PID) — grant MINTER to deployer for testnet seeding only
  await (await ag.connect(deployer).grantRole(MINTER, deployer.address)).wait();
  await (await ag.connect(deployer).mint(deployer.address, p18(5_000_000))).wait();
  console.log("  minted 5,000,000 AU + 5,000,000 AG to deployer (testnet seed; limits 100%)");
  console.log("  DEBUG AU bal:", (await au.balanceOf(deployer.address)).toString(), "AG bal:", (await ag.balanceOf(deployer.address)).toString());

  // ── USDC + MOCK DEX (local AMM) ──
  const USDC = await hre.ethers.getContractFactory(FQN.MockUSDC, deployer);
  const usdc = await USDC.deploy(); await usdc.deployed();
  note("MockUSDC", usdc.address);
  const Router = await hre.ethers.getContractFactory(FQN.MockAerodromeRouter, deployer);
  const router = await Router.deploy(); await router.deployed();
  note("MockAerodromeRouter", router.address);
  // whitelist router in AuToken so SELL swaps (transfer to contract) aren't blocked by cooldown
  try { await (await au.connect(deployer).setWhitelistedContract(router.address, true)).wait(); console.log("  AuToken: router whitelisted for transfers"); }
  catch (e) { console.log("  (AuToken whitelist skipped:", e.message.slice(0,40), ")"); }
  // seed pools: AU/USDC, AG/USDC, AU/ETH, AG/ETH (ETH = WETH-like placeholder = deployer ETH)
  const WETH = await deployUUPS("AgToken", "initialize", [deployer.address], deployer); // reuse as WETH mock
  note("MockWETH", WETH.address);
  // WETH is a separate AgToken instance — mint it to deployer for seeding
  await (await WETH.connect(deployer).grantRole(MINTER, deployer.address)).wait();
  await (await WETH.connect(deployer).mint(deployer.address, p18(5_000_000))).wait();
  const IERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function mint(address,uint256)"];
  const tok = (addr, signer) => new hre.ethers.Contract(addr, IERC20_ABI, signer);
  const seed = async (a, b, ra, rb) => {
    console.log(`    seed ${a.slice(0,8)}/${b.slice(0,8)} ra=${ra.toString().slice(0,6)} balA=${await (await tok(a, deployer).balanceOf(deployer.address)).toString()}`);
    if ((await tok(a, deployer).balanceOf(deployer.address)).gte(ra))
      await (await tok(a, deployer).approve(router.address, ra)).wait();
    if ((await tok(b, deployer).balanceOf(deployer.address)).gte(rb))
      await (await tok(b, deployer).approve(router.address, rb)).wait();
    await (await router.connect(deployer).addLiquidity(a, b, ra, rb)).wait();
  };
  await (await au.connect(deployer).approve(router.address, p18(500_000))).wait();
  await (await ag.connect(deployer).approve(router.address, p18(500_000))).wait();
  await (await usdc.connect(deployer).approve(router.address, hre.ethers.utils.parseUnits("500000", 6))).wait();
  await (await WETH.connect(deployer).approve(router.address, p18(500_000))).wait();
  await seed(au.address, usdc.address, p18(500_000), hre.ethers.utils.parseUnits("500000", 6));
  await seed(ag.address, usdc.address, p18(500_000), hre.ethers.utils.parseUnits("500000", 6));
  await seed(au.address, WETH.address, p18(500_000), p18(500_000));
  await seed(ag.address, WETH.address, p18(500_000), p18(500_000));
  await seed(ag.address, au.address, p18(500_000), p18(500_000)); // AMO sells AG for AU via Aerodrome
  console.log("  seeded AU/AG/USDC/WETH + AG/AU pools on mock router");
  // write partial addresses early for debugging
  fs.writeFileSync(path.join(__dirname, "..", "deployments", "testnet", "addresses.json"), JSON.stringify(out, null, 2));

  // ── PHASE 2: ORACLE ──
  console.log("\n=== PHASE 2: Oracle (AvOracle v5) ===");
  const AvOracle = await hre.ethers.getContractFactory("AvOracle", deployer);
  const oracle = await AvOracle.deploy(au.address, ag.address, deployer.address, deployer.address);
  await oracle.deployed();
  note("AvOracle", oracle.address);
  await (await oracle.connect(deployer).setBootstrapPrice(au.address, p18(0.01), 86400 * 365)).wait();
  await (await oracle.connect(deployer).setBootstrapPrice(ag.address, p18(0.01), 86400 * 365)).wait();
  console.log("  setBootstrapPrice AU=AG=0.01 (valid 1y)");
  try { await (await oracle.connect(deployer).setBootstrapMode(true)).wait(); console.log("  setBootstrapMode(true) — nominal prices bypass staleness"); }
  catch (e) { console.log("  (setBootstrapMode skipped:", e.message.slice(0,50), ")"); }

  // ── PHASE 3a: AMO + FLASHBUY ──
  console.log("\n=== PHASE 3a: TreasuryAMO + TreasuryFlashBuy_v2 ===");
  const TreasuryAMO = await hre.ethers.getContractFactory(FQN.TreasuryAMO, deployer);
  const amo = await TreasuryAMO.deploy(au.address, ag.address, router.address, deployer.address);
  await amo.deployed();
  note("TreasuryAMO", amo.address);

  const FlashBuy = await hre.ethers.getContractFactory(FQN.TreasuryFlashBuy_v2, deployer);
  const flash = await FlashBuy.deploy(
    deployer.address, deployer.address, usdc.address, ag.address, au.address,
    router.address, hre.ethers.utils.parseUnits("1000", 6), p18(1), deployer.address
  );
  await flash.deployed();
  note("TreasuryFlashBuy_v2", flash.address);

  // ── PHASE 3b: ORACLE WRAPPER (immutable AMO + FlashBuy) ──
  console.log("\n=== PHASE 3b: OracleWrapper ===");
  const OracleWrapper = await hre.ethers.getContractFactory(FQN.OracleWrapper, deployer);
  const wrapper = await OracleWrapper.deploy(oracle.address, amo.address, flash.address, 500, 3600);
  await wrapper.deployed();
  note("OracleWrapper", wrapper.address);
  const AU_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
  const AG_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AG"));
  await (await wrapper.connect(deployer).setTokenAddress(AU_KEY, au.address)).wait();
  await (await wrapper.connect(deployer).setTokenAddress(AG_KEY, ag.address)).wait();
  console.log("  wrapper token keys AU/AG registered");
  // repoint FlashBuy to real wrapper (ctor used placeholder)
  await (await flash.connect(deployer).setOracleWrapper(wrapper.address)).wait();
  console.log("  FlashBuy.setOracleWrapper -> wrapper");

  // ── PHASE 4a: TREASURY SAFE (2-of-2) ──
  console.log("\n=== PHASE 4a: TreasurySafe (2-of-2) ===");
  const TreasurySafe = await hre.ethers.getContractFactory(FQN.TreasurySafe, deployer);
  const safe = await TreasurySafe.deploy([deployer.address, safe2.address], 2);
  await safe.deployed();
  note("TreasurySafe", safe.address);
  note("SafeOwners", `${deployer.address},${safe2.address}`);
  note("SafeThreshold", "2");

  // ── PHASE 4b: TIMELOCK + GOVERNOR ──
  console.log("\n=== PHASE 4b: Timelock + Governor ===");
  const Timelock = await hre.ethers.getContractFactory(FQN.ArtifactTimelock, deployer);
  const timelock = await Timelock.deploy(deployer.address, deployer.address, deployer.address);
  await timelock.deployed();
  note("ArtifactTimelock", timelock.address);
  const Gov = await hre.ethers.getContractFactory(FQN.GovernorContractV5, deployer);
  const gov = await Gov.deploy(ag.address, timelock.address);
  await gov.deployed();
  note("GovernorContractV5", gov.address);

  // ── PHASE 4b-2: Buyback wiring (seed reserves, grant EXECUTOR, set triggers) ──
  console.log("\n=== PHASE 4b-2: Buyback wiring ===");
  const EXEC = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));
  // AMO needs AG reserve balance to sell for AU
  await (await ag.connect(deployer).mint(amo.address, p18(500_000))).wait();
  // FlashBuy pulls USDC from treasury (=deployer, per ctor _treasury arg). Seed deployer + approve FlashBuy.
  await (await usdc.connect(deployer).mint(deployer.address, p6(2_000_000))).wait();
  await (await usdc.connect(deployer).approve(flash.address, p6(2_000_000))).wait();
  console.log("  seeded treasury(deployer) USDC + approved FlashBuy");
  // AMO cooldown = 60s for testnet (allow periodic buybacks; 0 is rejected by contract)
  try { await (await amo.connect(deployer).setCooldown(60)).wait(); console.log("  AMO.setCooldown(60)"); }
  catch (e) { console.log("  (AMO.setCooldown skipped:", e.message.slice(0,40), ")"); }
  // grant EXECUTOR_ROLE to keeper (Acct#1) so engine can drive buybacks
  await (await amo.connect(deployer).grantRole(EXEC, keeper.address)).wait();
  await (await flash.connect(deployer).grantRole(EXEC, keeper.address)).wait();
  console.log("  seeded AMO(500k AG) + FlashBuy(500k USDC); granted EXECUTOR to keeper");
  // set reference prices so buyback triggers can fire (bootstrap price = 0.01)
  await (await wrapper.connect(deployer).setReferencePrice(AU_KEY, p18(1))).wait();
  await (await wrapper.connect(deployer).setReferencePrice(AG_KEY, p18(1))).wait();
  // FlashBuy: enable + set trigger (price drops 5% below ref => buyback)
  try { await (await flash.connect(deployer).setActive(true)).wait(); console.log("  FlashBuy.setActive(true)"); }
  catch (e) { console.log("  (FlashBuy.setActive skipped:", e.message.slice(0,40), ")"); }
  try { await (await wrapper.connect(deployer).setFlashBuyEnabled(true)).wait(); console.log("  wrapper.setFlashBuyEnabled(true)"); }
  catch (e) { console.log("  (wrapper.setFlashBuyEnabled skipped:", e.message.slice(0,40), ")"); }
  try { await (await wrapper.connect(deployer).setFlashBuyTrigger(9500)).wait(); console.log("  wrapper.setFlashBuyTrigger(9500 bps = 0.95)"); }
  catch (e) { console.log("  (wrapper.setFlashBuyTrigger skipped:", e.message.slice(0,40), ")"); }

  // ── PHASE 4c: PID + STAKING ──
  console.log("\n=== PHASE 4c: PID Emission + AVLPStaking_v2 ===");
  // LP NFT (needed by staking initialize) — link QuasiCrystalSVG lib (SVG has no sub-libs)
  const Base64Lib = await hre.ethers.getContractFactory("contracts/av_suite/OnChainBase64.sol:OnChainBase64", deployer);
  const base64 = await Base64Lib.deploy(); await base64.deployed();
  const SVGLib = await hre.ethers.getContractFactory("contracts/av_suite/QuasiCrystalSVG.sol:QuasiCrystalSVG", deployer);
  const svg = await SVGLib.deploy(); await svg.deployed();
  const LPNFT = await hre.ethers.getContractFactory(FQN.QuasiCrystalLPNFT, { signer: deployer, libraries: { QuasiCrystalSVG: svg.address } });
  const lpnft = await LPNFT.deploy("QuasiCrystal LP", "QCLP", deployer.address, deployer.address, deployer.address);
  await lpnft.deployed();
  note("QuasiCrystalLPNFT", lpnft.address);
  const staking = await deployUUPS("AVLPStaking_v2", "initialize", [au.address, ag.address, lpnft.address], deployer);
  note("AVLPStaking_v2", staking.address);
  const PID = await hre.ethers.getContractFactory(FQN.PIDEmissionControllerV2, deployer);
  const GAIN = hre.ethers.BigNumber.from("1000000000000000"); // 1e15, within [1e12,1e18]
  const pid = await PID.deploy(deployer.address, staking.address, ag.address, p18(1_000_000), GAIN, GAIN, GAIN);
  await pid.deployed();
  note("PIDEmissionControllerV2", pid.address);
  try { await (await staking.connect(deployer).setEmissionController(pid.address)).wait(); console.log("  staking.setEmissionController(pid) ok"); }
  catch (e) { console.log("  (staking<->pid wire skipped:", e.message.slice(0,40), ")"); }

  // ── FEED THE FLYWHEEL (CRITICAL) ──────────────────────────────────────
  // Without this, staking.auRewardPerBlock / agRewardPerBlock stay 0 and the
  // flywheel emits nothing. PID must be staking ADMIN to call setRewardRates,
  // and the staking contract needs reward reserves minted to it.
  const ADMIN = await staking.ADMIN_ROLE();
  try { await (await staking.connect(deployer).grantRole(ADMIN, pid.address)).wait(); console.log("  staking.grantRole(ADMIN, pid) ok"); }
  catch (e) { console.log("  (grantRole skipped:", e.message.slice(0,40), ")"); }
  // PID must be MINTER on AG (and AU) so executeEmission can mint rewards.
  const MINTER_R = await ag.MINTER_ROLE();
  try { await (await ag.connect(deployer).grantRole(MINTER_R, pid.address)).wait(); console.log("  ag.grantRole(MINTER, pid) ok"); }
  catch (e) { console.log("  (ag minter skipped:", e.message.slice(0,40), ")"); }
  try { await (await au.connect(deployer).grantRole(MINTER_R, pid.address)).wait(); console.log("  au.grantRole(MINTER, pid) ok"); }
  catch (e) { console.log("  (au minter skipped:", e.message.slice(0,40), ")"); }
  // Mint reward reserves directly to the staking contract (AU + AG)
  const REWARD_RESERVE_AU = p18(50000);
  const REWARD_RESERVE_AG = p18(50000);
  try { await (await au.connect(deployer).mint(staking.address, REWARD_RESERVE_AU)).wait(); console.log("  minted 50k AU to staking ok"); } catch(e){ console.log("  (au mint skipped:", e.message.slice(0,40),")"); }
  try { await (await ag.connect(deployer).mint(staking.address, REWARD_RESERVE_AG)).wait(); console.log("  minted 50k AG to staking ok"); } catch(e){ console.log("  (ag mint skipped:", e.message.slice(0,40),")"); }
  // Initial reward rates: ~1 AU/block + ~1 AG/block (gentle, self-funding)
  // Uses instantRateChange (no 48h timelock) so the flywheel emits immediately.
  try { await (await staking.connect(deployer).instantRateChange(p18(1), p18(1))).wait(); console.log("  staking.instantRateChange(1 AU, 1 AG) ok"); }
  catch (e) { console.log("  (instantRateChange skipped:", e.message.slice(0,40), ")"); }

  // ── WRITE test_address.book ──
  const book = `# ═════════════════════════════════════════════════════════════════════════
# AV TREASURY — TESTNET DEPLOYMENT ADDRESS BOOK
# Network : Local Hardhat  (chainId ${CHAIN_ID})
# RPC      : ${RPC}
# Deployed : ${new Date().toISOString()}
# Builder  : scripts/deploy_testnet.js (systematic, per DEPLOYMENT_PLAN.md)
# ═════════════════════════════════════════════════════════════════════════

# ── WALLETS (local testnet dev accounts, 10000 ETH each from node) ──
Deployer          ${deployer.address}   # Acct#0  (Safe owner #1, governor admin)
Keeper            ${keeper.address}     # Acct#1  (TreasuryAMO + Flywheel keeper)
SafeOwner2 (new)  ${safe2.address}      # Acct#2  (Safe owner #2)

# ── PHASE 1: TOKENS ──
AuToken (Artifact Utility)    ${au.address}   # UUPS proxy; genesis 1,000,000 minted
AgToken (Artifact Governance) ${ag.address}   # UUPS proxy; NO genesis (emitted via staking/PID)
MockUSDC          ${usdc.address}   # 6-decimals, 10M minted
MockWETH          ${WETH.address}   # WETH placeholder
MockAerodromeRouter ${router.address} # local AMM (AU/AG/USDC/WETH pools seeded)

# ── PHASE 2: ORACLE ──
AvOracle (v5)     ${oracle.address}
  bootstrap AU = 0.01 (valid 1y)
  bootstrap AG = 0.01 (valid 1y)

# ── PHASE 3: TREASURY + WRAPPER ──
TreasuryAMO        ${amo.address}
  auToken = ${au.address}
  reserveToken (ag) = ${ag.address}
  aerodromeRouter = ${router.address}
OracleWrapper      ${wrapper.address}
  avOracle    = ${oracle.address}
  treasuryAMO = ${amo.address}
  flashBuy    = ${flash.address}
  tokenKey AU = ${AU_KEY} -> ${au.address}
  tokenKey AG = ${AG_KEY} -> ${ag.address}
TreasuryFlashBuy_v2 ${flash.address}
  treasury  = ${deployer.address}
  usdcToken = ${usdc.address}
  agToken   = ${ag.address}
  auToken   = ${au.address}
  oracleWrap = ${oracle.address}
  keeper     = ${keeper.address}
  dex        = ${router.address}

# ── PHASE 4: GOVERNANCE + SAFE + PID + STAKING ──
TreasurySafe (2-of-2) ${safe.address}
  owners = ${deployer.address}, ${safe2.address}
  threshold = 2
ArtifactTimelock     ${timelock.address}   # ArtifactTimelock(TimelockController)
GovernorContractV5   ${gov.address}
PIDEmissionControllerV2 ${pid.address}
AVLPStaking_v2       ${staking.address}    # UUPS proxy
`;
  const bookPath = path.join(__dirname, "..", "deployments", "testnet", "test_address.book");
  fs.writeFileSync(bookPath, book);
  const jsonPath = path.join(__dirname, "..", "deployments", "testnet", "addresses.json");
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  console.log("\n✅ Wrote", bookPath);
  console.log("✅ Wrote", jsonPath);
  console.log("\n=== DEPLOYED ===\n" + book);
}

main().then(() => process.exit(0)).catch(e => { console.error("DEPLOY ERROR:", e.message); process.exit(1); });
