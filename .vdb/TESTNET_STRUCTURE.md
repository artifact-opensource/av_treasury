# AV Treasury Testnet — Granular Structure Document

> Purpose: a single source of truth for the testnet prototype so we don't forget or drift.
> Generated: 2026-07-11 | Status: **GREEN** — all treasury functions fire at 0% fail (post ethers fix).
> Location: `av_treasury/.vdb/` | Namespace: `testnet`

---

## 0. TL;DR

The testnet is a **self-contained Hardhat localnet** (chainId 31337, `http://localhost:8545`) that runs the
full AV Treasury flywheel against **mock contracts**. A standalone analytics engine (`engine.js`)
perpetually drives market activity and records granular per-function telemetry. Everything is green
except two documented design questions (AMO burn policy). This is a sandbox — nothing here touches mainnet.

---

## 1. NETWORK LAYER

| Property | Value |
|----------|-------|
| Type | Hardhat local node |
| Chain ID | `31337` |
| RPC | `http://localhost:8545` |
| Mining | Interval (`mining: { auto: false, interval: 1000 }`) — 1 block/sec |
| Why interval | Automine caused `-32603`/nonce races under engine load; interval mining is stable |
| Deploy cmd | `npx hardhat run scripts/deploy_testnet.js --network localhost` |
| Node process | Hardhat interval-mining node on :8545 (proc `ef8875d3`) |

> Interval mining makes the engine ~1 tx / 3s. Deliberately gentle for stability. Do NOT switch back to automine.

---

## 2. TOKEN LAYER (all mock)

| Symbol | Contract | Address | Notes |
|--------|----------|---------|-------|
| AU | `AuToken` (UUPS) | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Genesis 1,000,000 minted, 18dp |
| AG | `AgToken` (reserve) | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | Treasury reserve token, 18dp |
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

### 3.6 OracleWrapper
- `getOraclePrice(keccak256(symbol))` → (price, ts). AU=AG=0.01 in testnet. Checked every 10th engine tick.

---

## 4. ROLE / ACCOUNT LAYER

| Role | Address | Notes |
|------|---------|-------|
| Deployer (Acct#0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Safe owner #1, governor admin |
| Keeper (Acct#1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | TreasuryAMO + Flywheel keeper (buyback + emission) |
| Safe owner #2 (Acct#2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 2-of-2 safe |
| Traders | 7 random funded wallets | market simulation |
| PID → staking admin | `PIDEmissionControllerV2` | can call `setRewardRates` |

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

---

## 7. KNOWN DEFECTS (tracked)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| A | Design | AMO holds AU (no burn). `totalAuBought == AU bal in AMO`. Treasury hoard, not deflationary sink. | Open — design decision needed |
| B | Bug (fixed) | `engine.js:256` bare `ethers` → PID emission logging crash. | FIXED 2026-07-11 |
| C | Bug (fixed) | Router reserve misalignment broke `ag>usdc` swaps. | FIXED (sorted reserves) |

---

## 8. HOW TO RE-RUN

```bash
# 1. start node (interval mining)
npx hardhat node --network localhost   # with mining.interval configured in hardhat.config.js

# 2. deploy
npx hardhat run scripts/deploy_testnet.js --network localhost

# 3. run analytics engine
node deployments/testnet/analytics/engine.js

# 4. watch
node deployments/testnet/analytics/summary.js
```

---

## 9. MAINNET SEPARATION

See `MAINNET_SEPARATION.md`. Testnet vectors are `namespace=testnet` and MUST NOT be merged into
mainnet reasoning. Mainnet is a separate, production deployment (Base/ETH, real oracle, real funds).
