# Keeper Bot — Base Mainnet Deployment

**Deployed:** 2026-06-29 17:14 UTC  
**Host:** dragonfly (Base mainnet)  
**Status:** ✅ LIVE — Running via `deploy_keeper.sh`

## Architecture

```
KeeperBot (main.py)
├── Warden (warden.py) — Threat detection & defense
├── Strategy (strategy.py) — TWAP entries, momentum, volatility sizing
├── MEV Coordinator (mev.py) — Flashbots bundles, mempool monitoring
├── Governor (governor.py) — Emergency governance proposals
├── BuybackKeeper (buyback.py) — FlashBuy execution (warden-gated)
├── OracleKeeper (oracle.py) — Price feed maintenance
├── EmissionKeeper (emission.py) — PID-controlled Ag emissions
└── HealthMonitor (health.py) — System health & balance alerts
```

## Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Chain | Base Mainnet (8453) | config.py |
| RPC | https://mainnet.base.org | .env |
| Keeper Wallet | 0xc63B...7555 | .env |
| Manual Au Price | $1.00 | config.py (env: AU_PRICE_MANUAL) |
| Manual Ag Price | $0.10 | config.py (env: AG_PRICE_MANUAL) |
| Tick Interval | 30s | main.py |
| TWAP Chunks | 4 | strategy.py |
| Chunk Interval | 6 blocks (~12s) | strategy.py |

## Price Feed Status

| Source | Au | Ag | Notes |
|--------|----|----|-------|
| AvOracle v5 (on-chain) | ❌ No data | ❌ No data | No price sources configured |
| DEXScreener | ❌ No pairs | ❌ No pairs | No DEX liquidity on Base |
| CoinGecko | ❌ Not tracked | ❌ Not tracked | Tokens not listed |
| **Manual fallback** | ✅ $1.00 | ✅ $0.10 | Config override |

**Resolution path:** Once DEX liquidity is added to Base (Uniswap V3 pool), the oracle will automatically pick up TWAP prices and manual fallback will be bypassed.

## Deployment

```bash
# Deploy/update keeper
bash deploy_keeper.sh

# Check status
python3 -m keeper.main status

# View live logs
tail -f /opt/ava/logs/keeper/keeper.log

# Stop keeper
kill $(cat /opt/ava/keeper.pid)
```

## Known Issues (Expected)

| Issue | Cause | Resolution |
|-------|-------|------------|
| Emission errors | TreasuryAMO not deployed (0 bytes at address) | Deploy TreasuryAMO + PID |
| Oracle update reverts | No price feeds configured on-chain | Add DEX liquidity or configure Chainlink |
| Buyback reverts | FlashBuy needs valid oracle price | Auto-resolves when oracle has data |
| Low balance warning | Keeper has 0.0015 ETH | Fund with ~0.01 ETH for sustained operation |

## Contract Status

| Contract | Address | Status |
|----------|---------|--------|
| Au Token | 0x0c5A...2f08 | ✅ Deployed (163 bytes) |
| Ag Token | 0x1D31...3674 | ✅ Deployed (163 bytes) |
| Governor V5 | 0x1Dc5...f0a9 | ✅ Deployed (20KB) |
| Timelock | 0x0905...09Be | ✅ Deployed (6.7KB) |
| AvOracle v5 | 0xfd04...647CD | ✅ Deployed (12KB, no price sources) |
| OracleWrapper | 0xb479...32bdB | ✅ Deployed (4.3KB) |
| OracleFlashBuy | 0xDfD0...DDcc | ✅ Deployed (6.2KB) |
| TreasuryAMO | 0x5665...5188 | ❌ Not deployed (0 bytes) |
| AcousticVault | 0xf638...e65b | ❌ Not deployed (0 bytes) |

## Security

- Keeper uses dedicated hot wallet (NOT deployer)
- `.env` file chmod 600
- Governor has emergency pause capability
- Warden can trigger defensive mode on anomaly detection
- All transactions go through Flashbots (private mempool) when possible

## Next Steps

1. **Fund keeper wallet** — send ~0.01 ETH to 0xc63B...7555
2. **Deploy remaining contracts** — TreasuryAMO, AcousticVault, PIDController
3. **Configure oracle price feeds** — add TWAP pools or Chainlink aggregators
4. **Add DEX liquidity** — create Au/ETH pool on Uniswap V3 Base
5. **Tune parameters** — adjust TWAP size, chunk count, warden thresholds based on live data
6. **Enable full warden** — switch from manual prices to live oracle feeds
