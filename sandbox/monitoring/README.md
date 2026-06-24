# Sandbox Monitoring System

## Overview

The Monitoring System is a comprehensive real-time observability layer for the AV Treasury sandbox environment. It provides four core capabilities:

1. **Analytics Engine** — Collects and computes 30+ metrics from all sandbox contracts at configurable intervals
2. **Dashboard** — Real-time terminal UI with 10 panels, sparklines, and color-coded health indicators
3. **Alert System** — 13 anomaly detection rules with deduplication, cooldown, and severity classification
4. **Reporter** — Automated JSON + Markdown report generation at 6 configurable periods

The system is designed to be portable to mainnet — swap the RPC URL and contract addresses for production deployment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Monitoring System Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │  index.js    │────▶│  Analytics   │────▶│  Dashboard   │        │
│  │  (Orchestr.) │     │  Engine      │     │  (Terminal)  │        │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘        │
│         │                    │                                       │
│         │              ┌─────┴──────┐                                │
│         │              │  ethers.js │                                │
│         │              │  RPC calls │                                │
│         │              └─────┬──────┘                                │
│         │                    │                                       │
│  ┌──────▼───────┐     ┌─────▼────────┐     ┌──────────────┐        │
│  │  Reporter    │     │  Alert       │     │  Sandbox     │        │
│  │  (JSON+MD)   │     │  System      │     │  Contracts   │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Contracts ──RPC──▶ AnalyticsEngine ──events──▶ Dashboard (terminal UI)
                                        ├──events──▶ AlertSystem (anomaly detection)
                                        └──events──▶ Reporter (periodic reports)
```

### Module Responsibilities

| Module | File | Lines | Role |
|--------|------|-------|------|
| Orchestrator | `index.js` | 392 | CLI parsing, lifecycle, graceful shutdown |
| Analytics Engine | `AnalyticsEngine.js` | 670 | Poll contracts, compute metrics, emit events |
| Dashboard | `Dashboard.js` | 564 | Real-time terminal rendering, sparklines |
| Alert System | `AlertSystem.js` | 686 | Anomaly rules, dedup, cooldown, escalation |
| Reporter | `Reporter.js` | 627 | JSON + Markdown reports, auto-pruning |

---

## Quick Start

### Prerequisites

- Node.js ≥ 16
- `ethers.js` (already in `node_modules` from Hardhat)
- Access to a local Anvil node or Ethereum RPC endpoint

### Installation

```bash
cd /home/adam/workspace/av_treasury
npm install  # if not already done
```

### Basic Usage

```bash
# Full monitoring (dashboard + alerts + reports)
node sandbox/monitoring/index.js

# Custom interval (10 seconds)
node sandbox/monitoring/index.js --interval 10000

# Dashboard only (no alerts or reports)
node sandbox/monitoring/index.js --alerts false --report false

# Export data and exit
node sandbox/monitoring/index.js --export ./snapshot.json

# Quiet mode (no terminal UI, alerts only)
node sandbox/monitoring/index.js --quiet

# Collect 100 data points then stop
node sandbox/monitoring/index.js --history 100
```

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--interval <ms>` | `5000` | Data collection polling interval in milliseconds |
| `--dashboard` | `true` | Enable terminal dashboard |
| `--alerts` | `true` | Enable alert system |
| `--report` | `true` | Enable periodic report generation |
| `--report-periods <p>` | `5min,1hr,24hr` | Comma-separated report periods |
| `--export <path>` | `null` | Export latest data as JSON to path and exit |
| `--history <n>` | `null` (unlimited) | Number of data points to collect |
| `--refresh <ms>` | `2000` | Dashboard screen refresh interval |
| `--quiet` | `false` | Suppress dashboard output (headless mode) |

---

## Module Reference

### AnalyticsEngine

The data collection backbone. Polls all sandbox contracts via `ethers.js` at the configured interval and computes derived metrics.

**Key Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `Promise<void>` | Begins polling loop |
| `stop()` | `void` | Stops polling |
| `getLatest()` | `Snapshot` | Most recent data point |
| `getHistory(n)` | `Snapshot[]` | Last N data points |
| `getStats()` | `AggregateStats` | Aggregate statistics over collection period |

**Data Point Structure:**

```javascript
{
  timestamp: 1719123456789,
  blockNumber: 12345678,
  au: {
    totalSupply: "1000000000000000000000000",
    burned: "50000000000000000000000",
    feeRate: 9,  // basis points
    price: "1000000000000000000"  // 1 ETH in wei
  },
  ag: {
    totalSupply: "5000000000000000000000000",
    minted: "100000000000000000000000",
    price: "600000000000000000"  // 0.6 ETH
  },
  dex: {
    reserveA: "100000000000000000000000",
    reserveB: "500000000000000000000000",
    k: "50000000000000000000000000000000000000000",
    price: "166666666666666666",
    volume: "12345678901234567890",
    feeAccumulated: "123456789012345678"
  },
  staking: {
    totalStaked: "800000000000000000000000",
    stakerCount: 42,
    apy: "240000000000000000",  // 24% in wei
    avgMultiplier: 180,
    stakingRatio: "800000000000000000"  // 80%
  },
  pid: {
    error: "50000000000000000",  // 5%
    integral: "1234567890123456789",
    emissionRate: "1000000000000000000",
    dailyCapUsed: "300000000000000000",  // 30%
    targetTVL: "1000000000000000000000000"
  },
  treasury: {
    balance: "50000000000000000000000",
    runwayMonths: 24,
    buybackCapacity: "10000000000000000000000",
    totalBuybacks: "500000000000000000000",
    totalMints: "200000000000000000000000"
  },
  bots: {
    active: 95,
    trades: 1234,
    volumeByType: { buy: 600, sell: 400, stake: 150, unstake: 84 },
    personalityDistribution: { conservative: 30, aggressive: 40, liquidity: 30 }
  },
  system: {
    healthScore: 87,  // 0-100
    anomalies: []
  }
}
```

**Configuration:**

```javascript
const engine = new AnalyticsEngine({
  rpcUrl: 'http://localhost:8545',
  contractAddresses: {
    auToken: '0x...',
    agToken: '0x...',
    dex: '0x...',
    staking: '0x...',
    pidController: '0x...',
    treasuryAMO: '0x...',
    sandboxLP: '0x...',
    governor: '0x...'
  },
  pollInterval: 5000,
  maxHistory: 1000
});
```

---

### Dashboard

Real-time terminal UI that renders data from the AnalyticsEngine. Uses `chalk` for colors and `readline` for cursor management.

**Panels:**

| Panel | Metrics Shown | Refresh |
|-------|---------------|---------|
| System Health | Score (0-100), trend, status | 2s |
| Au Token | Supply, burned, fee, price | 2s |
| Ag Token | Supply, minted, price | 2s |
| DEX | Reserves, K, price, volume, slippage | 2s |
| Staking | TVL, APY, multiplier, participation | 2s |
| PID Controller | Error, integral, emission, cap | 2s |
| Treasury | Balance, runway, buyback capacity | 2s |
| Bot Activity | Active bots, trades, personality mix | 2s |
| Alerts | Last 5 alerts with timestamps | 2s |
| Performance | Engine latency, memory usage | 2s |

**Color Coding:**

- 🟢 **Green** — Healthy / above threshold
- 🟡 **Yellow** — Warning / approaching threshold
- 🔴 **Red** — Critical / threshold breached
- 🔵 **Cyan** — Informational / headers

**Sparkline Trends:**

Each numeric metric includes a 20-character sparkline showing the last 20 data points, giving instant visual trend indication without needing to scan raw numbers.

---

### Alert System

Anomaly detection with 13 rules, deduplication, and cooldown management.

**Alert Rules:**

| ID | Rule | Default Threshold | Severity | Cooldown |
|----|------|-------------------|----------|----------|
| `AU_PRICE_DROP` | Au price drops X% in Y minutes | 10% / 5min | CRITICAL | 60s |
| `AG_PRICE_DROP` | Ag price drops X% in Y minutes | 15% / 5min | CRITICAL | 60s |
| `TVL_DROP` | TVL drops X% in Y minutes | 20% / 10min | HIGH | 120s |
| `TREASURY_DEPLETED` | Treasury below X months runway | 6 months | CRITICAL | 300s |
| `PID_ERROR_SPIKE` | PID error exceeds X% for Y blocks | 5% / 10 blocks | HIGH | 120s |
| `PID_EMISSION_EXHAUSTED` | Daily emission cap > X% | 90% | MEDIUM | 300s |
| `DEX_SLIPPAGE_HIGH` | Swap slippage exceeds X% | 5% | MEDIUM | 60s |
| `STAKING_CENTRALIZED` | Gini coefficient > X | 0.8 | HIGH | 600s |
| `BOT_VOLUME_ANOMALY` | Bot trade volume > X× normal | 3× | LOW | 120s |
| `DEX_LOW_LIQUIDITY` | DEX reserves below X ETH | 10 ETH | HIGH | 300s |
| `STAKING_APY_ANOMALY` | APY outside X-Y% range | 5-50% | MEDIUM | 300s |
| `CONTRACT_ERROR` | Contract call fails | any | CRITICAL | 30s |
| `HEALTH_DROP` | System health drops below X | 50 | HIGH | 120s |

**Alert Structure:**

```javascript
{
  id: 'AU_PRICE_DROP',
  type: 'AU_PRICE_DROP',
  severity: 'CRITICAL',
  message: 'Au price dropped 12.5% in 5 minutes (0.95 → 0.83)',
  timestamp: 1719123456789,
  data: { priceBefore: '...', priceAfter: '...', changePercent: -12.5 },
  acknowledged: false
}
```

**Severity Levels:**

- **CRITICAL** (3) — Immediate action required, potential system failure
- **HIGH** (2) — Urgent attention needed, significant deviation
- **MEDIUM** (1) — Notable anomaly, monitor closely
- **LOW** (0) — Informational, no immediate action

**Deduplication:**

Alerts of the same type are suppressed during their cooldown period. The cooldown resets only when the underlying condition clears and re-triggers.

**Custom Rules:**

```javascript
alertSystem.addRule({
  id: 'MY_CUSTOM_RULE',
  check: (current, history, stats) => {
    return current.au.price < stats.au.priceAvg * 0.5;
  },
  severity: 'HIGH',
  message: 'Au price below 50% of average',
  cooldown: 300000  // 5 minutes
});
```

---

### Reporter

Generates structured reports in both JSON and Markdown formats at configurable intervals.

**Report Periods:**

| Period | Interval | Use Case |
|--------|----------|----------|
| `1min` | 60 seconds | High-frequency debugging |
| `5min` | 5 minutes | Active monitoring |
| `15min` | 15 minutes | Standard observation |
| `1hr` | 1 hour | Hourly summaries |
| `6hr` | 6 hours | Shift-based monitoring |
| `24hr` | 24 hours | Daily reports |

**Report Sections:**

1. **Executive Summary** — Health score, key metrics, anomalies count
2. **System Health Trend** — Min/avg/max health over period
3. **Token Performance** — Au/Ag price, supply changes, burn/mint totals
4. **DEX Activity** — Volume, liquidity changes, fees accumulated
5. **Staking Metrics** — TVL change, APY average, participation rate
6. **PID Controller** — Error average, emission utilization, target tracking
7. **Treasury Health** — Balance change, runway, buybacks executed
8. **Bot Activity** — Trades by type, volume breakdown, personality distribution
9. **Alerts Fired** — All alerts during period, grouped by type
10. **Anomalies Detected** — Unusual patterns identified

**Output Files:**

```
sandbox/reports/
├── 5min/
│   ├── report-2024-06-24-10-00.json
│   ├── report-2024-06-24-10-00.md
│   ├── report-2024-06-24-10-05.json
│   └── ...
├── 1hr/
│   ├── report-2024-06-24-10-00.json
│   └── ...
└── 24hr/
    ├── report-2024-06-23.json
    └── ...
```

**JSON Report Structure:**

```json
{
  "period": "5min",
  "generatedAt": "2024-06-24T10:00:00Z",
  "dataPoints": 60,
  "summary": {
    "healthScore": { "min": 82, "avg": 88, "max": 94 },
    "alertsFired": 3,
    "anomaliesDetected": 1
  },
  "sections": {
    "tokens": { "au": { ... }, "ag": { ... } },
    "dex": { ... },
    "staking": { ... },
    "pid": { ... },
    "treasury": { ... },
    "bots": { ... },
    "alerts": [ ... ],
    "anomalies": [ ... ]
  }
}
```

**Auto-Pruning:**

The Reporter keeps a maximum number of reports per period (default: 100). Oldest reports are deleted automatically. Configure with `maxReports` option.

---

## Configuration

### Environment Variables

The system does not require environment variables — all configuration is passed via CLI arguments or constructor options.

### Contract Addresses

Contract addresses are configured in the AnalyticsEngine constructor or by modifying the default config. For mainnet deployment, update the addresses object:

```javascript
const ADDRESSES = {
  auToken: '0xProductionAuAddress',
  agToken: '0xProductionAgAddress',
  dex: '0xProductionDexAddress',
  staking: '0xProductionStakingAddress',
  pidController: '0xProductionPidAddress',
  treasuryAMO: '0xProductionTreasuryAddress',
  sandboxLP: '0xProductionLpAddress',
  governor: '0xProductionGovernorAddress'
};
```

### Tuning Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `pollInterval` | 5000ms | How often to query contracts |
| `maxHistory` | 1000 | Data points retained in memory |
| `dashboardRefresh` | 2000ms | Terminal UI redraw interval |
| `reportPeriods` | 5min,1hr,24hr | Which report intervals to generate |
| `maxReports` | 100 | Reports kept per period before pruning |

---

## Events

The AnalyticsEngine emits the following events:

| Event | Payload | When |
|-------|---------|------|
| `data` | `Snapshot` | New data point collected |
| `error` | `Error` | Contract call fails |
| `stats` | `AggregateStats` | Stats recalculated |

The AlertSystem emits:

| Event | Payload | When |
|-------|---------|------|
| `alert` | `Alert` | New anomaly detected |
| `alert:clear` | `Alert` | Condition returns to normal |

The Dashboard emits:

| Event | Payload | When |
|-------|---------|------|
| `ready` | `void` | Dashboard initialized |
| `render` | `void` | Screen redrawn |

---

## Error Handling

The system is designed to be resilient:

- **RPC failures** — Retried automatically, logged as warnings, `CONTRACT_ERROR` alert fired
- **Missing data** — Partial snapshots are still processed; unavailable fields are `null`
- **Rate limiting** — Backoff logic increases interval temporarily on 429 responses
- **Memory growth** — History is capped at `maxHistory` (default 1000 points)
- **Graceful shutdown** — SIGINT/SIGTERM handlers stop all modules cleanly

---

## Porting to Mainnet

The monitoring system is designed for production deployment:

1. **Update RPC URL** — Change from `localhost:8545` to your production node
2. **Update contract addresses** — Replace sandbox addresses with mainnet addresses
3. **Adjust thresholds** — Mainnet volumes/values differ from sandbox
4. **Add authentication** — If using a hosted RPC, add API key to provider config
5. **Run as service** — Use systemd or PM2 for persistent operation

Example systemd unit:

```ini
[Unit]
Description=AV Treasury Monitor
After=network.target

[Service]
Type=simple
User=adam
WorkingDirectory=/home/adam/workspace/av_treasury
ExecStart=/usr/local/bin/node sandbox/monitoring/index.js --interval 10000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## Performance

- **Memory**: ~50MB for 1000 data points (each ~50KB)
- **CPU**: < 2% on modern hardware at 5s intervals
- **Latency**: Contract polling takes ~200ms for 8 contracts
- **Disk**: Reports auto-pruned; ~1MB per 100 reports

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Connection refused" | RPC node not running | Start Anvil or check RPC URL |
| All metrics null | Wrong contract addresses | Verify addresses match deployed contracts |
| Dashboard flickers | Refresh too fast | Increase `--refresh` value |
| No alerts firing | Thresholds too loose | Lower threshold values |
| Memory growing | `maxHistory` too high | Reduce in constructor options |
| Reports not generating | `--report false` passed | Enable with `--report true` |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ethers` | ^5.7.2 | Ethereum RPC interaction |
| `chalk` | ^4.1.2 | Terminal colors |
| `readline` | built-in | Cursor management |

---

## File Structure

```
sandbox/monitoring/
├── README.md           ← This file
├── USER_GUIDE.md       ← Usage guide and examples
├── index.js            — Orchestrator / CLI entry point
├── AnalyticsEngine.js  — Data collection and metrics
├── Dashboard.js        — Real-time terminal UI
├── AlertSystem.js      — Anomaly detection
└── Reporter.js         — Periodic report generation
```
