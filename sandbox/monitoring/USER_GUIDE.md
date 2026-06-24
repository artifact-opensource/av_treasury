# AV Treasury Sandbox — Monitoring System User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Who This Is For](#who-this-is-for)
3. [Before You Start](#before-you-start)
4. [Starting Monitoring](#starting-monitoring)
5. [Understanding the Dashboard](#understanding-the-dashboard)
6. [Understanding Alerts](#understanding-alerts)
7. [Understanding Reports](#understanding-reports)
8. [Common Tasks](#common-tasks)
9. [Advanced Usage](#advanced-usage)
10. [Mainnet Deployment Guide](#mainnet-deployment-guide)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)
13. [Glossary](#glossary)

---

## 1. Introduction

The AV Treasury Monitoring System is your window into everything happening inside the sandbox environment. It tells you:

- **What** is happening (token prices, trades, staking, PID emissions)
- **How healthy** the system is (composite score 0-100)
- **When something is wrong** (anomaly alerts with severity levels)
- **What happened** over time (periodic reports with full analytics)

This guide covers everything from your first `node sandbox/monitoring/index.js` run to deploying the system on mainnet.

### What the System Monitors

| Component | What We Track |
|-----------|---------------|
| **Au Token** | Supply, burns, transfer fee, price |
| **Ag Token** | Supply, mints, price |
| **DEX** | Reserves, price, volume, slippage, fee accumulation |
| **Staking** | TVL, APY, multiplier distribution, participation rate |
| **PID Controller** | Error, integral, emission rate, daily cap utilization |
| **Treasury** | Balance, runway, buyback capacity, total executed |
| **Bots** | Active count, trade volume, personality distribution |
| **System** | Composite health score, anomaly flags |

---

## 2. Who This Is For

| Role | What You'll Use |
|------|-----------------|
| **Developer** | Debugging contract interactions, verifying economic model |
| **Security Analyst** | Monitoring for anomalies, centralization risks, attack patterns |
| **Economist** | Tracking price stability, emission effectiveness, TVL growth |
| **Operator** | Production monitoring, alert response, report review |
| **Auditor** | Historical data export, report generation, metric verification |

---

## 3. Before You Start

### 3.1 System Requirements

- **Node.js** ≥ 16.0.0 (check with `node --version`)
- **npm** ≥ 7.0.0
- **~100MB RAM** for the monitoring process
- **RPC access** — local Anvil node or remote Ethereum node
- **Terminal** with 256-color support and minimum 120×40 characters

### 3.2 Install Dependencies

```bash
cd /home/adam/workspace/av_treasury
npm install
```

### 3.3 Verify RPC Node

Ensure your local Anvil (or other RPC node) is running:

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Expected response: `{"jsonrpc":"2.0","id":1,"result":"0x..."}`

### 3.4 Deploy Sandbox Contracts

The monitoring system reads data from deployed contracts. If you haven't deployed yet:

```bash
node sandbox/scripts/deploy-sandbox.js
```

This deploys all 8 sandbox contracts (AuToken, AgToken, DexSimulator, SandboxLPToken, MockStaking, MockPIDController, MockTreasuryAMO, MockGovernor) and writes their addresses to `sandbox/addresses.json`.

### 3.5 Verify Addresses Exist

```bash
cat sandbox/addresses.json | head -20
```

You should see all 8 contract addresses listed.

---

## 4. Starting Monitoring

### 4.1 Quick Start

```bash
node sandbox/monitoring/index.js
```

This starts everything with defaults:
- ✅ Dashboard (terminal UI)
- ✅ Alerts (anomaly detection)
- ✅ Reports (periodic generation)
- 5-second data collection interval
- 2-second dashboard refresh

### 4.2 Custom Start

```bash
# Fast polling for debugging
node sandbox/monitoring/index.js --interval 1000

# Slow polling for background monitoring
node sandbox/monitoring/index.js --interval 30000

# Headless mode (alerts only, no dashboard)
node sandbox/monitoring/index.js --quiet

# Custom report periods
node sandbox/monitoring/index.js --report-periods 1min,5min,15min

# Export a single snapshot and exit
node sandbox/monitoring/index.js --export ./debug-snapshot.json

# Run for exactly 50 data points then stop
node sandbox/monitoring/index.js --history 50
```

### 4.3 Running in Background

For persistent monitoring without keeping a terminal open:

```bash
# Using nohup
nohup node sandbox/monitoring/index.js --quiet > monitor.log 2>&1 &
echo $!  # Note the PID

# Using screen
screen -S monitor
node sandbox/monitoring/index.js
# Press Ctrl+A then D to detach

# Using tmux
tmux new -s monitor
node sandbox/monitoring/index.js
# Press Ctrl+B then D to detach
```

### 4.4 Stopping Monitoring

Press **Ctrl+C** for graceful shutdown. The system will:
1. Stop the dashboard
2. Stop the reporter
3. Stop the alert system
4. Stop the analytics engine
5. Exit cleanly

If unresponsive: `kill -9 <PID>` (force kill, no cleanup).

---

## 5. Understanding the Dashboard

The dashboard occupies your entire terminal and refreshes every 2 seconds (configurable with `--refresh`).

### 5.1 Layout

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    AV TREASURY SANDBOX — LIVE MONITORING             ║
╠═══════════════════════════════════════════════════════════════════════╣
║  System Health: 87/100  ████████████████████░░░  ▲ +2               ║
║  Block: 12345678    Data Points: 142    Uptime: 00:04:43            ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Au Token                        ║  Ag Token                         ║
║  Supply: 1,000,000 Au            ║  Supply: 5,000,000 Ag              ║
║  Burned: 50,000 (5%)             ║  Minted: 100,000                   ║
║  Price: $1.00  ▁▂▃▅▇█▇▅▃▂▁▂▃▅  ║  Price: $0.60  ▁▂▃▅▇█▇▅▃▂▁▂▃▅  ║
║  Fee: 9 bps                      ║                                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║  DEX                             ║  Staking                          ║
║  Au Reserve: 10,000              ║  TVL: 800,000 Au                  ║
║  Ag Reserve: 50,000              ║  APY: 24.0%  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇  ║
║  Price: 0.60 Ag/Au               ║  Multiplier: 1.8x avg             ║
║  Volume: 1,234,567               ║  Participants: 42                  ║
║  Slippage: 0.3%                  ║  Ratio: 80.0%                     ║
╠═══════════════════════════════════════════════════════════════════════╣
║  PID Controller                  ║  Treasury                         ║
║  Error: +5.0%  ▁▂▃▅▇█▇▅▃▂▁▂▃▅  ║  Balance: 50,000 Ag               ║
║  Integral: 1,234                  ║  Runway: 24 months                ║
║  Emission: 1.0 Au/block          ║  Buyback Cap: 10,000 Ag           ║
║  Daily Cap: 30% used             ║  Total Buybacks: 500              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Bot Activity                    ║  Recent Alerts                    ║
║  Active: 95 / 100                ║  [10:05] 🟡 PID_ERROR_SPIKE      ║
║  Trades: 1,234                   ║  [10:02] 🟡 DEX_SLIPPAGE_HIGH    ║
║  Buy: 600 | Sell: 400            ║  [09:58] 🟢 TVL_DROP (cleared)   ║
║  Stake: 150 | Unstake: 84       ║                                    ║
║  Personalities: C30|A40|L30      ║                                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Performance: 180ms latency | 45MB RAM | 0 errors                   ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 5.2 Reading Sparklines

Sparklines show the last 20 data points as a mini chart:

```
▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁
```

- `▁` = Lowest value in window
- `▃` = Below average
- `▅` = Average
- `█` = Highest value in window

Trend interpretation:
- `▁▂▃▅▇█` = Steadily rising
- `█▇▅▃▂▁` = Steadily falling
- `▁▂▃▅▇█▇▅▃▂▁` = Stable oscillation
- `▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁` = Flat/unchanged

### 5.3 Color Meanings

| Color | Meaning | Action Needed |
|-------|---------|---------------|
| 🟢 Green | Healthy / within normal range | None |
| 🟡 Yellow | Approaching threshold | Watch closely |
| 🔴 Red | Threshold breached | Investigate immediately |
| 🔵 Cyan | Header / informational | None |

### 5.4 Health Score Interpretation

| Score | Status | Description |
|-------|--------|-------------|
| 90-100 | Excellent | All metrics nominal |
| 70-89 | Good | Minor deviations, nothing critical |
| 50-69 | Degraded | Multiple warnings, attention needed |
| 30-49 | Poor | Critical issues present |
| 0-29 | Critical | System failure imminent |

---

## 6. Understanding Alerts

### 6.1 Alert Display

Alerts appear in the "Recent Alerts" panel with format:

```
[HH:MM] 🔴 ALERT_NAME: Brief description
[HH:MM] 🟡 ALERT_NAME: Brief description
[HH:MM] 🟢 ALERT_NAME: Condition cleared
```

### 6.2 Severity Icons

| Icon | Severity | Meaning |
|------|----------|---------|
| 🔴 | CRITICAL | Immediate action required |
| 🟡 | HIGH | Urgent attention needed |
| 🟢 | MEDIUM | Notable, monitor closely |
| ⚪ | LOW | Informational only |

### 6.3 Alert Types Explained

#### AU_PRICE_DROP
**What**: Au token price dropped more than 10% within 5 minutes.
**Why it matters**: Indicates selling pressure, potential loss of confidence, or exploit.
**Investigate**: Check DEX for large sells, check bots for panic behavior, check if PID is over-emitting.

#### AG_PRICE_DROP
**What**: Ag token price dropped more than 15% within 5 minutes.
**Why it matters**: Ag is the spending token; rapid devaluation threatens usability.
**Investigate**: Check Treasury minting rate, check DEX Ag sells, check PID emission.

#### TVL_DROP
**What**: Total Value Locked in staking dropped more than 20% in 10 minutes.
**Why it matters**: Users are unstaking and potentially exiting the system.
**Investigate**: Check for large unstake events, check if APY crashed, check for Au price drop correlation.

#### TREASURY_DEPLETED
**What**: Treasury runway dropped below 6 months.
**Why it matters**: Treasury funds buybacks and operations; depletion means system loses stability mechanisms.
**Investigate**: Check buyback frequency, check Ag minting rate, check Treasury balance trend.

#### PID_ERROR_SPIKE
**What**: PID controller error exceeded 5% for 10+ consecutive blocks.
**Why it matters**: PID is the stability mechanism; large errors mean it's not controlling effectively.
**Investigate**: Check PID gains (Kp, Ki), check if target TVL is achievable, check emission cap.

#### PID_EMISSION_EXHAUSTED
**What**: Daily emission cap is more than 90% used.
**Why it matters**: Once exhausted, PID stops emitting — no more buyback pressure.
**Investigate**: Check emission rate vs. daily cap, consider raising cap or lowering emission rate.

#### DEX_SLIPPAGE_HIGH
**What**: A swap executed with more than 5% slippage.
**Why it matters**: High slippage means low liquidity or large trades; users get poor prices.
**Investigate**: Check DEX reserves, check trade sizes, check if bots are manipulating price.

#### STAKING_CENTRALIZED
**What**: Gini coefficient of staking addresses exceeds 0.8.
**Why it matters**: High centralization means few stakers control the system — governance risk.
**Investigate**: Identify largest staking addresses, consider incentivizing smaller stakers.

#### BOT_VOLUME_ANOMALY
**What**: Bot trade volume exceeds 3× the rolling average.
**Why it matters**: Unusual bot activity could indicate manipulation or exploit.
**Investigate**: Check which personality type is active, check trade direction, check DEX impact.

#### DEX_LOW_LIQUIDITY
**What**: DEX reserves drop below 10 ETH equivalent.
**Why it matters**: Low liquidity = high slippage = poor user experience.
**Investigate**: Check LP withdrawals, check if bots are removing liquidity, check trading volume.

#### STAKING_APY_ANOMORY
**What**: Staking APY outside 5-50% range.
**Why it matters**: Too high = unsustainable inflation; too low = no incentive to stake.
**Investigate**: Check emission rate, check total staked vs. emissions, check PID configuration.

#### CONTRACT_ERROR
**What**: A contract call failed during data collection.
**Why it matters**: Could indicate contract exploit, upgrade issue, or RPC problem.
**Investigate**: Check contract state, check RPC connectivity, check for reverts.

#### HEALTH_DROP
**What**: Composite health score dropped below 50.
**Why it matters**: Multiple subsystems degrading simultaneously.
**Investigate**: Check all individual metrics, check for cascading failures.

### 6.4 Alert Cooldowns

Each alert has a cooldown period. If the same condition triggers again during cooldown, it's suppressed (not displayed again). This prevents alert storms during sustained anomalies.

| Alert | Cooldown |
|-------|----------|
| AU_PRICE_DROP | 60 seconds |
| AG_PRICE_DROP | 60 seconds |
| TVL_DROP | 120 seconds |
| TREASURY_DEPLETED | 300 seconds |
| PID_ERROR_SPIKE | 120 seconds |
| PID_EMISSION_EXHAUSTED | 300 seconds |
| DEX_SLIPPAGE_HIGH | 60 seconds |
| STAKING_CENTRALIZED | 600 seconds |
| BOT_VOLUME_ANOMALY | 120 seconds |
| DEX_LOW_LIQUIDITY | 300 seconds |
| STAKING_APY_ANOMALY | 300 seconds |
| CONTRACT_ERROR | 30 seconds |
| HEALTH_DROP | 120 seconds |

---

## 7. Understanding Reports

Reports are generated automatically at configured intervals and saved to `sandbox/reports/`.

### 7.1 Finding Reports

```bash
# List all reports
ls -la sandbox/reports/5min/
ls -la sandbox/reports/1hr/
ls -la sandbox/reports/24hr/

# View latest Markdown report
cat sandbox/reports/5min/report-*.md | less

# View latest JSON report (pretty-printed)
cat sandbox/reports/5min/report-*.json | python3 -m json.tool | less
```

### 7.2 Report Naming Convention

```
{period}/report-{YYYY-MM-DD-HH-MM}.{ext}
```

Example: `5min/report-2024-06-24-10-05.md`

### 7.3 Reading a Markdown Report

Each report starts with an executive summary:

```markdown
# AV Treasury Monitoring Report
**Period**: 5min
**Generated**: 2024-06-24 10:05:00 UTC
**Data Points**: 60

## Executive Summary
- Health Score: 88/100 (min: 82, max: 94)
- Alerts Fired: 3
- Anomalies Detected: 1
- Key Events: PID error spike at 10:02, resolved by 10:04
```

Then detailed sections follow for each subsystem.

### 7.4 Using JSON Reports

JSON reports are machine-readable and suitable for:

- **Automated analysis**: Parse with `jq` or Python
- **Dashboard integration**: Feed into Grafana, Datadog, etc.
- **Alerting**: Compare against thresholds in scripts

```bash
# Get health score from latest report
cat sandbox/reports/5min/report-*.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['healthScore']['avg'])"

# Count alerts by type
cat sandbox/reports/1hr/report-*.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
alerts = d['sections']['alerts']
from collections import Counter
types = Counter(a['type'] for a in alerts)
for t, c in types.most_common():
    print(f'{t}: {c}')
"
```

### 7.5 Report Retention

By default, the system keeps 100 reports per period. Older reports are auto-deleted. To change:

```bash
# In custom code:
const reporter = new Reporter(engine, alertSystem, {
  maxReports: 200  // keep more
});
```

---

## 8. Common Tasks

### 8.1 Debugging a Specific Issue

**Scenario**: Au price seems wrong.

```bash
# 1. Start monitoring with fast polling
node sandbox/monitoring/index.js --interval 1000 --quiet

# 2. In another terminal, watch the Au price specifically
watch -n 1 'cat sandbox/reports/1min/report-*.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
au = d[\"sections\"][\"tokens\"][\"au\"]
print(f\"Au Price: {au[\"price\"]}\")
print(f\"Supply: {au[\"supply\"]}\")
print(f\"Burned: {au[\"burned\"]}\")
"'

# 3. Check DEX trades
cat sandbox/reports/1min/report-*.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
dex = d['sections']['dex']
print(f\"Volume: {dex['volume']}\")
print(f\"Price: {dex['price']}\")
print(f\"Reserves: {dex['reserveA']} / {dex['reserveB']}\")
"
```

### 8.2 Exporting Data for Analysis

```bash
# Export a snapshot
node sandbox/monitoring/index.js --export ./analysis.json

# Or collect 200 data points and export
node sandbox/monitoring/index.js --history 200 --export ./analysis.json

# Analyze with Python
python3 << 'EOF'
import json
with open('analysis.json') as f:
    data = json.load(f)

# Plot price history
import matplotlib.pyplot as plt
prices = [p['au']['price'] for p in data['history']]
plt.plot(prices)
plt.title('Au Price Over Time')
plt.show()
EOF
```

### 8.3 Running Monitoring as a Service

Create `/etc/systemd/system/av-monitor.service`:

```ini
[Unit]
Description=AV Treasury Sandbox Monitor
After=network.target

[Service]
Type=simple
User=adam
WorkingDirectory=/home/adam/workspace/av_treasury
ExecStart=/usr/local/bin/node sandbox/monitoring/index.js --interval 10000 --quiet
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable av-monitor
sudo systemctl start av-monitor
sudo systemctl status av-monitor

# View logs
journalctl -u av-monitor -f
```

### 8.4 Custom Alert Rules

```javascript
// custom-monitor.js
const MonitoringApp = require('./sandbox/monitoring/index');

async function main() {
  const app = await MonitoringApp.fromArgs({
    interval: 5000,
    dashboard: true,
    alerts: true,
    report: false,
    quiet: false,
    refresh: 2000,
    reportPeriods: '',
    history: null,
    export: null
  });

  // Add custom rule
  app.alertSystem.addRule({
    id: 'AU_BELOW_05',
    check: (current) => {
      const price = parseFloat(current.au.price);
      return price < 0.5;
    },
    severity: 'CRITICAL',
    message: 'Au price below $0.50 — potential death spiral',
    cooldown: 120000
  });

  await app.start();
}

main().catch(console.error);
```

### 8.5 Stress Testing the System

```bash
# Run monitoring with very fast polling to test performance limits
node sandbox/monitoring/index.js --interval 500 --history 100

# Monitor the monitor
watch -n 1 'ps aux | grep "node.*monitoring" | grep -v grep'
```

---

## 9. Advanced Usage

### 9.1 Programmatic API

You can use the monitoring modules in your own scripts:

```javascript
const AnalyticsEngine = require('./sandbox/monitoring/AnalyticsEngine');
const AlertSystem = require('./sandbox/monitoring/AlertSystem');

// Create engine
const engine = new AnalyticsEngine({
  rpcUrl: 'http://localhost:8545',
  contractAddresses: { /* ... */ }
});

// Listen for data
engine.on('data', (snapshot) => {
  console.log(`Health: ${snapshot.system.healthScore}`);
  console.log(`Au price: ${snapshot.au.price}`);
});

// Create alerts
const alerts = new AlertSystem();
alerts.on('alert', (alert) => {
  if (alert.severity === 'CRITICAL') {
    // Send notification, trigger bot response, etc.
    console.error('CRITICAL:', alert.message);
  }
});

// Start
engine.start();
```

### 9.2 Custom Dashboard Integration

The Dashboard renders to the terminal. For web-based dashboards, use the JSON data:

```javascript
// Stream data via WebSocket
const WebSocket = require('ws');
const AnalyticsEngine = require('./sandbox/monitoring/AnalyticsEngine');

const wss = new WebSocket.Server({ port: 8080 });
const engine = new AnalyticsEngine({ /* ... */ });

engine.on('data', (snapshot) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(snapshot));
    }
  });
});

engine.start();
```

### 9.3 Multiple Instance Monitoring

Run multiple monitoring instances for different environments:

```bash
# Sandbox
node sandbox/monitoring/index.js --interval 5000 --quiet \
  --export /tmp/sandbox-snapshot.json

# Testnet (different addresses)
RPC_URL=https://testnet.rpc.example.com \
CONTRACT_ADDRESSES=./testnet-addresses.json \
node sandbox/monitoring/index.js --interval 10000 --quiet
```

### 9.4 Performance Tuning

| Scenario | Interval | Max History | Refresh | Notes |
|----------|----------|-------------|---------|-------|
| Debugging | 1000ms | 100 | 500ms | Fast response, high CPU |
| Active monitoring | 5000ms | 1000 | 2000ms | Balanced |
| Background | 30000ms | 500 | 10000ms | Low resource usage |
| Production | 10000ms | 1000 | 5000ms | Recommended for mainnet |

### 9.5 Memory Management

Each data point is approximately 50KB. Default 1000-point history = ~50MB.

To reduce memory:
```javascript
const engine = new AnalyticsEngine({
  maxHistory: 200  // only keep last 200 points
});
```

To increase for long-term analysis:
```javascript
const engine = new AnalyticsEngine({
  maxHistory: 5000  // ~250MB, good for 24h at 5s intervals
});
```

---

## 10. Mainnet Deployment Guide

### 10.1 Pre-Deployment Checklist

- [ ] Contract addresses updated to mainnet
- [ ] RPC endpoint configured (Infura, Alchemy, or self-hosted)
- [ ] Alert thresholds calibrated for mainnet values
- [ ] Report periods set appropriately (1hr, 6hr, 24hr recommended)
- [ ] Systemd service configured
- [ ] Log rotation configured
- [ ] Backup RPC configured for failover

### 10.2 Configuration Changes

```javascript
// Production config
const PROD_CONFIG = {
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
  // OR
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
  
  contractAddresses: {
    auToken: '0x...',  // Production AuToken
    agToken: '0x...',  // Production AgToken
    dex: '0x...',      // Production DEX
    staking: '0x...',  // Production Staking
    pidController: '0x...',  // Production PID
    treasuryAMO: '0x...',    // Production Treasury
    sandboxLP: '0x...',      // Production LP
    governor: '0x...'        // Production Governor
  },
  
  pollInterval: 10000,  // 10 seconds (mainnet blocks are 12s)
  maxHistory: 1000,
  
  // Alert thresholds should be wider for mainnet
  // (more noise, more participants, more volatility)
};
```

### 10.3 Security Considerations

1. **RPC API Key**: Never commit API keys; use environment variables
2. **HTTPS**: Always use WSS/HTTPS for remote RPC
3. **Rate Limits**: Respect RPC rate limits; adjust interval accordingly
4. **Access Control**: If exposing dashboard, add authentication
5. **Log Sanitization**: Don't log sensitive data in reports

### 10.4 Monitoring the Monitor

On mainnet, you need to ensure the monitor itself is healthy:

```bash
# Health check script
#!/bin/bash
# check-monitor.sh

# Check if process is running
if ! pgrep -f "node.*monitoring" > /dev/null; then
  echo "ALERT: Monitor process not found"
  systemctl restart av-monitor
fi

# Check if producing fresh data
LATEST=$(ls -t sandbox/reports/1hr/*.json | head -1)
AGE=$(( $(date +%s) - $(stat -c %Y "$LATEST") ))
if [ $AGE -gt 7200 ]; then  # 2 hours
  echo "ALERT: No fresh report in 2 hours (last: ${AGE}s ago)"
  systemctl restart av-monitor
fi

# Check memory usage
MEM=$(ps aux | grep "node.*monitoring" | grep -v grep | awk '{print $6}')
if [ $MEM -gt 500000 ]; then  # > 500MB
  echo "ALERT: Monitor using too much RAM (${MEM}KB)"
  systemctl restart av-monitor
fi
```

### 10.5 Backup and Recovery

```bash
# Backup configuration
cp -r sandbox/monitoring /backup/monitor-config-$(date +%Y%m%d)

# Backup reports
tar -czf /backup/reports-$(date +%Y%m%d).tar.gz sandbox/reports/

# Recovery
cd /home/adam/workspace/av_treasury
cp -r /backup/monitor-config-* sandbox/monitoring/
systemctl restart av-monitor
```

---

## 11. Troubleshooting

### 11.1 Common Errors

#### "Error: could not detect network"
**Cause**: RPC node unreachable or wrong URL.
**Fix**: Verify RPC URL, check network connectivity, check if Anvil is running.

```
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### "CONTRACT_ERROR alert firing repeatedly"
**Cause**: Wrong contract addresses or contracts not deployed.
**Fix**: Check `sandbox/addresses.json` matches deployed contracts.

#### "Dashboard shows all zeros"
**Cause**: Contracts return empty data — likely wrong addresses or uninitialized state.
**Fix**: Verify contracts are deployed and initialized.

#### "Memory usage keeps growing"
**Cause**: `maxHistory` too high or memory leak.
**Fix**: Restart monitor, reduce `maxHistory`, update to latest version.

#### "No reports being generated"
**Cause**: `--report false` passed or reporter not started.
**Fix**: Add `--report true` to command line.

#### "Permission denied" on port
**Cause**: Trying to use port < 1024 without root.
**Fix**: Use ports > 1024 or use `sudo` (not recommended).

### 11.2 Diagnostic Commands

```bash
# Check if monitor process is running
ps aux | grep "node.*monitoring"

# Check RPC connectivity
curl -s http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check contract addresses
cat sandbox/addresses.json

# Check latest report timestamp
ls -lt sandbox/reports/5min/*.json | head -1

# Check monitor logs
journalctl -u av-monitor --since "1 hour ago" --no-pager

# Check system resources
free -h
df -h
```

### 11.3 Getting Help

1. Check this guide's relevant section
2. Check the README.md for technical details
3. Check the source code comments (all functions are documented)
4. Check `git log` for recent changes
5. Run with `--interval 1000` and watch for error messages

---

## 12. FAQ

**Q: Can I run monitoring without the dashboard?**
A: Yes, use `--quiet` or `--dashboard false`.

**Q: How many data points should I keep?**
A: For development: 100-500. For production: 1000 (covers 1.4h at 5s, or 2.8h at 10s).

**Q: Can I monitor multiple chains simultaneously?**
A: Yes, run separate instances with different `--export` paths.

**Q: Do reports include historical data?**
A: Each report covers its period (e.g., a 5min report includes 5 minutes of data). For longer history, use the JSON export.

**Q: Can I customize alert thresholds?**
A: Yes, modify the AlertSystem rules (see source code) or use `addRule()` programmatically.

**Q: Will this work with Optimism/Arbitrum?**
A: Yes, as long as the chain supports standard Ethereum RPC. Adjust intervals for faster block times.

**Q: How do I add a new metric?**
A: Add the collection method in `AnalyticsEngine.js`, add it to the `collect()` method, and add display logic in `Dashboard.js`.

**Q: Can I use this with Grafana?**
A: Yes, use the JSON export or add a Prometheus endpoint. The Reporter's JSON format is easy to parse.

**Q: What happens if the RPC connection drops?**
A: The system retries automatically and fires a CONTRACT_ERROR alert. It does not crash.

**Q: How do I reset the monitoring state?**
A: Stop the monitor, delete `sandbox/reports/` if desired, restart. History is in-memory only.

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Snapshot** | A single data point containing all metrics at one moment in time |
| **Sparkline** | A small inline chart showing trend over last 20 data points |
| **Health Score** | Composite 0-100 score based on weighted subsystem health |
| **Gini Coefficient** | Measure of inequality (0 = perfectly equal, 1 = one entity owns everything) |
| **TVL** | Total Value Locked — amount of tokens staked |
| **PID** | Proportional-Integral-Derivative controller — algorithm that adjusts emissions to hit target TVL |
| **APY** | Annual Percentage Yield — staking return rate |
| **Slippage** | Difference between expected and actual swap price |
| **Runway** | How many months the Treasury can sustain buybacks at current burn rate |
| **Basis Points (bps)** | 1/100th of a percent (100 bps = 1%) |
| **Cooldown** | Minimum time between duplicate alerts of the same type |
| **Anomaly** | A data point that deviates significantly from expected behavior |
| **Reporter** | Module that generates periodic JSON and Markdown reports |
| **Orchestrator** | The `index.js` module that coordinates all other modules |
| **Wei** | Smallest unit of ETH (1 ETH = 10^18 wei) |
| **K (Constant Product)** | DEX invariant: reserveA × reserveB = K |

---

## Quick Reference Card

```
Start:          node sandbox/monitoring/index.js
Fast mode:      node sandbox/monitoring/index.js --interval 1000
Headless:       node sandbox/monitoring/index.js --quiet
Export:         node sandbox/monitoring/index.js --export ./data.json
Stop:           Ctrl+C
Reports:        sandbox/reports/{period}/
Health:         90-100 Excellent | 70-89 Good | 50-69 Degraded | <50 Critical
```

---

*Last updated: 2024-06-24 | AV Treasury Monitoring System v1.0*
