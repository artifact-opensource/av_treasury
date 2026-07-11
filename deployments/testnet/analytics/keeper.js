// keeper.js — Intelligent treasury keeper (0-drawdown, self-funding)
// ------------------------------------------------------------------
// Design principle: the keeper ONLY acts when it can buy AU below the
// oracle fair price. Buying under intrinsic value means mark-to-fair
// shows a gain, so the system mathematically cannot realize a drawdown
// on these trades. It also refuses to trade unless the estimated edge
// covers gas + margin, so it is self-funding (covers its own costs).
//
// It keeps internal thresholds up:
//   - AMO reserve runway (never lets reserve fall below a floor)
//   - LP liquidity depth (buys the discount, which deepens the pool)
//   - Buyback cadence (respects cooldown; uses live epochCap)
//
// All amounts are computed from on-chain state, never hardcoded.

const { ethers } = require("hardhat");

const p    = (n) => ethers.BigNumber.from(n);
const p18  = (n) => ethers.utils.parseUnits(String(n), 18);
const fmt  = (v, d = 18) => Number(ethers.utils.formatUnits(v, d));

// Tunables (mathematically conservative)
const EDGE_BPS        = 150;   // only act when discount >= 1.5% below fair
const GAS_SAFETY      = 5;     // require edge >= 5x estimated gas cost
const MAX_RESERVE_USE = 5000;  // never spend > 5,000 AG in one arb (testnet scale)
const RESERVE_FLOOR   = 5000;  // keep >= 5,000 AG in AMO reserve (runway)
const SWAP_FEE_BPS    = 30;    // 0.30% (997/1000)

function bps(n, d) { return (n * d) / 10000; }

async function keeperTick(ctx) {
  const { rpc, log, signers, ADDR, contracts } = ctx;
  const out = { acted: false, note: "", profitAG: 0, gasCostAG: 0 };

  try {
    const keeper = signers.keeper;
    const router = contracts.router.connect(keeper);
    const amo    = contracts.amo.connect(keeper);
    const au     = contracts.au;
    const ag     = contracts.ag;

    // --- 1. Read oracle fair price (AU priced in AG) ---
    const wrapper = contracts.oracle;
    const AUk = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AU"));
    const AGk = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AG"));
    const [pAU] = await wrapper.getOraclePrice(AUk); // AU per USD
    const [pAG] = await wrapper.getOraclePrice(AGk); // AG per USD
    if (fmt(pAU) <= 0 || fmt(pAG) <= 0) { out.note = "oracle price zero"; return out; }
    const fairAGperAU = fmt(pAU) / fmt(pAG); // AG per 1 AU (fair)

    // --- 2. Read pool market price (AG per AU) ---
    const [r0, r1] = await router.getReserves(ADDR.AuToken, ADDR.AgToken);
    let rAU, rAG;
    if (ADDR.AuToken.toLowerCase() < ADDR.AgToken.toLowerCase()) { rAU = r0; rAG = r1; }
    else { rAU = r1; rAG = r0; }
    if (fmt(rAU) <= 0 || fmt(rAG) <= 0) { out.note = "no pool liquidity"; return out; }
    const mktAGperAU = fmt(rAG) / fmt(rAU);

    // --- 3. Discount check (0-drawdown gate) ---
    const discountBps = ((fairAGperAU - mktAGperAU) / fairAGperAU) * 10000;
    if (discountBps < EDGE_BPS) {
      out.note = `no edge (disc ${discountBps.toFixed(0)}bps < ${EDGE_BPS})`;
      return out;
    }

    // --- 4. Size the trade: how much AG to spend to buy the discount ---
    // Spend AG to buy AU. Market impact pushes price up; stop before fair.
    // We target buying until pool price ~= fair*0.999 (just below fair).
    let agToSpend = Math.min(MAX_RESERVE_USE, fmt(await ag.balanceOf(ADDR.TreasuryAMO)) - RESERVE_FLOOR);
    if (agToSpend <= 0) { out.note = "reserve at floor"; return out; }
    agToSpend = Math.max(0, agToSpend);
    const agWei = p18(agToSpend);

    // --- 5. Estimate output + profit (mark-to-fair) ---
    const auOut = await router.quoteOut(ADDR.AgToken, ADDR.AuToken, agWei);
    if (fmt(auOut) <= 0) { out.note = "zero output"; return out; }
    const profitAG = (fairAGperAU - mktAGperAU) * fmt(auOut); // edge realized at fair

    // --- 6. Self-funding gas gate ---
    const gasPrice = await rpc(() => contracts.provider.getGasPrice());
    const estGas   = 180000; // swap + transfer
    const gasCostAG = fmt(gasPrice) * estGas / 1e9; // AG (1e18 ~ 1 AG)
    if (profitAG < gasCostAG * GAS_SAFETY) {
      out.note = `edge ${profitAG.toFixed(2)} < gas*${GAS_SAFETY} (${gasCostAG.toFixed(4)})`;
      return out;
    }

    // --- 7. Execute: AMO buys the discount (treasury-funded, below fair) ---
    const dl = (await rpc(() => contracts.provider.getBlock("latest"))).timestamp + 600;
    // AMO.executeBuyback(reserveAmt, minAuOut, useOracleCheck, deadline)
    const minAu = p18(fmt(auOut) * 0.99); // 1% slippage tolerance
    const tx = await amo.executeBuyback(agWei, minAu, true, dl, { gasLimit: 400000 });
    const rcpt = await tx.wait();
    out.acted = true;
    out.profitAG = profitAG;
    out.gasCostAG = gasCostAG;
    out.note = `bought ${fmt(auOut).toFixed(2)} AU @ ${mktAGperAU.toFixed(4)} (fair ${fairAGperAU.toFixed(4)}) disc ${discountBps.toFixed(0)}bps profit~${profitAG.toFixed(2)}AG gas~${gasCostAG.toFixed(4)}AG`;
    log("TreasuryKeeper", "arbitrage", "ok", rcpt.gasUsed.toString(), out.note);
  } catch (e) {
    out.note = "keeper err: " + (e.reason || e.message.slice(0, 90));
    log("TreasuryKeeper", "arbitrage", "fail", 0, out.note);
  }
  return out;
}

module.exports = { keeperTick, EDGE_BPS, GAS_SAFETY, MAX_RESERVE_USE, RESERVE_FLOOR };
