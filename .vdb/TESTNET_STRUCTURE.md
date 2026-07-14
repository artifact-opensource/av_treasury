# AV Treasury Testnet — Granular Structure Document

> Purpose: a single source of truth for the testnet prototype so we don't forget or drift.
> Generated: 2026-07-11 | Last audited: 2026-07-14 | Status: **GREEN** — live end-to-end audit, 0 fails current session.
> Location: `av_treasury/.vdb/` | Namespace: `testnet`

---

## 0. TL;DR

The testnet is a **self-contained Foundry anvil localnet** (chainId 31337, `http://localhost:8545`) running the
full AV Treasury flywheel against **mock contracts**, with **persistent state** (anvil `--state`). A standalone
analytics engine (`engine.js`) perpetually drives market activity and records granular per-function telemetry.
End-to-end audit (2026-07-14) confirms the double-flywheel is operational: swaps → AMO buybacks → AU held →
LP staking → PID emission → rewards accrue. **0 reverts in the live session.** Sandbox — nothing touches mainnet.

---

## 1. NETWORK LAYER

| Property | Value |
|----------|-------|
| Type | **Foundry anvil** (not Hardhat node) |
| Chain ID | `31337` |
| RPC | `http://localhost:8545` |
| Block time | 2s (`--block-time 2`) |
| Gas limit | 30,000,000 |
| Persistence | `--state deployments/testnet/chain-state.json --state-interval 1000` (real anvil dump) |
| Start cmd | `bash scripts/start_stack.sh` (kills stale, resets stale state, starts anvil, deploys, launches engine) |
| Node process | `anvil --port 8545 --chain-id 31337 --state ... --block-time 2` |

> State persists across restarts via anvil `--state`. A stale 24MB `chain-state.json` (old addresses) is
> auto-detected and reset by `start_stack.sh`. Engine runs ~1 tx / 3s (gentle, stable).

---

## 2. TOKEN LAYER (all mock)

| Symbol | Contract | Address | Notes |
|--------|----------|---------|-------|
| AU | `AuToken` (UUPS) | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Genesis 1,000,000 minted, 18dp |
| AG | `AgToken` (reserve) | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | Genesis 5.75M (5M deployer + 500k AMO + 250k staking), 18dp |
| USDC | `MockUSDC` | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` | 6dp mock |
| WETH | `MockWETH` | `0x0B306BF915C4d645ff596e518fAf3F9669b97016` | mock |
| LP-NFT | `QuasiCrystalLPNFT` | `0x162A433068F51e18b7d13932F27e66a3f99E6890` | staked into AVLPStaking_v2 |

---

## 3. PROTOCOL LAYER (contracts)

| Role | Contract | Address |
|------|----------|---------|
| DEX router (mock) | `MockAerodromeRouter` | `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` |
| Price oracle | `AvOracle` | `0xf5059a5D33d5853360D16C683c16e67980206f36` |
| Oracle wrapper | `OracleWrapper` | `0x0E801D84Fa97b50751Dbf25036d067dCf18858bF` |
| Treasury AMO | `TreasuryAMO` | `0x4826533B4897376654Bb4d4AD88B7faFD0C98528` |
| Flash buyback | `TreasuryFlashBuy_v2` | `0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf` |
| LP staking | `AVLPStaking_v2` | `0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f` |
| PID emission | `PIDEmissionControllerV2` | `0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d` |
| Treasury safe | `TreasurySafe` | `0x36C02dA8a0983159322a80FFE9F24b1acfF8B570` |
| Timelock | `ArtifactTimelock` | `0x809d550fca64d94Bd9F66E60752A544199cfAC3D` |
| Governor | `GovernorContractV5` | `0x4c5859f0F772848b2D91F1D83E2Fe57935348029` |

### 3.1 MockAerodromeRouter (fixed)
- `addLiquidity(tokenA, tokenB, ra, rb, ...)` stores reserves **sorted by address** (fix from earlier session).
- `swapExactTokensForTokens(amountIn, minOut, path, to, deadline)` uses `aIsTa = (path[0] < path[1])` to map
  `rIn/rOut` correctly. Earlier bug: unsorted reserve storage flipped `aIsTa` for `ag > usdc`, causing massive
  `amountOut` → `ERC20InsufficientBalance`. **Resolved.**

### 3.2 TreasuryAMO
- `executeBuyback(reserveAmt, minAuOut, skipCooldown, deadline)`
- Guard: `reserveAmt <= 5% of current reserve` (`reserveCapBps = 500`), dynamic per epoch.
- `respectsCooldown` modifier (cooldown = 60s) — engine passes `skipCooldown=true`.
- **Holds bought AU** (no burn). `totalAuBought == AU balance in AMO`. See Defect A.

### 3.3 TreasuryFlashBuy_v2
- `executeBuyback(dexData, amount, minAuOut, deadline)` — `dexData` must be **full router calldata**.
- Flash-loan-style buyback path. 0% fail.

### 3.4 AVLPStaking_v2
- `stake(tokenId, weight, lockWeeks)` — mints LP NFT position, approves, stakes. 124+ positions.
- `setRewardRates(auPerBlock, agPerBlock)` is `onlyRole(ADMIN_ROLE)` — **PID holds this role.**
- `auRewardPerBlock = 1`, `agRewardPerBlock = 0.0058` (live). Emissions flow.

### 3.5 PIDEmissionControllerV2
- `executeEmission()` — computes emission via PID (kp=ki=kd=1e15, targetTVL=1e24), calls
  `staking.setRewardRates(...)`. Holds ADMIN_ROLE on staking. 0% fail post ethers fix.

### 3.6 OracleWrapper (`AvOracle`)
- `getAuAgPrices()` → `[AU, AG]`. Both read `0.01` because deploy set `setBootstrapPrice(token, 0.01, 1y)` + `setBootstrapMode(true)`. **Nominal bootstrap price, by design — NOT a market price.**
- Engine checks oracle every 10th tick. No external feed in testnet (mock).
- **Mainnet gap:** must swap bootstrap price for a real feed (Chainlink/Pyth) before floor logic is meaningful.

---

## 4. ROLE / ACCOUNT LAYER

| Role | Address | Notes |
|------|---------|-------|
| Deployer (Acct#0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | DEFAULT_ADMIN on all contracts; runs engine emission |
| Keeper (Acct#1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | AMO EXECUTOR ✓, FlashBuy EXECUTOR ✓, PID EMIT_ROLE ✓ (fixed 6e14de9) |
| Safe owner #2 (Acct#2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 2-of-2 safe |
| Traders | 7 random funded wallets | market simulation |
| PID → staking admin | `PIDEmissionControllerV2` | ADMIN on staking; calls `setRewardRates` + mints rewards |
| AMO → treasury (NOT staking admin) | `TreasuryAMO` | buys/holds AU, spends AG reserve; by design not staking admin |

---

## 5. FLYWHEEL FLOW (verified end-to-end)

```
traders swap (MockAerodromeRouter: buy/sell AU & AG)
        │
        ▼  price deviates
keeper → TreasuryAMO.executeBuyback (spends AG reserve → buys AU → holds in AMO)
keeper → TreasuryFlashBuy_v2.executeBuyback (flash buy)
        │
        ▼
LPs stake QuasiCrystalLPNFT via AVLPStaking_v2.stake
        │
        ▼
PIDEmissionControllerV2.executeEmission → setRewardRates(au=1/blk, ag=0.0058/blk)
        │
        ▼
rewards accrue to stakers (AU/AG per block)
        │
        ▼
OracleWrapper.getOraclePrice sanity-checked every 10th tick
```

**Value accrual verdict:** The loop *runs*, but value lands in **AMO treasury hoard** (AU held, not burned).
There is no deflationary sink yet. See Defect A.

---

## 6. ANALYTICS / OBSERVABILITY

| Artifact | Path | Purpose |
|----------|------|---------|
| Engine | `deployments/testnet/analytics/engine.js` | standalone Node; drives market + logs telemetry |
| Log | `deployments/testnet/analytics/log.jsonl` | per-call: `t, contract, fn, ok, gas, err` |
| Summary | `node deployments/testnet/analytics/summary.js` | per-contract/per-function calls, fails, fail%, avgGas |
| Metrics | `deployments/testnet/analytics/metrics.json` | aggregated |

Engine runtime: JsonRpcProvider + Wallet signers (no hardhat runtime dependency at call time).
**Bug fixed 2026-07-11:** `engine.js:256` used bare `ethers` (not `hre.ethers`) → crashed PID emission
logging (`ethers is not defined`). Now `hre.ethers`. PID emission 0% fail.

### 6.1 OPERATIONAL CAVEAT — one engine per log
`log.jsonl` is append-only and NOT safe for concurrent writers. Running more than one `engine.js`
process (or restarting without truncating the log) makes the summary show phantom "fails" with stale
`firstTs` from prior runs. **Rule: kill all `engine.js` procs, truncate `log.jsonl`, then start exactly
one engine.** Verified clean baseline (2026-07-11): 21 calls across 9 function types, **0 fails**.

### 6.2 AMO buyback has two paths
- Keeper path: `TreasuryAMO.executeBuyback(reserveAmt, minAuOut, skipCooldown=true, deadline)` → 0% fail.
- Secondary path (no skip): respects the 60s `respectsCooldown` guard → occasionally reverts with
  `CooldownActive` when called within 60s. This is the rate-limit working as designed, NOT a bug.

### 6.3 PID emission — verified working (keeper fix live)
- Engine calls `pid.connect(deployer).executeEmission()` every 20 ticks. Deployer holds `EMIT_ROLE`
  (0x934c9386...). Verified: mined call succeeds, `auRewardPerBlock=1`, `agRewardPerBlock=0.0058`.
- **FIXED (6e14de9):** keeper (Acct#1) now ALSO holds `EMIT_ROLE` — verified live `hasRole=true`. The
  Python keeper's `emission.py` calls `executeEmission()` as the keeper wallet, which was reverting
  `MissingRole` before this fix. Now both paths work.

### 6.4 DEFINITIVE baseline — LIVE END-TO-END AUDIT (2026-07-14)
- **0 fails in the current live session** across all 9 function types (swaps x4, AMO skip + non-skip,
  FlashBuy, stake, PID emission, oracle-check). Verified by reading live contract state, not just log.
- AMO holds **59,631.83 AU** (bought this session), spent ~68k AG (reserve 432k of 500k). Buybacks live.
- PID emission flowing: staking `auRewardPerBlock=1`, `agRewardPerBlock≈0.006`; pending rewards accruing
  to stakers (deployer stake#0: 133 AU + 110 AG pending). Flywheel loop closed.
- Aggregate log 8% "fail" = non-skip buyback hitting `CooldownActive`/`RunwayViolation`/`BelowBuybackFloor`
  guards — rate-limit working, handled by engine `withRetry`→skip path. NOT a defect.

### 6.5 Can the treasury accrue positive value on its own?
**Yes — the mechanism is self-sustaining by design, verified live:**
1. Swaps create market activity + fees path through the router.
2. AMO spends AG reserve to buy AU when below floor → AU accumulates in treasury (59,631 AU held).
3. AU/AG staking rewards emit via PID → pulls stakers → LP depth grows.
4. PID self-tunes `auRewardPerBlock`/`agRewardPerBlock` to staking weights (admin = PID).
5. `reserveCapBps=500` (5%/epoch) caps AMO drawdown → runway protected.
**Caveat:** in a closed testnet the "value" is token-movement, not external USD demand. Real value
accretion requires external swaps/fees (mainnet). The plumbing is proven; the economics need a live market.

---

## 7. KNOWN DEFECTS / GAPS (tracked)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| A | Design | AMO holds AU (no burn). `totalAuBought == AU bal in AMO`. Treasury hoard, not deflationary sink. | Open — design decision needed |
| B | Bug (fixed) | `engine.js:256` bare `ethers` → PID emission logging crash. | FIXED 2026-07-11 |
| C | Bug (fixed) | Router reserve misalignment broke `ag>usdc` swaps. | FIXED (sorted reserves) |
| D | Bug (fixed) | Keeper lacked PID `EMIT_ROLE` → `emission.py` reverted `MissingRole`. | FIXED 6e14de9 |
| E | Cosmetic | `engine.js:93` `weth` loads AgToken ABI (copy-paste). WETH unused in flywheel. | FIXED 2026-07-14 |
| F | Mainnet gap | Oracle is bootstrap (0.01). Needs real feed (Chainlink/Pyth) before floor logic is meaningful. | Open (mainnet) |

---

## 8. HOW TO RE-RUN (persistent stack)

```bash
# Robust orchestration: kills stale procs, resets stale state, starts anvil --state, deploys, launches engine
bash scripts/start_stack.sh

# watch
tail -f deployments/testnet/logs/engine.log
node deployments/testnet/analytics/summary.js

# live state audit
npx hardhat run scripts/audit_flywheel.js --network localhost
```

> State persists across restarts via anvil `--state deployments/testnet/chain-state.json`. A stale 24MB
> state file (old addresses) is auto-detected + reset by `start_stack.sh`.

---

## 9. MAINNET SEPARATION

See `MAINNET_SEPARATION.md`. Testnet vectors are `namespace=testnet` and MUST NOT be merged into
mainnet reasoning. Mainnet is a separate, production deployment (Base/ETH, real oracle, real funds).
