/**
 * analytics/engine.js — AV Treasury Testnet LIVE MARKET SIMULATION + ANALYTICS
 *
 * Runs against the local Hardhat testnet (deployments/testnet/addresses.json).
 * Perpetually drives market activity so the flywheel network "grows as designed":
 *   - Random buy/sell swaps on the mock Aerodrome router (AU/AG/USDC/WETH)
 *   - Triggers TreasuryAMO buyback + TreasuryFlashBuy when price deviates
 *   - Exercises AVLPStaking (stake/unstake) + PID emission
 *   - Granular per-contract / per-function tracking (calls, gas, success/fail)
 *   - Detects failures, logs them, patches nothing (reports for human/agent action)
 *
 * Logs: analytics/log.jsonl (every tx) + analytics/metrics.json (rolling counters)
 * Run:  node deployments/testnet/analytics/engine.js   (Ctrl-C to stop)
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", ".."); // repo root
const ADDR = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/testnet/addresses.json"), "utf8"));
const LOG = path.join(__dirname, "log.jsonl");
const METRICS = path.join(__dirname, "metrics.json");

// Self-contained provider + wallet (does NOT rely on hardhat's injected provider,
// which is torn down when `npx hardhat run` spawns this as a detached node child).
const RPC = process.env.AV_RPC || "http://localhost:8545";
const provider = new hre.ethers.providers.JsonRpcProvider(RPC);
// Hardhat test account #0 private key (deterministic local dev key)
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Keeper = account #1
const KEEPER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const keeper = new hre.ethers.Wallet(KEEPER_KEY, provider);

const p18 = (n) => hre.ethers.utils.parseUnits(n.toString(), 18);
const p6 = (n) => hre.ethers.utils.parseUnits(n.toString(), 6);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Node block.timestamp is AHEAD of real time (Hardhat advances it across runs),
// so deadlines must use the node's clock, not Date.now().
// Cache base timestamp ONCE at startup; compute deadlines from tick to avoid
// per-tick getBlock RPC calls that race with swap txs (causes -32603 corruption).
let BASE_TS = 0;
const nowTs = async () => (await provider.getBlock("latest")).timestamp;

// ── Intelligent keeper (0-drawdown, self-funding arbitrage) ────────────
const { keeperTick } = require("./keeper.js");

// Global RPC mutex — Hardhat's in-process node corrupts responses (-32603) under
// concurrent JSON-RPC load (automine + receipt polling race). Serialize ALL calls.
let _rpcLock = Promise.resolve();
function rpc(fn) {
  const run = _rpcLock.then(() => fn(), () => fn());
  _rpcLock = run.catch(() => {});
  return run;
}
// Retry wrapper for transient JSON-RPC transport errors (-32603 / "processing response" / Nonce).
async function withRetry(fn, label, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      const m = e.message || "";
      const transient = m.includes("processing response") || m.includes("-32603") || m.includes("Nonce") || m.includes("timeout") || m.includes("data=\"0x\"");
      if (!transient || i === tries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

// rolling metrics: contract -> function -> {calls, fails, gas}
let metrics = {};
try { metrics = JSON.parse(fs.readFileSync(METRICS, "utf8")); } catch { }

function record(contract, fn, ok, gas, err) {
  metrics[contract] = metrics[contract] || {};
  const m = metrics[contract][fn] = metrics[contract][fn] || { calls: 0, fails: 0, gas: 0 };
  m.calls++; if (!ok) m.fails++; if (gas) m.gas += gas.toNumber ? gas.toNumber() : Number(gas);
  fs.writeFileSync(METRICS, JSON.stringify(metrics, null, 2));
  const entry = { t: Date.now(), contract, fn, ok, gas: gas ? (gas.toString ? gas.toString() : gas) : 0, err: err ? err.slice(0, 120) : null };
  fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
}

async function main() {
  // Hardhat's deterministic dev mnemonic (accounts #0..#9)
  const MNEMONIC = "test test test test test test test test test test test junk";
  const hd = hre.ethers.utils.HDNode.fromMnemonic(MNEMONIC);
  const derive = (i) => new hre.ethers.Wallet(hd.derivePath(`m/44'/60'/0'/0/${i}`).privateKey, provider);
  const deployer = new hre.ethers.Wallet(DEPLOYER_KEY, provider); // account #0
  // trader pool = accounts #3..#9
  const traders = [3, 4, 5, 6, 7, 8, 9].map(derive);

  const au = await hre.ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", ADDR.AuToken, deployer);
  const ag = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.AgToken, deployer);
  const usdc = await hre.ethers.getContractAt("contracts/av_suite/MockUSDC.sol:MockUSDC", ADDR.MockUSDC, deployer);
  const weth = await hre.ethers.getContractAt("contracts/av_suite/AgToken.sol:AgToken", ADDR.MockWETH, deployer);
  const router = await hre.ethers.getContractAt("contracts/av_suite/MockAerodromeRouter.sol:MockAerodromeRouter", ADDR.MockAerodromeRouter, deployer);
  const amo = await hre.ethers.getContractAt("contracts/av_suite/TreasuryAMO.sol:TreasuryAMO", ADDR.TreasuryAMO, deployer);
  const flash = await hre.ethers.getContractAt("contracts/av_suite/TreasuryFlashBuy_v2.sol:TreasuryFlashBuy_v2", ADDR.TreasuryFlashBuy_v2, deployer);
  const staking = await hre.ethers.getContractAt("contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2", ADDR.AVLPStaking_v2, deployer);
  const lpnft = await hre.ethers.getContractAt("contracts/av_suite/QuasiCrystalLPNFT.sol:QuasiCrystalLPNFT", ADDR.QuasiCrystalLPNFT, deployer);
  const wrapper = await hre.ethers.getContractAt("contracts/av_suite/OracleWrapper.sol:OracleWrapper", ADDR.OracleWrapper, deployer);
  const pid     = await hre.ethers.getContractAt("contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2", ADDR.PIDEmissionControllerV2, deployer);
  // keeper = Acct#1 (the treasury/AMO executor per deploy script)

  // PositionParams struct for LP NFT mint
  const POS = { agReserve: 1000, auReserve: 1000, liquidityAmount: 1000, volume24h: 0, volatilityIndex: 1, liquidityDepth: 1, timeHeld: 0, openedAt: 0 };

  const tokens = { AU: au, AG: ag, USDC: usdc, WETH: weth };
  const ERC20 = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)", "function mint(address,uint256)"];

  console.log(`[engine] started. Traders=${traders.length}. Logging to ${LOG}`);
  // startup diagnostics
  const net = await provider.getNetwork();
  const blk = await provider.getBlockNumber();
  console.log(`[diag] network chainId=${net.chainId} block=${blk}`);
  for (const [k, a] of Object.entries(ADDR)) {
    if (typeof a !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(a)) continue;
    const code = await provider.getCode(a);
    if (code.length <= 10) console.log(`[diag] !! NO CODE at ${k} = ${a}`);
  }
  try {
    const AUk = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
    const [pa] = await wrapper.getOraclePrice(AUk);
    console.log(`[diag] getOraclePrice(AU)=${hre.ethers.utils.formatUnits(pa,18)} OK`);
  } catch (e) { console.log(`[diag] getOraclePrice FAIL:`, e.message.slice(0,200)); }
  BASE_TS = (await provider.getBlock("latest")).timestamp; // single getBlock at startup
  console.log(`[diag] baseTs=${BASE_TS}`);
  let tick = 0;
  let lastAmoCallTs = 0; // in-memory cooldown tracker (avoids stale on-chain reads under interval mining)
  const MINTER = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("MINTER_ROLE"));

  while (true) {
    tick++;
    try {
      const ts = BASE_TS + tick * 2; // deterministic deadline from cached base ts (no per-tick getBlock)
      const trader = traders[tick % traders.length];
      const r = Math.random();

      if (r < 0.55) {
        // ── MARKET SWAP: buy or sell AU/AG via router ──
        const buy = Math.random() < 0.5;
        const which = Math.random() < 0.5 ? "AU" : "AG";
        const pay = which === "AU" ? au : ag;
        const quote = Math.random() < 0.5 ? usdc : weth;
        const quoteIsUsdc = quote === usdc;
        // input token: BUY -> quote (USDC/WETH), SELL -> pay (AU/AG, always 18dp)
        const inputToken = buy ? quote : pay;
        const inputIsUsdc = buy && quoteIsUsdc;
        // input amount in the INPUT token's decimals
        const amt = inputIsUsdc ? p6(Math.floor(Math.random() * 5000) + 100) : p18(Math.floor(Math.random() * 5) + 1);
        const path = buy ? [quote.address, pay.address] : [pay.address, quote.address];
        const inputAmt = amt;
        try {
          if ((await rpc(() => inputToken.balanceOf(trader.address))).lt(inputAmt)) {
            // Mint the token actually being spent (inputToken), not quote-based.
            const topUp = inputToken === usdc ? p6(200000) : p18(200000);
            await rpc(() => inputToken.connect(deployer).mint(trader.address, topUp).then(t => t.wait()));
          }
          await rpc(() => inputToken.connect(trader).approve(router.address, inputAmt).then(t => t.wait()));
          const out = await rpc(() => router.connect(trader).swapExactTokensForTokens(inputAmt, 0, path, trader.address, ts + 600));
          const rc = await rpc(() => out.wait());
          record("MockAerodromeRouter", buy ? `swapBuy(${which})` : `swapSell(${which})`, true, rc.gasUsed);
        } catch (e) {
          if (!global.__swapDiag) {
            global.__swapDiag = true;
            const c0 = await provider.getCode(path[0]); const c1 = await provider.getCode(path[1]);
            console.log(`[diag swap] path0=${path[0]} code=${c0.length} path1=${path[1]} code=${c1.length} inputToken=${inputToken.address} code=${(await provider.getCode(inputToken.address)).length} router=${router.address} code=${(await provider.getCode(router.address)).length}`);
          }
          record("MockAerodromeRouter", buy ? `swapBuy(${which})` : `swapSell(${which})`, false, 0, e.message);
        }
      } else if (r < 0.72) {
        // ── MINT LP NFT + STAKE (flywheel participation) ──
        try {
          const before = await rpc(() => lpnft.totalSupply());
          await rpc(() => lpnft.connect(deployer).mint(trader.address, POS).then(t => t.wait()));
          const after = await rpc(() => lpnft.totalSupply());
          const tokenId = after.sub(1);
          await rpc(() => lpnft.connect(trader).approve(staking.address, tokenId).then(t => t.wait()));
          const tx = await rpc(() => staking.connect(trader).stake(tokenId, 100));
          const rc = await rpc(() => tx.wait());
          record("AVLPStaking_v2", "stake", true, rc.gasUsed);
        } catch (e) { record("AVLPStaking_v2", "stake", false, 0, e.message); }
      } else if (r < 0.85) {
        // ── TREASURY AMO BUYBACK (deployer has EXECUTOR_ROLE) ──
        // executeBuyback(reserveAmount, minAuOut, useAerodrome, deadline)
        // FIX: compute the LIVE per-epoch cap = currentReserve * maxBuybackPerEpochBps / 10000
        // (the old hardcoded 20k AG blew past the 5% cap once reserve dropped,
        //  causing ExceedsEpochCap — 94% of calls reverted). Use 95% of cap for headroom.
        try {
          const [reserveBal, bps] = await Promise.all([
            rpc(() => amo.getReserveBalance()),
            rpc(() => amo.maxBuybackPerEpochBps())
          ]);
          const cap = reserveBal.mul(bps).div(10000);   // 5% of current reserve
          const reserveAmt = cap.mul(95).div(100);      // 95% of cap (headroom)
          if (reserveAmt.lte(0)) { record("TreasuryAMO", "executeBuyback(skip)", true, 0); }
          else {
            // In-memory cooldown tracker: avoids stale on-chain reads under
            // interval mining (block timestamps lag, causing respectsCooldown reverts).
            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec - lastAmoCallTs < 65) { // 60s on-chain cooldown + 5s buffer
              record("TreasuryAMO", "executeBuyback(skip-cooldown)", true, 0);
            } else {
              const tx = await rpc(() => amo.connect(deployer).executeBuyback(reserveAmt, 0, true, ts + 3600));
              const rc = await rpc(() => tx.wait());
              lastAmoCallTs = Math.floor(Date.now() / 1000);
              record("TreasuryAMO", "executeBuyback", true, rc.gasUsed);
            }
          }
        } catch (e) { record("TreasuryAMO", "executeBuyback", false, 0, e.message); }
      } else if (r < 0.95) {
        // ── FLASH BUYBACK (deployer has EXECUTOR_ROLE; gated by shouldBuyback) ──
        try {
          const should = await rpc(() => flash.shouldBuyback());
          if (!should) { record("TreasuryFlashBuy_v2", "shouldBuyback(skip)", true, 0); }
          else {
            // executeBuyback(usdcAmount, minAgMinimum, dexData=full router calldata)
            const dl = ts + 600;
            const dexData = router.interface.encodeFunctionData("swapExactTokensForTokens", [p6(500), 0, [usdc.address, ag.address], flash.address, dl]);
            const tx = await rpc(() => flash.connect(deployer).executeBuyback(p6(500), 0, dexData));
            const rc = await rpc(() => tx.wait());
            record("TreasuryFlashBuy_v2", "executeBuyback", true, rc.gasUsed);
          }
        } catch (e) { record("TreasuryFlashBuy_v2", "executeBuyback", false, 0, e.message); }
      } else {
        // ── ORACLE PRICE CHECK (sanity, every 10th tick to limit RPC load) ──
        if (tick % 10 === 0) {
          try {
            const AUk = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
            const AGk = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AG"));
            const [pa] = await rpc(() => wrapper.getOraclePrice(AUk));
            const [pg] = await rpc(() => wrapper.getOraclePrice(AGk));
            record("OracleWrapper", "getOraclePrice", true, 0);
            if (tick % 20 === 0) console.log(`[tick ${tick}] AU=${hre.ethers.utils.formatUnits(pa,18)} AG=${hre.ethers.utils.formatUnits(pg,18)}`);
          } catch (e) { record("OracleWrapper", "getOraclePrice", false, 0, e.message); }
        }
      }

      // ── INTELLIGENT KEEPER: 0-drawdown arbitrage (buys AU below fair) ──
      // Runs EVERY tick (independent of the random market-action branch above)
      // so the keeper is always watching for discount opportunities.
      const kctx = {
        rpc, log: record, signers: { keeper },
        ADDR, contracts: { router, amo, au, ag, oracle: wrapper, provider }
      };
      const kres = await keeperTick(kctx);
      if (kres.acted) console.log(`  [keeper] ${kres.note} | profit~${kres.profitAG.toFixed(2)}AG gas~${kres.gasCostAG.toFixed(4)}AG`);
      else if (tick % 5 === 0) console.log(`  [keeper] skip: ${kres.note}`);

      // ── FEED THE FLYWHEEL: PID self-tunes emission rates every 20 ticks ──
      if (tick % 20 === 0) {
        try {
          const tx = await rpc(() => pid.connect(deployer).executeEmission());
          const rc = await rpc(() => tx.wait());
          record("PID_Emission", "executeEmission", true, rc.gasUsed);
          const auRate = await rpc(() => staking.auRewardPerBlock());
          const agRate = await rpc(() => staking.agRewardPerBlock());
          console.log(`  [pid] executeEmission ok | auRate=${hre.ethers.utils.formatUnits(auRate,18)} agRate=${hre.ethers.utils.formatUnits(agRate,18)}`);
        } catch (e) { record("PID_Emission", "executeEmission", false, 0, e.message); }
      }
    } catch (e) {
      console.log(`[tick ${tick}] OUTER ERR:`, e.message.slice(0, 100));
    }

    if (tick % 50 === 0) {
      const totalCalls = Object.values(metrics).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b.calls, 0), 0);
      const totalFails = Object.values(metrics).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b.fails, 0), 0);
      console.log(`[tick ${tick}] totalCalls=${totalCalls} totalFails=${totalFails}`);
    }
    await sleep(3000); // ~0.33 tx/sec — gentle pace to avoid node RPC overload
  }
}
main().catch(e => { console.error("ENGINE FATAL:", e.message); process.exit(1); });
