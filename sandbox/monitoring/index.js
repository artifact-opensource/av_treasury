#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Index — Main Entry Point for AV Treasury Sandbox Monitoring
 * ═══════════════════════════════════════════════════════════════════
 *
 * Orchestrates all monitoring modules:
 *   - AnalyticsEngine (data collection)
 *   - Dashboard (real-time terminal UI)
 *   - AlertSystem (anomaly detection)
 *   - Reporter (periodic reports)
 *
 * CLI flags:
 *   --interval <ms>     Data collection interval (default: 5000)
 *   --dashboard         Enable dashboard (default: true)
 *   --alerts            Enable alerts (default: true)
 *   --report            Enable reporter (default: true)
 *   --report-periods <p>  Comma-separated report periods (default: 5min,1hr,24hr)
 *   --export <path>     Export latest data as JSON to path and exit
 *   --history <n>       Number of data points to collect (default: unlimited)
 *   --refresh <ms>      Dashboard refresh interval (default: 2000)
 *   --quiet             Suppress dashboard output
 *
 * Usage:
 *   node sandbox/monitoring/index.js
 *   node sandbox/monitoring/index.js --interval 10000 --quiet
 *   node sandbox/monitoring/index.js --export ./data.json
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// ── Parse CLI Arguments ────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    interval: 5000,
    dashboard: true,
    alerts: true,
    report: true,
    reportPeriods: '5min,1hr,24hr',
    export: null,
    history: null,
    refresh: 2000,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--interval':
        args.interval = parseInt(argv[++i]) || args.interval;
        break;
      case '--dashboard':
        args.dashboard = true;
        break;
      case '--no-dashboard':
        args.dashboard = false;
        break;
      case '--alerts':
        args.alerts = true;
        break;
      case '--no-alerts':
        args.alerts = false;
        break;
      case '--report':
        args.report = true;
        break;
      case '--no-report':
        args.report = false;
        break;
      case '--report-periods':
        args.reportPeriods = argv[++i] || args.reportPeriods;
        break;
      case '--export':
        args.export = argv[++i] || null;
        break;
      case '--history':
        args.history = parseInt(argv[++i]) || null;
        break;
      case '--refresh':
        args.refresh = parseInt(argv[++i]) || args.refresh;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.log(chalk.yellow(`Unknown option: ${arg}. Use --help for usage.`));
        }
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
${chalk.cyan('AV Treasury Sandbox Monitoring System')}

${chalk.bold('Usage:')} node sandbox/monitoring/index.js [options]

${chalk.bold('Options:')}
  --interval <ms>      Data collection interval in ms (default: 5000)
  --dashboard          Enable terminal dashboard (default)
  --no-dashboard       Disable terminal dashboard
  --alerts             Enable alert system (default)
  --no-alerts          Disable alert system
  --report             Enable periodic reports (default)
  --no-report          Disable periodic reports
  --report-periods <p> Comma-separated periods: 1min,5min,15min,1hr,6hr,24hr
  --export <path>      Export latest data as JSON and exit
  --history <n>        Collect N data points then exit (default: unlimited)
  --refresh <ms>       Dashboard refresh interval in ms (default: 2000)
  --quiet              Suppress dashboard output (useful for headless)
  --help, -h           Show this help

${chalk.bold('Examples:')}
  node sandbox/monitoring/index.js
  node sandbox/monitoring/index.js --interval 10000 --quiet
  node sandbox/monitoring/index.js --export ./snapshot.json --history 50
  node sandbox/monitoring/index.js --no-dashboard --alerts --report-periods 5min
`);
}

// ── Main Application ───────────────────────────────────────────────

class MonitoringApp {
  constructor(args) {
    this.args = args;
    this.engine = null;
    this.dashboard = null;
    this.alertSystem = null;
    this.reporter = null;
    this.shutdownCalled = false;
  }

  async start() {
    const { args } = this;

    // Print banner
    this._printBanner();

    // ── Initialize AnalyticsEngine ──
    const AnalyticsEngine = require('./AnalyticsEngine');
    this.engine = new AnalyticsEngine({
      intervalMs: args.interval,
    });

    try {
      await this.engine.init();
      console.log(chalk.green('✅ AnalyticsEngine initialized'));
    } catch (err) {
      console.error(chalk.red('❌ Failed to initialize AnalyticsEngine:'), err.message);
      process.exit(1);
    }

    // ── Handle --export mode ──
    if (args.export) {
      console.log(chalk.cyan(`\n📦 Export mode: collecting data and exporting to ${args.export}`));
      await this._handleExport();
      return;
    }

    // ── Initialize AlertSystem ──
    if (args.alerts) {
      const AlertSystem = require('./AlertSystem');
      this.alertSystem = new AlertSystem(this.engine);
      this.alertSystem.start();
      if (!args.quiet) {
        console.log(chalk.green('✅ AlertSystem started'));

        // Forward alerts to console
        this.alertSystem.on('alert', (alert) => {
          // Alerts are logged by the AlertSystem itself
        });
      }
    }

    // ── Initialize Reporter ──
    if (args.report) {
      const Reporter = require('./Reporter');
      this.reporter = new Reporter(this.engine, this.alertSystem, {
        periods: args.reportPeriods.split(','),
      });
      this.reporter.start();
      if (!args.quiet) {
        console.log(chalk.green(`✅ Reporter started (periods: ${args.reportPeriods})`));
      }
    }

    // ── Initialize Dashboard ──
    if (args.dashboard && !args.quiet) {
      const Dashboard = require('./Dashboard');
      this.dashboard = new Dashboard(this.engine, {
        refreshMs: args.refresh,
      });

      // Forward anomalies to dashboard
      this.engine.on('anomaly', ({ anomalies }) => {
        anomalies.forEach(a => this.dashboard.addAlert(a));
      });

      if (!args.quiet) {
        console.log(chalk.green('✅ Dashboard starting...'));
      }

      // Start dashboard in foreground (it handles its own render loop)
      await this.dashboard.start();
    } else {
      // No dashboard — run engine and wait
      this.engine.start();
      this._setupGracefulShutdown();

      // Wait for history limit if specified
      if (args.history) {
        console.log(chalk.cyan(`\n📊 Collecting ${args.history} data points...`));
        await this._waitForHistory(args.history);
        this._printSummary();
        await this.shutdown();
      } else {
        // Block forever
        await new Promise(() => {});
      }
    }
  }

  /**
   * Handle export mode: collect data, then export
   */
  async _handleExport() {
    const targetDataPoints = this.args.history || 50;

    console.log(chalk.cyan(`Collecting ${targetDataPoints} data points before export...`));

    // Start collection
    this.engine.start();

    // Wait for enough data
    await new Promise((resolve) => {
      this.engine.on('collect', ({ round }) => {
        if (round >= targetDataPoints) resolve();
      });
    });

    // Export
    const exportPath = this.args.export;
    const data = {
      exportedAt: new Date().toISOString(),
      dataPoints: targetDataPoints,
      latest: this.engine.getLatest(),
      stats: this.engine.getStats(),
      history: this.engine.getHistory(),
    };

    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));

    console.log(chalk.green(`✅ Exported to ${exportPath}`));
    console.log(chalk.cyan(`   Data points: ${targetDataPoints}`));

    this._printSummary();
    await this.shutdown();
    process.exit(0);
  }

  /**
   * Wait for N data points to be collected
   */
  _waitForHistory(count) {
    return new Promise((resolve) => {
      const check = () => {
        if (this.engine.history.length >= count) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Print summary after export or history collection
   */
  _printSummary() {
    const stats = this.engine.getStats();
    if (!stats) return;

    console.log('\n' + chalk.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.bold.white('  📊 Collection Summary'));
    console.log(chalk.cyan('═══════════════════════════════════════════════════'));
    console.log(`  Period:          ${new Date(stats.period.start).toLocaleString()} → ${new Date(stats.period.end).toLocaleString()}`);
    console.log(`  Data Points:     ${stats.period.dataPoints}`);
    console.log(`  Price Change:    ${stats.price.change >= 0 ? '+' : ''}${stats.price.change.toFixed(2)}%`);
    console.log(`  Health (avg):    ${Math.round(stats.health.avg)}/100`);
    console.log(`  Health (cur):    ${stats.health.current}/100`);
    console.log(`  Alerts Total:    ${stats.alerts.total}`);
    if (Object.keys(stats.alerts.byType).length > 0) {
      for (const [type, count] of Object.entries(stats.alerts.byType)) {
        console.log(`    ${type}: ${count}`);
      }
    }
    console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));
  }

  /**
   * Setup graceful shutdown handlers
   */
  _setupGracefulShutdown() {
    if (this.shutdownCalled) return;

    const shutdown = async () => {
      if (this.shutdownCalled) return;
      this.shutdownCalled = true;

      console.log(chalk.yellow('\n\n🛑 Shutting down monitoring system...'));
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.dashboard) this.dashboard.stop();
    if (this.reporter) this.reporter.stop();
    if (this.alertSystem) this.alertSystem.stop();
    if (this.engine) this.engine.stop();

    // Give modules time to clean up
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Print startup banner
   */
  _printBanner() {
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🏛️  AV TREASURY SANDBOX — MONITORING SYSTEM                ║
║                                                               ║
║   Analytics • Dashboard • Alerts • Reports                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));

    console.log(chalk.gray('  Configuration:'));
    console.log(chalk.gray(`    Interval:      ${this.args.interval}ms`));
    console.log(chalk.gray(`    Dashboard:     ${this.args.dashboard ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`    Alerts:        ${this.args.alerts ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`    Reports:       ${this.args.report ? 'enabled' : 'disabled'}`));
    if (this.args.report) {
      console.log(chalk.gray(`    Report Periods: ${this.args.reportPeriods}`));
    }
    console.log(chalk.gray(`    Refresh:       ${this.args.refresh}ms`));
    console.log('');
  }
}

// ── Entry Point ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = new MonitoringApp(args);

  try {
    await app.start();
  } catch (err) {
    console.error(chalk.red('\n❌ Fatal error:'), err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MonitoringApp;
