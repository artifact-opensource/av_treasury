# 🧪 Sandbox — Ganache Testnet Environment

## Architecture

```
sandbox/
├── contracts/          # Solidity contracts for sandbox
│   ├── DexSimulator.sol    # UniswapV2-style AMM with one-sided LP
│   └── MockTokens.sol      # agUSD, AVAX, USDC mock ERC20s
├── scripts/
│   ├── start-ganache.sh    # Launch ganache (100 accounts, 1000 ETH each)
│   ├── deploy-sandbox.js   # Deploy all contracts to ganache
│   └── stress-test.js      # 5 stress scenarios
├── bots/
│   └── BotEngine.js        # 100 autonomous trading bots
├── monitoring/
│   └── Dashboard.js        # Real-time metrics dashboard
├── config/
│   ├── accounts.json       # Bot configuration
│   └── deployed.json       # Auto-generated after deploy
└── logs/
    ├── ganache.log         # Ganache output
    ├── bot-metrics.json    # Trading metrics
    └── ganache-db/         # Persistent chain state
```

## Quick Start

```bash
# 1. Start ganache network
bash sandbox/scripts/start-ganache.sh

# 2. Deploy contracts (in another terminal)
node sandbox/scripts/deploy-sandbox.js

# 3. Launch bot engine (in another terminal)
node sandbox/bots/BotEngine.js

# 4. Monitor (in another terminal)
node sandbox/monitoring/Dashboard.js
```

## Stress Test Scenarios

```bash
# Flash crash — mass sell-off
STRESS_MODE=crash node sandbox/scripts/stress-test.js

# Whale squeeze — massive buyback pressure
STRESS_MODE=squeeze node sandbox/scripts/stress-test.js

# Liquidity drain — attempt to drain pool
STRESS_MODE=drain node sandbox/scripts/stress-test.js

# One-sided pressure — Aerodrome-style
STRESS_MODE=onesided node sandbox/scripts/stress-test.js

# Whale manipulation — asymmetric trades
STRESS_MODE=whale node sandbox/scripts/stress-test.js
```

## Bot Personalities

| Personality | Swap Frequency | Size Multiplier | Hold Bias |
|---|---|---|---|
| conservative | 0.3x | 0.3x | 0.8 |
| moderate | 0.6x | 0.6x | 0.5 |
| aggressive | 1.0x | 1.0x | 0.2 |
| whale | 0.1x | 3.0x | 0.9 |
| momentum | 0.9x | 0.8x | 0.3 |
| arbitrageur | 0.4x | 0.5x | 0.7 |

## Safety

- **Fully confined**: Ganache binds to 127.0.0.1 only
- **No external calls**: All contracts are local
- **Deterministic**: Same mnemonic = same addresses every time
- **Monitored**: Dashboard polls every 3 seconds
- **Killable**: `kill $(cat sandbox/logs/ganache.pid)`
