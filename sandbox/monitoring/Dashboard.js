#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Dashboard — Real-Time Terminal Dashboard for AV Treasury Sandbox
 * ═══════════════════════════════════════════════════════════════════
 *
 * Rich terminal UI using chalk for colors and manual box drawing.
 * Consumes data from AnalyticsEngine and renders multiple panels:
 *   - System Health Score (0-100, color-coded)
 *   - Token Prices + 24h change
 *   - Supply charts (Au burned, Ag minted)
 *   - DEX reserves + depth chart
 *   - Staking TVL + APY
 *   - PID controller state
 *   - Treasury status
 *   - Live trade feed
 *   - Bot activity heatmap
 *   - Alert banner
 *
 * Usage:
 *   node sandbox/monitoring/Dashboard.js
 *   # Or programmatically:
 *   const dashboard = new Dashboard(engine);
 *   dashboard.start();
 */

const chalk = require('chalk');
const { ethers } = require('ethers');
const readline = require('readline');

// ── Dashboard Class ────────────────────────────────────────────────

class Dashboard {
  /**
   * @param {AnalyticsEngine} engine - AnalyticsEngine instance
   * @param {Object} options
   * @param {number} options.refreshMs - Refresh interval in ms
   * @param {boolean} options.clearScreen - Clear screen between renders
   */
  constructor(engine, options = {}) {
    this.engine = engine;
    this.refreshMs = options.refreshMs || 2000;
    this.clearScreen = options.clearScreen !== false;
    this.running = false;
    this.frameCount = 0;
    this.startTime = Date.now();
    this.alerts = []; // Recent alerts to display
    this.maxAlerts = 5;
  }

  /**
   * Start the dashboard rendering loop
   */
  async start() {
    if (!this.engine.lastData) {
      console.log(chalk.yellow('[Dashboard] Waiting for first data collection...'));
      await new Promise((resolve) => {
        this.engine.once('data', resolve);
      });
    }

    this.running = true;
    this.startTime = Date.now();

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    // Clear screen
    console.clear();

    // Main render loop
    while (this.running) {
      await this.render();
      await this.sleep(this.refreshMs);
    }
  }

  /**
   * Stop the dashboard
   */
  stop() {
    this.running = false;
    process.stdout.write('\x1B[?25h'); // Show cursor
    console.log(chalk.yellow('\n⏹️  Dashboard stopped.'));
  }

  /**
   * Add an alert to the banner
   */
  addAlert(alert) {
    this.alerts.unshift({
      ...alert,
      timestamp: Date.now(),
    });
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }
  }

  /**
   * Render the complete dashboard
   */
  async render() {
    this.frameCount++;
    const data = this.engine.getLatest();
    if (!data) {
      console.log(chalk.yellow('Waiting for data...'));
      return;
    }

    const history = this.engine.getHistory({ limit: 60 });
    const width = process.stdout.columns || 120;

    // Build output
    let output = '';

    // ── Header ──
    output += this._renderHeader(width, data);
    output += '\n';

    // ── Health Score ──
    output += this._renderHealthScore(data);
    output += '\n';

    // ── Two-column layout ──
    const colWidth = Math.floor((width - 3) / 2);

    // Left column: Token + DEX
    const leftCol = [
      this._renderTokenPrices(data, history),
      this._renderSupplyChart(data, history),
      this._renderDexReserves(data, history),
    ].join('\n');

    // Right column: Staking + PID + Treasury
    const rightCol = [
      this._renderStaking(data),
      this._renderPID(data),
      this._renderTreasury(data),
    ].join('\n');

    // Render columns side by side
    output += this._renderColumns(leftCol, rightCol, colWidth);
    output += '\n';

    // ── Trade Feed ──
    output += this._renderTradeFeed(data);
    output += '\n';

    // ── Bot Activity ──
    output += this._renderBotActivity(data);
    output += '\n';

    // ── Alert Banner ──
    output += this._renderAlertBanner();
    output += '\n';

    // ── Footer ──
    output += this._renderFooter(data);

    // Move cursor to top and write
    if (this.clearScreen) {
      process.stdout.write('\x1B[H'); // Move to 0,0
    }
    process.stdout.write(output);
  }

  // ── Render Helpers ───────────────────────────────────────────────

  _renderHeader(width, data) {
    const title = '🏛️  AV TREASURY SANDBOX — MONITORING DASHBOARD';
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    const block = data.blockNumber;
    const round = data.round;

    const line = '═'.repeat(width);
    const titlePad = Math.max(0, Math.floor((width - title.length) / 2));
    const info = `Block: ${block} | Round: ${round} | ${elapsed}s`;

    return [
      chalk.cyan(`╔${line.slice(0, width - 2)}╗`),
      chalk.cyan('║') + ' '.repeat(titlePad) + chalk.bold.white(title) + ' '.repeat(Math.max(0, width - titlePad - title.length - 2 - info.length)) + chalk.gray(info) + chalk.cyan(' ║'),
      chalk.cyan(`╚${line.slice(0, width - 2)}╝`),
    ].join('\n');
  }

  _renderHealthScore(data) {
    const score = data.system.healthScore;
    let color = chalk.green;
    let label = 'HEALTHY';
    let icon = '●';

    if (score < 40) {
      color = chalk.red;
      label = 'CRITICAL';
      icon = '🔴';
    } else if (score < 60) {
      color = chalk.yellow;
      label = 'WARNING';
      icon = '🟡';
    } else if (score < 80) {
      color = chalk.yellow;
      label = 'MODERATE';
      icon = '🟡';
    } else {
      color = chalk.green;
      label = 'HEALTHY';
      icon = '🟢';
    }

    // Progress bar
    const barWidth = 40;
    const filled = Math.floor((score / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

    return [
      `  ${icon} ${chalk.bold('System Health Score:')} ${color.bold(`${score}/100`)} [${color(label)}]`,
      `  ${bar} ${color(score + '%')}`,
    ].join('\n');
  }

  _renderTokenPrices(data, history) {
    const price = parseFloat(data.token.auPriceInAgFormatted);
    const auSupply = parseFloat(ethers.formatEther(data.token.auSupply));
    const agSupply = parseFloat(ethers.formatEther(data.token.agSupply));
    const burned = parseFloat(ethers.formatEther(data.token.totalBurned));

    // Calculate 24h change (or from available history)
    let priceChange = 'N/A';
    let changeColor = chalk.white;
    if (history.length > 1) {
      const oldPrice = parseFloat(history[0].token.auPriceInAgFormatted);
      if (oldPrice > 0) {
        const change = ((price - oldPrice) / oldPrice) * 100;
        const sign = change >= 0 ? '+' : '';
        changeColor = change >= 0 ? chalk.green : chalk.red;
        priceChange = `${sign}${change.toFixed(2)}%`;
      }
    }

    const lines = [
      chalk.bold.blue('┌── Token Prices ─────────────────────────┐'),
      chalk.bold.blue('│') + `  Au Price:     ${chalk.yellow(price.toFixed(6))} Ag/Au` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  24h Change:   ${changeColor(priceChange)}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Au Supply:    ${chalk.white(auSupply.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Ag Supply:    ${chalk.white(agSupply.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Au Burned:    ${chalk.red(burned.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('└─────────────────────────────────────────┘'),
    ];

    // Adjust width
    return lines.map(l => {
      const stripped = l.replace(/\x1B\[[0-9;]*m/g, '');
      if (stripped.length < 44) {
        return l + ' '.repeat(44 - stripped.length) + chalk.bold.blue('│') ;
      }
      return l;
    }).join('\n');
  }

  _renderSupplyChart(data, history) {
    const lines = [
      chalk.bold.blue('┌── Supply (Au Burned) ───────────────────┐'),
    ];

    if (history.length < 2) {
      lines.push(chalk.bold.blue('│') + chalk.gray('  (collecting data...)') + chalk.bold.blue('│'));
      lines.push(chalk.bold.blue('└─────────────────────────────────────────┘'));
      return lines.join('\n');
    }

    // Sparkline of Au burned over time
    const burnedValues = history.map(d => parseFloat(ethers.formatEther(d.token.totalBurned)));
    const sparkline = this._makeSparkline(burnedValues, 36);
    lines.push(chalk.bold.blue('│') + `  Burned: ${chalk.red(sparkline)}` + chalk.bold.blue('│'));

    // Ag minted sparkline
    const agValues = history.map(d => parseFloat(ethers.formatEther(d.token.agSupply)));
    const agSparkline = this._makeSparkline(agValues, 36);
    lines.push(chalk.bold.blue('│') + `  Minted: ${chalk.green(agSparkline)}` + chalk.bold.blue('│'));

    lines.push(chalk.bold.blue('└─────────────────────────────────────────┘'));
    return lines.join('\n');
  }

  _renderDexReserves(data, history) {
    const reserveA = parseFloat(ethers.formatEther(data.dex.reserveA));
    const reserveB = parseFloat(ethers.formatEther(data.dex.reserveB));
    const tvl = parseFloat(ethers.formatEther(data.dex.tvl));
    const k = parseFloat(ethers.formatEther(data.dex.k));
    const slippage = data.dex.slippagePercent;

    const slippageColor = slippage > 5 ? chalk.red : slippage > 2 ? chalk.yellow : chalk.green;

    const lines = [
      chalk.bold.blue('┌── DEX Reserves ─────────────────────────┐'),
      chalk.bold.blue('│') + `  Ag Reserve:   ${chalk.white(reserveA.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Au Reserve:   ${chalk.white(reserveB.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  TVL:          ${chalk.cyan(tvl.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  K:            ${chalk.white(k.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Slippage:     ${slippageColor(slippage.toFixed(2) + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('└─────────────────────────────────────────┘'),
    ];

    return lines.join('\n');
  }

  _renderStaking(data) {
    const tvl = parseFloat(ethers.formatEther(data.staking.tvl));
    const apyAu = data.staking.apyAu;
    const apyAg = data.staking.apyAg;
    const combined = data.staking.combinedApy;

    const apyColor = combined > 0.5 ? chalk.green : combined > 0.1 ? chalk.yellow : chalk.white;

    const lines = [
      chalk.bold.blue('┌── Staking ──────────────────────────────┐'),
      chalk.bold.blue('│') + `  TVL:          ${chalk.cyan(tvl.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Au APY:       ${chalk.yellow((apyAu * 100).toFixed(2) + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Ag APY:       ${chalk.yellow((apyAg * 100).toFixed(2) + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Combined:     ${apyColor((combined * 100).toFixed(2) + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('└─────────────────────────────────────────┘'),
    ];

    return lines.join('\n');
  }

  _renderPID(data) {
    const error = (data.pid.errorPercent * 100).toFixed(2);
    const emission = (data.pid.emissionRate * 100).toFixed(1);
    const target = parseFloat(ethers.formatEther(data.pid.targetTvl));
    const dailyEmitted = parseFloat(ethers.formatEther(data.pid.dailyEmitted));
    const maxDaily = parseFloat(ethers.formatEther(data.pid.maxDaily));

    const errorColor = Math.abs(data.pid.errorPercent) > 0.1 ? chalk.red : Math.abs(data.pid.errorPercent) > 0.05 ? chalk.yellow : chalk.green;

    const lines = [
      chalk.bold.blue('┌── PID Controller ───────────────────────┐'),
      chalk.bold.blue('│') + `  Error:        ${errorColor(error + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Target TVL:   ${chalk.white(target.toLocaleString(undefined, { maximumFractionDigits: 0 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Emission:     ${chalk.yellow(emission + '%')}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Daily:        ${dailyEmitted.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${maxDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}` + chalk.bold.blue('│'),
      chalk.bold.blue('└─────────────────────────────────────────┘'),
    ];

    return lines.join('\n');
  }

  _renderTreasury(data) {
    const balance = parseFloat(ethers.formatEther(data.treasury.balance));
    const runway = data.treasury.runwayMonths;
    const buybackCap = parseFloat(ethers.formatEther(data.treasury.buybackCapacity));
    const executed = parseFloat(data.treasury.totalExecuted);

    const runwayColor = runway < 3 ? chalk.red : runway < 6 ? chalk.yellow : chalk.green;

    const lines = [
      chalk.bold.blue('┌── Treasury ─────────────────────────────┐'),
      chalk.bold.blue('│') + `  Balance:      ${chalk.green(balance.toLocaleString(undefined, { maximumFractionDigits: 2 }))} Ag` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Runway:       ${runwayColor(runway.toFixed(1) + ' months')}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Buyback Cap:  ${chalk.yellow(buybackCap.toLocaleString(undefined, { maximumFractionDigits: 2 }))}` + chalk.bold.blue('│'),
      chalk.bold.blue('│') + `  Executed:     ${chalk.white(executed)}` + chalk.bold.blue('│'),
      chalk.bold.blue('└─────────────────────────────────────────┘'),
    ];

    return lines.join('\n');
  }

  _renderTradeFeed(data) {
    const trades = data.bot.recentTrades || [];
    const lines = [
      chalk.bold.blue('┌── Live Trade Feed (Last 10) ────────────┐'),
    ];

    if (trades.length === 0) {
      lines.push(chalk.bold.blue('│') + chalk.gray('  (No recent trades)') + chalk.bold.blue('│'));
    } else {
      const last10 = trades.slice(-10);
      for (const trade of last10) {
        const type = trade.type || 'swap';
        const amount = trade.amount || '0';
        const color = type.includes('buy') || type === 'swapAforB' ? chalk.green : chalk.red;
        const line = `  ${color(type.padEnd(12))} ${amount.padEnd(20)} ${trade.time || ''}`;
        const strippedLen = line.replace(/\x1B\[[0-9;]*m/g, '').length;
        const pad = Math.max(0, 40 - strippedLen);
        lines.push(chalk.bold.blue('│') + line + ' '.repeat(pad) + chalk.bold.blue('│'));
      }
    }

    lines.push(chalk.bold.blue('└─────────────────────────────────────────┘'));
    return lines.join('\n');
  }

  _renderBotActivity(data) {
    const dist = data.bot.personalityDistribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);

    const lines = [
      chalk.bold.blue('┌── Bot Activity ─────────────────────────┐'),
    ];

    // Personality distribution bar
    const barWidth = 36;
    let bar = '';
    const colors = {
      whale: chalk.bold.red,
      dayTrader: chalk.yellow,
      dolphin: chalk.cyan,
      lp: chalk.green,
      dumper: chalk.magenta,
      accumulator: chalk.blue,
      staker: chalk.white,
    };

    for (const [type, count] of Object.entries(dist)) {
      const portion = total > 0 ? Math.floor((count / total) * barWidth) : 0;
      bar += (colors[type] || chalk.white)('█'.repeat(portion));
    }

    lines.push(chalk.bold.blue('│') + `  ${bar}` + chalk.bold.blue('│'));

    // Legend
    const legend = Object.entries(dist)
      .map(([type, count]) => `${(colors[type] || chalk.white)(type.slice(0, 3))}:${count}`)
      .join(' ');
    lines.push(chalk.bold.blue('│') + `  ${legend}` + chalk.bold.blue('│'));

    lines.push(chalk.bold.blue('│') + `  Active: ${chalk.cyan(String(data.bot.activeCount))} bots` + chalk.bold.blue('│'));
    lines.push(chalk.bold.blue('└─────────────────────────────────────────┘'));

    return lines.join('\n');
  }

  _renderAlertBanner() {
    if (this.alerts.length === 0) {
      return chalk.green('  ✅ No active alerts\n');
    }

    const lines = [
      chalk.bold.red('┌── ⚠ ALERTS ─────────────────────────────┐'),
    ];

    for (const alert of this.alerts.slice(0, 5)) {
      const severityColor = alert.severity === 'critical' ? chalk.red : alert.severity === 'warning' ? chalk.yellow : chalk.white;
      const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️';
      const line = `  ${icon} ${severityColor(alert.message || alert.type)}`;
      const strippedLen = line.replace(/\x1B\[[0-9;]*m/g, '').length;
      const pad = Math.max(0, 40 - strippedLen);
      lines.push(chalk.bold.red('│') + line + ' '.repeat(pad) + chalk.bold.red('│'));
    }

    lines.push(chalk.bold.red('└─────────────────────────────────────────┘'));
    return lines.join('\n');
  }

  _renderFooter(data) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    return chalk.gray(`  Last update: ${new Date(data.timestamp).toLocaleTimeString()} | Frame: ${this.frameCount} | ${elapsed}s elapsed`);
  }

  // ── Utility Methods ──────────────────────────────────────────────

  /**
   * Render two columns side by side
   */
  _renderColumns(left, right, colWidth) {
    const leftLines = left.split('\n');
    const rightLines = right.split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);

    const result = [];
    for (let i = 0; i < maxLines; i++) {
      const ll = leftLines[i] || '';
      const rl = rightLines[i] || '';

      // Strip ANSI for padding calculation
      const llStripped = ll.replace(/\x1B\[[0-9;]*m/g, '');
      const rlStripped = rl.replace(/\x1B\[[0-9;]*m/g, '');

      const llPad = Math.max(0, colWidth - llStripped.length);
      const rlPad = Math.max(0, colWidth - rlStripped.length);

      result.push(ll + ' '.repeat(llPad) + ' │ ' + rl + ' '.repeat(rlPad));
    }

    return result.join('\n');
  }

  /**
   * Create a sparkline from an array of values
   */
  _makeSparkline(values, width) {
    if (values.length === 0) return '';

    const sparkChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Sample values to fit width
    const sampled = [];
    for (let i = 0; i < width; i++) {
      const idx = Math.floor((i / (width - 1)) * (values.length - 1));
      sampled.push(values[idx]);
    }

    return sampled.map(v => {
      const normalized = (v - min) / range;
      const charIdx = Math.min(sparkChars.length - 1, Math.floor(normalized * sparkChars.length));
      return chalk.cyan(sparkChars[charIdx]);
    }).join('');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ── CLI ───────────────────────────────────────────────────────────

if (require.main === module) {
  const AnalyticsEngine = require('./AnalyticsEngine');

  const engine = new AnalyticsEngine({
    intervalMs: parseInt(process.env.INTERVAL_MS) || 5000,
  });

  const dashboard = new Dashboard(engine, {
    refreshMs: parseInt(process.env.REFRESH_MS) || 2000,
  });

  // Forward anomalies to dashboard alerts
  engine.on('anomaly', ({ anomalies }) => {
    anomalies.forEach(a => dashboard.addAlert(a));
  });

  engine.on('error', (err) => {
    dashboard.addAlert({ severity: 'critical', type: 'ENGINE_ERROR', message: err.message });
  });

  // Start
  engine.start()
    .then(() => dashboard.start())
    .catch((err) => {
      console.error(chalk.red('❌ Failed to start:'), err.message);
      process.exit(1);
    });

  // Graceful shutdown
  const shutdown = () => {
    dashboard.stop();
    engine.stop();
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = Dashboard;
