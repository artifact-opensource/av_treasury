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
    // Speed control
    simulate: false,
    days: 365,
    maxSpeed: 1000000,
    tickMs: 100,
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
      case '--simulate':
        args.simulate = true;
        break;
      case '--days':
        args.days = parseInt(argv[++i]) || args.days;
        break;
      case '--max-speed':
        args.maxSpeed = parseInt(argv[++i]) || args.maxSpeed;
        break;
      case '--tick-ms':
        args.tickMs = parseInt(argv[++i]) || args.tickMs;
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
  --simulate           Run time-compressed simulation (exponential speed)
  --days <n>           Simulated days to run (default: 365)
  --max-speed <n>      Max speed multiplier (default: 1000000)
  --tick-ms <ms>       Real-time ms per tick (default: 100)
  --help, -h           Show this help

${chalk.bold('Examples:')}
  node sandbox/monitoring/index.js
  node sandbox/monitoring/index.js --interval 10000 --quiet
  node sandbox/monitoring/index.js --simulate --days 365 --max-speed 1000000
  node sandbox/monitoring/index.js --simulate --days 30 --max-speed 1000000 --tick-ms 50
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

// ── Simulation Mode ──────────────────────────────────────────────

/**
 * Run a time-compressed simulation using the SpeedController.
 * This bypasses the live monitoring loop and instead advances
 * simulated time at exponential speed.
 */
async function runSimulationMode(args) {
  const { SpeedController, createSpeedRamp } = require('./SpeedController');
  const AnalyticsEngine = require('./AnalyticsEngine');
  const AlertSystem = require('./AlertSystem');

  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 AV TREASURY SANDBOX — SIMULATION MODE                   ║
║                                                               ║
║   Exponential Time Compression • Speed Control               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));

  console.log(chalk.gray(`  Target:     ${args.days} simulated days`));
  console.log(chalk.gray(`  Max speed:  ${args.maxSpeed}x`));
  console.log(chalk.gray(`  Tick rate:  ${args.tickMs}ms`));
  console.log('');

  // Initialize components
  const speed = new SpeedController({
    initialSpeed: 1,
    maxSpeed: args.maxSpeed,
    autoThrottle: true,
    enableEventSampling: true,
  });

  // Lightweight analytics for simulation mode (no RPC needed)
  const analytics = {
    healthHistory: [],
    tickCount: 0,
    anomalyCount: 0,
    recordHealth(score, tick) {
      this.healthHistory.push({ tick, score, time: Date.now() });
      this.tickCount++;
    },
    recordTick(tickData) {
      this.tickCount++;
    },
    getFullReport() {
      const scores = this.healthHistory.map(h => h.score);
      return {
        tickCount: this.tickCount,
        anomalyCount: this.anomalyCount,
        avgHealth: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        minHealth: scores.length ? Math.min(...scores) : 0,
        maxHealth: scores.length ? Math.max(...scores) : 0,
        healthHistory: this.healthHistory.slice(-100),
      };
    },
  };

  const alerts = new AlertSystem({ silent: false });

  // Wire events
  speed.on('healthUpdate', (data) => analytics.recordHealth(data.score, data.tick));
  speed.on('emergencyBrake', (data) => {
    alerts.raise('EMERGENCY', `Health ${data.healthScore.toFixed(2)} — throttled to realtime`);
  });
  speed.on('throttle', (data) => {
    alerts.raise('WARNING', `Auto-throttle at health ${data.healthScore.toFixed(2)}`);
  });

  // Speed ramp schedule
  const ramp = createSpeedRamp(speed, [
    { atTick: 0,   action: 'setPreset', value: 'REALTIME' },
    { atTick: 10,  action: 'setPreset', value: 'FAST' },
    { atTick: 50,  action: 'setPreset', value: 'ACCELERATED' },
    { atTick: 100, action: 'setPreset', value: 'FAST_FORWARD' },
    { atTick: 200, action: 'setPreset', value: 'HYPERSPEED' },
    { atTick: 500, action: 'setPreset', value: 'WARP' },
    { atTick: 1000, action: 'setPreset', value: 'LUDICROUS' },
  ]);

  speed.start();

  const targetDays = args.days;
  let lastLog = Date.now();

  while (speed.simulatedDays < targetDays && speed.running) {
    ramp();
    const tickData = speed.tick();

    // Stochastic health model (replace with real forge state reads)
    const health = calculateHealth(tickData);
    speed.updateHealth(health);
    analytics.recordTick(tickData);

    if (Date.now() - lastLog > 2000) {
      speed.printStatus();
      lastLog = Date.now();
    }

    if (speed.healthScore < 0.05) {
      console.log('\n🛑 CRITICAL: Health collapsed. Stopping.');
      break;
    }

    await new Promise(r => setTimeout(r, args.tickMs));
  }

  const report = speed.stop();
  const fullReport = {
    speed: report,
    analytics: analytics.getFullReport(),
    alerts: alerts.getHistory(),
  };

  // Write results
  const fs = require('fs');
  const path = require('path');
  const outDir = './simulation_results';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'simulation_report.json'), JSON.stringify(fullReport, null, 2));
  console.log(`\n📊 Results written to ${outDir}/simulation_report.json`);

  return fullReport;
}

function calculateHealth(tickData) {
  const { simulatedDays, tick, speed } = tickData;
  let health = 1.0 - (simulatedDays / 3650) * 0.1;
  health += (Math.random() - 0.5) * 0.02;
  if (Math.random() < 0.0001) health -= 0.3;
  if (speed > 100000) health -= 0.001 * Math.log10(speed / 100000);
  health += 0.001;
  return Math.max(0, Math.min(1, health));
}

// ── Entry Point ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Simulation mode
  if (args.simulate) {
    try {
      await runSimulationMode(args);
    } catch (err) {
      console.error(chalk.red('\n❌ Simulation failed:'), err.message);
      console.error(err.stack);
      process.exit(1);
    }
    return;
  }

  // Normal monitoring mode
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
