#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Reporter — Periodic Report Generation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Generates JSON and Markdown reports at configurable intervals:
 *   - 1min, 5min, 15min, 1hr, 6hr, 24hr
 *
 * Report sections:
 *   - Executive summary
 *   - System health score trend
 *   - Token performance (price, supply, burns)
 *   - DEX activity (volume, liquidity, fees)
 *   - Staking metrics (TVL, APY, participation)
 *   - PID controller performance
 *   - Treasury health
 *   - Bot activity summary
 *   - Alerts fired
 *   - Anomalies detected
 *
 * Saves reports to sandbox/reports/
 *
 * Usage:
 *   const reporter = new Reporter(engine, alertSystem);
 *   reporter.start();
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { ethers } = require('ethers');
const { EventEmitter } = require('events');

// ── Report Periods (ms) ────────────────────────────────────────────

const REPORT_PERIODS = {
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1hr': 60 * 60 * 1000,
  '6hr': 6 * 60 * 60 * 1000,
  '24hr': 24 * 60 * 60 * 1000,
};

// ── Reporter Class ─────────────────────────────────────────────────

class Reporter extends EventEmitter {
  /**
   * @param {AnalyticsEngine} engine - AnalyticsEngine instance
   * @param {AlertSystem} alertSystem - AlertSystem instance (optional)
   * @param {Object} options
   * @param {string[]} options.periods - Which periods to generate reports for
   * @param {string} options.outputDir - Directory to save reports
   * @param {number} options.maxReports - Max reports to keep per period
   */
  constructor(engine, alertSystem = null, options = {}) {
    super();
    this.engine = engine;
    this.alertSystem = alertSystem;
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'reports');
    this.periods = options.periods || ['5min', '1hr', '24hr'];
    this.maxReports = options.maxReports || 100;
    this.running = false;
    this.timers = {};
    this.reportHistory = [];

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Start periodic report generation
   */
  start() {
    if (this.running) return;
    this.running = true;

    console.log(chalk.green(`[Reporter] Starting, output: ${this.outputDir}`));
    console.log(chalk.green(`[Reporter] Periods: ${this.periods.join(', ')}`));

    // Schedule each period
    for (const period of this.periods) {
      const intervalMs = REPORT_PERIODS[period];
      if (!intervalMs) {
        console.log(chalk.yellow(`[Reporter] Unknown period: ${period}, skipping`));
        continue;
      }

      // Generate first report immediately
      this.generate(period);

      // Then on interval
      this.timers[period] = setInterval(() => {
        this.generate(period);
      }, intervalMs);
    }

    this.emit('started', { periods: this.periods });
  }

  /**
   * Stop report generation
   */
  stop() {
    this.running = false;
    for (const [period, timer] of Object.entries(this.timers)) {
      clearInterval(timer);
    }
    this.timers = {};
    this.emit('stopped');
    console.log(chalk.yellow('[Reporter] Stopped'));
  }

  /**
   * Generate a report for a specific period
   * @param {string} period - Period key (e.g., '5min', '1hr')
   * @returns {Object} Generated report
   */
  generate(period) {
    const intervalMs = REPORT_PERIODS[period];
    if (!intervalMs) return null;

    const now = Date.now();
    const since = now - intervalMs;
    const data = this.engine.getHistory({ since });

    if (data.length === 0) {
      console.log(chalk.yellow(`[Reporter] No data for ${period} report`));
      return null;
    }

    // Get alerts for this period
    const alerts = this.alertSystem
      ? this.alertSystem.getHistory({ since })
      : [];

    // Build report
    const report = this._buildReport(period, data, alerts, now);

    // Save reports
    this._saveReport(report, period, now, 'json');
    this._saveReport(report, period, now, 'md');

    // Track history
    this.reportHistory.push({
      period,
      timestamp: now,
      filename: `${period}_${this._formatTimestamp(now)}`,
    });

    // Prune old reports
    this._pruneOldReports(period);

    this.emit('report', { period, timestamp: now });
    console.log(chalk.cyan(`[Reporter] Generated ${period} report (${data.length} data points, ${alerts.length} alerts)`));

    return report;
  }

  /**
   * Build the report object
   */
  _buildReport(period, data, alerts, now) {
    const stats = this.engine.getStats(since);
    const latest = data[data.length - 1];
    const first = data[0];

    return {
      meta: {
        period,
        generatedAt: new Date(now).toISOString(),
        dataPoints: data.length,
        timeRange: {
          start: new Date(first.timestamp).toISOString(),
          end: new Date(latest.timestamp).toISOString(),
        },
      },
      executiveSummary: this._buildExecutiveSummary(data, alerts, stats),
      healthTrend: this._buildHealthTrend(data),
      tokenPerformance: this._buildTokenPerformance(data),
      dexActivity: this._buildDexActivity(data),
      stakingMetrics: this._buildStakingMetrics(data),
      pidPerformance: this._buildPidPerformance(data),
      treasuryHealth: this._buildTreasuryHealth(data),
      botActivity: this._buildBotActivity(data),
      alertsFired: this._buildAlertsSection(alerts),
      anomalies: this._buildAnomaliesSection(data),
      stats,
    };
  }

  // ── Report Section Builders ──────────────────────────────────────

  _buildExecutiveSummary(data, alerts, stats) {
    const latest = data[data.length - 1];
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
    const warningAlerts = alerts.filter(a => a.severity === 'WARNING').length;

    let status = 'HEALTHY';
    if (criticalAlerts > 0) status = 'CRITICAL';
    else if (warningAlerts > 0) status = 'WARNING';

    return {
      status,
      healthScore: latest.system.healthScore,
      auPrice: latest.token.auPriceInAgFormatted,
      tvl: ethers.formatEther(latest.staking.tvl),
      treasuryBalance: ethers.formatEther(latest.treasury.balance),
      totalAlerts: alerts.length,
      criticalAlerts,
      warningAlerts,
      summary: `System is ${status}. Health score: ${latest.system.healthScore}/100. ` +
        `Au price: ${latest.token.auPriceInAgFormatted} Ag. TVL: ${ethers.formatEther(latest.staking.tvl)}. ` +
        `${alerts.length} alerts fired (${criticalAlerts} critical, ${warningAlerts} warning).`,
    };
  }

  _buildHealthTrend(data) {
    const scores = data.map(d => d.system.healthScore);
    const first = scores[0] || 0;
    const last = scores[scores.length - 1] || 0;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      dataPoints: scores,
      min,
      max,
      average: Math.round(avg),
      current: last,
      trend: last > first ? 'improving' : last < first ? 'declining' : 'stable',
      change: last - first,
    };
  }

  _buildTokenPerformance(data) {
    const latest = data[data.length - 1];
    const first = data[0];

    const auPriceFirst = parseFloat(first.token.auPriceInAgFormatted);
    const auPriceLast = parseFloat(latest.token.auPriceInAgFormatted);
    const auPriceChange = auPriceFirst > 0
      ? ((auPriceLast - auPriceFirst) / auPriceFirst) * 100
      : 0;

    const agSupplyFirst = parseFloat(ethers.formatEther(first.token.agSupply));
    const agSupplyLast = parseFloat(ethers.formatEther(latest.token.agSupply));
    const agInflation = agSupplyFirst > 0
      ? ((agSupplyLast - agSupplyFirst) / agSupplyFirst) * 100
      : 0;

    const auBurned = parseFloat(ethers.formatEther(latest.token.totalBurned));

    return {
      au: {
        price: auPriceLast,
        priceChange: auPriceChange.toFixed(2) + '%',
        supply: ethers.formatEther(latest.token.auSupply),
        totalBurned: auBurned.toFixed(2),
      },
      ag: {
        supply: ethers.formatEther(latest.token.agSupply),
        inflation: agInflation.toFixed(2) + '%',
      },
    };
  }

  _buildDexActivity(data) {
    const latest = data[data.length - 1];
    const first = data[0];

    const volumeA = parseFloat(ethers.formatEther(latest.dex.volumeA));
    const volumeB = parseFloat(ethers.formatEther(latest.dex.volumeB));
    const feesA = parseFloat(ethers.formatEther(latest.dex.feesA));
    const feesB = parseFloat(ethers.formatEther(latest.dex.feesB));

    return {
      reserves: {
        ag: ethers.formatEther(latest.dex.reserveA),
        au: ethers.formatEther(latest.dex.reserveB),
      },
      tvl: ethers.formatEther(latest.dex.tvl),
      volume: {
        ag: volumeA.toFixed(2),
        au: volumeB.toFixed(2),
      },
      fees: {
        ag: feesA.toFixed(4),
        au: feesB.toFixed(4),
      },
      slippage: latest.dex.slippagePercent.toFixed(2) + '%',
      lpSupply: ethers.formatEther(latest.dex.lpSupply),
    };
  }

  _buildStakingMetrics(data) {
    const latest = data[data.length - 1];
    const tvls = data.map(d => parseFloat(ethers.formatEther(d.staking.tvl)));
    const apys = data.map(d => d.staking.combinedApy * 100);

    return {
      tvl: {
        current: ethers.formatEther(latest.staking.tvl),
        min: Math.min(...tvls).toFixed(2),
        max: Math.max(...tvls).toFixed(2),
        average: (tvls.reduce((a, b) => a + b, 0) / tvls.length).toFixed(2),
      },
      apy: {
        au: (latest.staking.apyAu * 100).toFixed(2) + '%',
        ag: (latest.staking.apyAg * 100).toFixed(2) + '%',
        combined: (latest.staking.combinedApy * 100).toFixed(2) + '%',
        average: (apys.reduce((a, b) => a + b, 0) / apys.length).toFixed(2) + '%',
      },
      totalStaked: ethers.formatEther(latest.staking.totalStaked),
    };
  }

  _buildPidPerformance(data) {
    const latest = data[data.length - 1];
    const errors = data.map(d => d.pid.errorPercent * 100);
    const emissions = data.map(d => d.pid.emissionRate * 100);

    return {
      currentError: (latest.pid.errorPercent * 100).toFixed(2) + '%',
      targetTvl: ethers.formatEther(latest.pid.targetTvl),
      emissionRate: (latest.pid.emissionRate * 100).toFixed(2) + '%',
      dailyEmitted: ethers.formatEther(latest.pid.dailyEmitted),
      maxDaily: ethers.formatEther(latest.pid.maxDaily),
      errorTrend: {
        min: Math.min(...errors).toFixed(2) + '%',
        max: Math.max(...errors).toFixed(2) + '%',
        average: (errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(2) + '%',
      },
    };
  }

  _buildTreasuryHealth(data) {
    const latest = data[data.length - 1];
    const runways = data.map(d => d.treasury.runwayMonths);

    return {
      balance: ethers.formatEther(latest.treasury.balance),
      runwayMonths: latest.treasury.runwayMonths.toFixed(1),
      buybackCapacity: ethers.formatEther(latest.treasury.buybackCapacity),
      totalExecuted: latest.treasury.totalExecuted,
      totalAuBought: ethers.formatEther(latest.treasury.totalAuBought),
      totalAgSpent: ethers.formatEther(latest.treasury.totalAgSpent),
      runwayTrend: {
        min: Math.min(...runways).toFixed(1),
        max: Math.max(...runways).toFixed(1),
        average: (runways.reduce((a, b) => a + b, 0) / runways.length).toFixed(1),
      },
    };
  }

  _buildBotActivity(data) {
    const latest = data[data.length - 1];
    const dist = latest.bot.personalityDistribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);

    const distribution = {};
    for (const [type, count] of Object.entries(dist)) {
      distribution[type] = {
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%',
      };
    }

    return {
      activeCount: latest.bot.activeCount,
      personalityDistribution: distribution,
      tradeVolumeByType: latest.bot.tradeVolumeByType,
    };
  }

  _buildAlertsSection(alerts) {
    return {
      total: alerts.length,
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        warning: alerts.filter(a => a.severity === 'WARNING').length,
        info: alerts.filter(a => a.severity === 'INFO').length,
      },
      recent: alerts.slice(-10).map(a => ({
        time: new Date(a.timestamp).toISOString(),
        severity: a.severity,
        type: a.type,
        message: a.message,
      })),
    };
  }

  _buildAnomaliesSection(data) {
    const allAnomalies = [];
    for (const d of data) {
      for (const a of d.system.anomalies) {
        allAnomalies.push({
          time: new Date(d.timestamp).toISOString(),
          ...a,
        });
      }
    }

    return {
      total: allAnomalies.length,
      byType: allAnomalies.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {}),
      recent: allAnomalies.slice(-10),
    };
  }

  // ── File Output ──────────────────────────────────────────────────

  /**
   * Save report to disk
   */
  _saveReport(report, period, now, format) {
    const filename = `${period}_${this._formatTimestamp(now)}.${format}`;
    const filepath = path.join(this.outputDir, filename);

    let content;
    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
    } else if (format === 'md') {
      content = this._renderMarkdown(report);
    }

    fs.writeFileSync(filepath, content);
  }

  /**
   * Render report as Markdown
   */
  _renderMarkdown(report) {
    const r = report;
    let md = '';

    md += `# AV Treasury Sandbox Report — ${r.meta.period.toUpperCase()}\n\n`;
    md += `**Generated:** ${r.meta.generatedAt}  \n`;
    md += `**Data Points:** ${r.meta.dataPoints}  \n`;
    md += `**Time Range:** ${r.meta.timeRange.start} → ${r.meta.timeRange.end}\n\n`;

    md += `---\n\n`;

    // Executive Summary
    md += `## 📊 Executive Summary\n\n`;
    md += `**Status:** ${r.executiveSummary.status}  \n`;
    md += `${r.executiveSummary.summary}\n\n`;

    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Health Score | ${r.executiveSummary.healthScore}/100 |\n`;
    md += `| Au Price | ${r.executiveSummary.auPrice} Ag |\n`;
    md += `| TVL | ${r.executiveSummary.tvl} |\n`;
    md += `| Treasury | ${r.executiveSummary.treasuryBalance} |\n`;
    md += `| Alerts | ${r.executiveSummary.totalAlerts} (${r.executiveSummary.criticalAlerts} critical, ${r.executiveSummary.warningAlerts} warning) |\n\n`;

    // Health Trend
    md += `## 💚 System Health Trend\n\n`;
    md += `- **Current:** ${r.healthTrend.current}/100\n`;
    md += `- **Min/Max:** ${r.healthTrend.min} / ${r.healthTrend.max}\n`;
    md += `- **Average:** ${r.healthTrend.average}\n`;
    md += `- **Trend:** ${r.healthTrend.trend} (${r.healthTrend.change >= 0 ? '+' : ''}${r.healthTrend.change})\n\n`;

    // Token Performance
    md += `## 🪙 Token Performance\n\n`;
    md += `### Au (Utility)\n`;
    md += `- **Price:** ${r.tokenPerformance.au.price} Ag (${r.tokenPerformance.au.priceChange})\n`;
    md += `- **Supply:** ${r.tokenPerformance.au.supply}\n`;
    md += `- **Total Burned:** ${r.tokenPerformance.au.totalBurned}\n\n`;

    md += `### Ag (Governance)\n`;
    md += `- **Supply:** ${r.tokenPerformance.ag.supply}\n`;
    md += `- **Inflation:** ${r.tokenPerformance.ag.inflation}\n\n`;

    // DEX Activity
    md += `## 🔄 DEX Activity\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Ag Reserve | ${r.dexActivity.reserves.ag} |\n`;
    md += `| Au Reserve | ${r.dexActivity.reserves.au} |\n`;
    md += `| TVL | ${r.dexActivity.tvl} |\n`;
    md += `| Volume (Ag) | ${r.dexActivity.volume.ag} |\n`;
    md += `| Volume (Au) | ${r.dexActivity.volume.au} |\n`;
    md += `| Fees (Ag) | ${r.dexActivity.fees.ag} |\n`;
    md += `| Fees (Au) | ${r.dexActivity.fees.au} |\n`;
    md += `| Slippage | ${r.dexActivity.slippage} |\n\n`;

    // Staking
    md += `## 🏦 Staking Metrics\n\n`;
    md += `- **TVL:** ${r.stakingMetrics.tvl.current} (min: ${r.stakingMetrics.tvl.min}, max: ${r.stakingMetrics.tvl.max})\n`;
    md += `- **Au APY:** ${r.stakingMetrics.apy.au}\n`;
    md += `- **Ag APY:** ${r.stakingMetrics.apy.ag}\n`;
    md += `- **Combined APY:** ${r.stakingMetrics.apy.combined}\n`;
    md += `- **Total Staked:** ${r.stakingMetrics.totalStaked}\n\n`;

    // PID
    md += `## 🎛️ PID Controller\n\n`;
    md += `- **Current Error:** ${r.pidPerformance.currentError}\n`;
    md += `- **Target TVL:** ${r.pidPerformance.targetTvl}\n`;
    md += `- **Emission Rate:** ${r.pidPerformance.emissionRate}\n`;
    md += `- **Daily:** ${r.pidPerformance.dailyEmitted} / ${r.pidPerformance.maxDaily}\n\n`;

    // Treasury
    md += `## 💰 Treasury Health\n\n`;
    md += `- **Balance:** ${r.treasuryHealth.balance}\n`;
    md += `- **Runway:** ${r.treasuryHealth.runwayMonths} months\n`;
    md += `- **Buyback Capacity:** ${r.treasuryHealth.buybackCapacity}\n`;
    md += `- **Total Executed:** ${r.treasuryHealth.totalExecuted}\n\n`;

    // Bot Activity
    md += `## 🤖 Bot Activity\n\n`;
    md += `- **Active Bots:** ${r.botActivity.activeCount}\n\n`;
    md += `### Personality Distribution\n\n`;
    md += `| Type | Count | Percentage |\n|------|-------|------------|\n`;
    for (const [type, info] of Object.entries(r.botActivity.personalityDistribution)) {
      md += `| ${type} | ${info.count} | ${info.percentage} |\n`;
    }
    md += '\n';

    // Alerts
    md += `## ⚠️ Alerts Fired\n\n`;
    md += `**Total:** ${r.alertsFired.total} (🔴 ${r.alertsFired.bySeverity.critical} critical, 🟡 ${r.alertsFired.bySeverity.warning} warning, ℹ️ ${r.alertsFired.bySeverity.info} info)\n\n`;

    if (r.alertsFired.recent.length > 0) {
      md += `### Recent Alerts\n\n`;
      md += `| Time | Severity | Type | Message |\n`;
      md += `|------|----------|------|---------|\n`;
      for (const a of r.alertsFired.recent) {
        md += `| ${a.time} | ${a.severity} | ${a.type} | ${a.message} |\n`;
      }
      md += '\n';
    }

    // Anomalies
    md += `## 🔍 Anomalies Detected\n\n`;
    md += `**Total:** ${r.anomalies.total}\n\n`;
    if (r.anomalies.byType && Object.keys(r.anomalies.byType).length > 0) {
      md += `| Type | Count |\n|------|-------|\n`;
      for (const [type, count] of Object.entries(r.anomalies.byType)) {
        md += `| ${type} | ${count} |\n`;
      }
    }

    md += `\n---\n*Report generated by AV Treasury Monitoring System*\n`;

    return md;
  }

  /**
   * Prune old reports for a period
   */
  _pruneOldReports(period) {
    const files = fs.readdirSync(this.outputDir)
      .filter(f => f.startsWith(period + '_'))
      .sort()
      .reverse();

    if (files.length > this.maxReports) {
      for (let i = this.maxReports; i < files.length; i++) {
        fs.unlinkSync(path.join(this.outputDir, files[i]));
      }
    }
  }

  /**
   * Format timestamp for filenames
   */
  _formatTimestamp(ms) {
    return new Date(ms).toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
  }

  /**
   * Get report history
   */
  getHistory() {
    return this.reportHistory;
  }
}

// ── CLI ───────────────────────────────────────────────────────────

if (require.main === module) {
  const AnalyticsEngine = require('./AnalyticsEngine');
  const AlertSystem = require('./AlertSystem');

  const engine = new AnalyticsEngine({
    intervalMs: parseInt(process.env.INTERVAL_MS) || 5000,
  });

  const alertSystem = new AlertSystem(engine);

  const reporter = new Reporter(engine, alertSystem, {
    periods: (process.env.REPORT_PERIODS || '5min,1hr,24hr').split(','),
  });

  // Start
  engine.start()
    .then(() => {
      alertSystem.start();
      reporter.start();
    })
    .catch((err) => {
      console.error(chalk.red('❌ Failed to start:'), err.message);
      process.exit(1);
    });

  // Graceful shutdown
  const shutdown = () => {
    reporter.stop();
    alertSystem.stop();
    engine.stop();
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = Reporter;
