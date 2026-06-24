#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * AlertSystem — Anomaly Detection and Alerting
 * ═══════════════════════════════════════════════════════════════════
 *
 * Monitors AnalyticsEngine data for configurable anomaly conditions:
 *   - Au price drop > X% in Y minutes
 *   - Ag inflation rate > X% per day
 *   - TVL drop > X% in Y minutes
 *   - Treasury below X months runway
 *   - PID error > X% for Y consecutive blocks
 *   - DEX slippage > X%
 *   - Unusual bot activity (volume spike, coordinated behavior)
 *   - Staking multiplier centralization (Gini coefficient)
 *
 * Severity levels: INFO, WARNING, CRITICAL
 * Alert history with deduplication
 * Extensible webhook/notification support
 *
 * Usage:
 *   const alerts = new AlertSystem(engine);
 *   alerts.on('alert', (alert) => { ... });
 *   alerts.start();
 */

const chalk = require('chalk');
const { EventEmitter } = require('events');

// ── Default Alert Rules ────────────────────────────────────────────

const DEFAULT_RULES = {
  priceDrop: {
    enabled: true,
    severity: 'WARNING',
    thresholdPercent: 5,        // Alert if price drops > 5%
    windowMinutes: 5,            // Within 5 minutes
    cooldownSeconds: 120,        // Don't re-alert for 2 min
  },
  priceDropCritical: {
    enabled: true,
    severity: 'CRITICAL',
    thresholdPercent: 15,       // Critical if > 15% drop
    windowMinutes: 10,
    cooldownSeconds: 300,
  },
  agInflation: {
    enabled: true,
    severity: 'WARNING',
    thresholdPercentPerDay: 10, // Alert if Ag inflates > 10%/day
    cooldownSeconds: 3600,
  },
  tvlDrop: {
    enabled: true,
    severity: 'WARNING',
    thresholdPercent: 10,       // Alert if TVL drops > 10%
    windowMinutes: 10,
    cooldownSeconds: 300,
  },
  tvlDropCritical: {
    enabled: true,
    severity: 'CRITICAL',
    thresholdPercent: 25,
    windowMinutes: 15,
    cooldownSeconds: 600,
  },
  treasuryRunway: {
    enabled: true,
    severity: 'WARNING',
    thresholdMonths: 6,         // Alert if < 6 months runway
    cooldownSeconds: 1800,
  },
  treasuryRunwayCritical: {
    enabled: true,
    severity: 'CRITICAL',
    thresholdMonths: 3,         // Critical if < 3 months
    cooldownSeconds: 3600,
  },
  pidError: {
    enabled: true,
    severity: 'WARNING',
    thresholdPercent: 10,        // Alert if PID error > 10%
    consecutiveBlocks: 5,        // For 5 consecutive checks
    cooldownSeconds: 300,
  },
  pidErrorCritical: {
    enabled: true,
    severity: 'CRITICAL',
    thresholdPercent: 25,
    consecutiveBlocks: 3,
    cooldownSeconds: 600,
  },
  dexSlippage: {
    enabled: true,
    severity: 'WARNING',
    thresholdPercent: 5,         // Alert if slippage > 5%
    cooldownSeconds: 120,
  },
  dexSlippageCritical: {
    enabled: true,
    severity: 'CRITICAL',
    thresholdPercent: 15,
    cooldownSeconds: 300,
  },
  botVolumeSpike: {
    enabled: true,
    severity: 'WARNING',
    thresholdMultiplier: 3,      // Alert if volume > 3x average
    windowMinutes: 5,
    cooldownSeconds: 300,
  },
  stakingCentralization: {
    enabled: true,
    severity: 'WARNING',
    giniThreshold: 0.8,          // Alert if Gini > 0.8
    cooldownSeconds: 3600,
  },
};

// ── AlertSystem Class ──────────────────────────────────────────────

class AlertSystem extends EventEmitter {
  /**
   * @param {AnalyticsEngine} engine - AnalyticsEngine instance
   * @param {Object} options
   * @param {Object} options.rules - Custom alert rules (merges with defaults)
   * @param {number} options.checkIntervalMs - How often to evaluate rules
   * @param {number} options.maxHistory - Max alerts to keep in history
   */
  constructor(engine, options = {}) {
    super();
    this.engine = engine;
    this.rules = { ...DEFAULT_RULES, ...(options.rules || {}) };
    this.checkIntervalMs = options.checkIntervalMs || 5000;
    this.maxHistory = options.maxHistory || 500;
    this.running = false;
    this.checkTimer = null;

    // Alert history
    this.alertHistory = [];

    // Tracking state for rule evaluation
    this.state = {
      pidErrorConsecutive: 0,
      pidErrorCriticalConsecutive: 0,
      lastAlertTime: {},  // ruleName -> timestamp
      priceWindow: [],    // [{price, timestamp}]
      tvlWindow: [],      // [{tvl, timestamp}]
      volumeWindow: [],   // [{volume, timestamp}]
    };

    // Webhook endpoints (extensible)
    this.webhooks = [];
  }

  /**
   * Add a webhook URL for alert notifications
   * @param {string} url - Webhook endpoint
   * @param {Object} options - { severity: 'WARNING' | 'CRITICAL' }
   */
  addWebhook(url, options = {}) {
    this.webhooks.push({ url, minSeverity: options.minSeverity || 'WARNING' });
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.running) return;
    this.running = true;

    console.log(chalk.green('[AlertSystem] Starting monitoring...'));

    // Listen for data events from engine
    this.engine.on('data', (data) => this.evaluate(data));

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.running = false;
    this.engine.removeAllListeners('data');
    this.emit('stopped');
    console.log(chalk.yellow('[AlertSystem] Stopped'));
  }

  /**
   * Evaluate all rules against current data
   * @param {Object} data - Data point from AnalyticsEngine
   */
  evaluate(data) {
    if (!this.running) return;

    const now = Date.now();

    // Update tracking windows
    this._updateWindows(data, now);

    // Evaluate each rule
    const triggeredAlerts = [];

    // Price drop rules
    if (this.rules.priceDrop.enabled) {
      const alert = this._checkPriceDrop(data, now, this.rules.priceDrop, 'priceDrop');
      if (alert) triggeredAlerts.push(alert);
    }
    if (this.rules.priceDropCritical.enabled) {
      const alert = this._checkPriceDrop(data, now, this.rules.priceDropCritical, 'priceDropCritical');
      if (alert) triggeredAlerts.push(alert);
    }

    // Ag inflation
    if (this.rules.agInflation.enabled) {
      const alert = this._checkAgInflation(data, now);
      if (alert) triggeredAlerts.push(alert);
    }

    // TVL drop
    if (this.rules.tvlDrop.enabled) {
      const alert = this._checkTvlDrop(data, now, this.rules.tvlDrop, 'tvlDrop');
      if (alert) triggeredAlerts.push(alert);
    }
    if (this.rules.tvlDropCritical.enabled) {
      const alert = this._checkTvlDrop(data, now, this.rules.tvlDropCritical, 'tvlDropCritical');
      if (alert) triggeredAlerts.push(alert);
    }

    // Treasury runway
    if (this.rules.treasuryRunway.enabled) {
      const alert = this._checkTreasuryRunway(data, now, this.rules.treasuryRunway, 'treasuryRunway');
      if (alert) triggeredAlerts.push(alert);
    }
    if (this.rules.treasuryRunwayCritical.enabled) {
      const alert = this._checkTreasuryRunway(data, now, this.rules.treasuryRunwayCritical, 'treasuryRunwayCritical');
      if (alert) triggeredAlerts.push(alert);
    }

    // PID error
    if (this.rules.pidError.enabled) {
      const alert = this._checkPidError(data, now, this.rules.pidError, 'pidError');
      if (alert) triggeredAlerts.push(alert);
    }
    if (this.rules.pidErrorCritical.enabled) {
      const alert = this._checkPidError(data, now, this.rules.pidErrorCritical, 'pidErrorCritical');
      if (alert) triggeredAlerts.push(alert);
    }

    // DEX slippage
    if (this.rules.dexSlippage.enabled) {
      const alert = this._checkSlippage(data, now, this.rules.dexSlippage, 'dexSlippage');
      if (alert) triggeredAlerts.push(alert);
    }
    if (this.rules.dexSlippageCritical.enabled) {
      const alert = this._checkSlippage(data, now, this.rules.dexSlippageCritical, 'dexSlippageCritical');
      if (alert) triggeredAlerts.push(alert);
    }

    // Bot volume spike
    if (this.rules.botVolumeSpike.enabled) {
      const alert = this._checkBotVolume(data, now);
      if (alert) triggeredAlerts.push(alert);
    }

    // Staking centralization
    if (this.rules.stakingCentralization.enabled) {
      const alert = this._checkStakingCentralization(data, now);
      if (alert) triggeredAlerts.push(alert);
    }

    // Emit all triggered alerts
    for (const alert of triggeredAlerts) {
      this._fireAlert(alert);
    }
  }

  // ── Rule Evaluation Methods ──────────────────────────────────────

  _checkPriceDrop(data, now, rule, ruleName) {
    const currentPrice = Number(data.token.auPriceInAg) / 1e18;
    if (currentPrice <= 0) return null;

    // Check if price dropped more than threshold in window
    const windowMs = rule.windowMinutes * 60 * 1000;
    const windowStart = now - windowMs;
    const windowPrices = this.state.priceWindow.filter(p => p.timestamp >= windowStart);

    if (windowPrices.length === 0) return null;

    const maxPriceInWindow = Math.max(...windowPrices.map(p => p.price));
    if (maxPriceInWindow <= 0) return null;

    const dropPercent = ((maxPriceInWindow - currentPrice) / maxPriceInWindow) * 100;

    if (dropPercent >= rule.thresholdPercent) {
      return this._createAlert({
        ruleName,
        severity: rule.severity,
        type: 'PRICE_DROP',
        message: `Au price dropped ${dropPercent.toFixed(2)}% in ${rule.windowMinutes}min (from ${maxPriceInWindow.toFixed(6)} to ${currentPrice.toFixed(6)})`,
        value: dropPercent,
        data: { from: maxPriceInWindow, to: currentPrice },
      });
    }
    return null;
  }

  _checkAgInflation(data, now) {
    const rule = this.rules.agInflation;
    const history = this.engine.getHistory({ limit: 1000 });
    if (history.length < 2) return null;

    // Find data point from ~24h ago (or earliest available)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneDayAgo = now - oneDayMs;
    const oldData = history.find(d => d.timestamp <= oneDayAgo) || history[0];

    const oldSupply = Number(oldData.token.agSupply) / 1e18;
    const newSupply = Number(data.token.agSupply) / 1e18;

    if (oldSupply <= 0) return null;

    const inflationPercent = ((newSupply - oldSupply) / oldSupply) * 100;

    if (inflationPercent >= rule.thresholdPercentPerDay) {
      return this._createAlert({
        ruleName: 'agInflation',
        severity: rule.severity,
        type: 'AG_INFLATION',
        message: `Ag inflation: ${inflationPercent.toFixed(2)}% (supply: ${oldSupply.toFixed(0)} → ${newSupply.toFixed(0)})`,
        value: inflationPercent,
        data: { oldSupply, newSupply },
      });
    }
    return null;
  }

  _checkTvlDrop(data, now, rule, ruleName) {
    const currentTvl = Number(data.staking.tvl) / 1e18;
    if (currentTvl <= 0) return null;

    const windowMs = rule.windowMinutes * 60 * 1000;
    const windowStart = now - windowMs;
    const windowTvls = this.state.tvlWindow.filter(t => t.timestamp >= windowStart);

    if (windowTvls.length === 0) return null;

    const maxTvl = Math.max(...windowTvls.map(t => t.tvl));
    if (maxTvl <= 0) return null;

    const dropPercent = ((maxTvl - currentTvl) / maxTvl) * 100;

    if (dropPercent >= rule.thresholdPercent) {
      return this._createAlert({
        ruleName,
        severity: rule.severity,
        type: 'TVL_DROP',
        message: `TVL dropped ${dropPercent.toFixed(2)}% in ${rule.windowMinutes}min (${maxTvl.toFixed(2)} → ${currentTvl.toFixed(2)})`,
        value: dropPercent,
        data: { from: maxTvl, to: currentTvl },
      });
    }
    return null;
  }

  _checkTreasuryRunway(data, now, rule, ruleName) {
    const runway = data.treasury.runwayMonths;

    if (runway < rule.thresholdMonths) {
      return this._createAlert({
        ruleName,
        severity: rule.severity,
        type: 'LOW_RUNWAY',
        message: `Treasury runway: ${runway.toFixed(1)} months (threshold: ${rule.thresholdMonths})`,
        value: runway,
        data: { runway, threshold: rule.thresholdMonths },
      });
    }
    return null;
  }

  _checkPidError(data, now, rule, ruleName) {
    const errorPct = Math.abs(data.pid.errorPercent);

    if (errorPct >= rule.thresholdPercent / 100) {
      // Track consecutive blocks
      if (ruleName === 'pidError') {
        this.state.pidErrorConsecutive++;
        this.state.pidErrorCriticalConsecutive = 0;
      } else {
        this.state.pidErrorCriticalConsecutive++;
        this.state.pidErrorConsecutive = 0;
      }

      const consecutive = ruleName === 'pidError'
        ? this.state.pidErrorConsecutive
        : this.state.pidErrorCriticalConsecutive;

      if (consecutive >= rule.consecutiveBlocks) {
        return this._createAlert({
          ruleName,
          severity: rule.severity,
          type: 'PID_ERROR',
          message: `PID error ${(errorPct * 100).toFixed(2)}% for ${consecutive} consecutive checks`,
          value: errorPct,
          data: { error: errorPct, consecutive },
        });
      }
    } else {
      // Reset counters
      this.state.pidErrorConsecutive = 0;
      this.state.pidErrorCriticalConsecutive = 0;
    }
    return null;
  }

  _checkSlippage(data, now, rule, ruleName) {
    const slippage = data.dex.slippagePercent;

    if (slippage >= rule.thresholdPercent) {
      return this._createAlert({
        ruleName,
        severity: rule.severity,
        type: 'HIGH_SLIPPAGE',
        message: `DEX slippage: ${slippage.toFixed(2)}% (threshold: ${rule.thresholdPercent}%)`,
        value: slippage,
        data: { slippage },
      });
    }
    return null;
  }

  _checkBotVolume(data, now) {
    const rule = this.rules.botVolumeSpike;
    const windowMs = rule.windowMinutes * 60 * 1000;
    const windowStart = now - windowMs;

    const recentVolumes = this.state.volumeWindow.filter(v => v.timestamp >= windowStart);
    if (recentVolumes.length < 3) return null;

    const avgVolume = recentVolumes.reduce((sum, v) => sum + v.volume, 0) / recentVolumes.length;
    if (avgVolume <= 0) return null;

    // Current volume (sum of all trade types)
    const currentVolume = Object.values(data.bot.tradeVolumeByType).reduce(
      (sum, val) => sum + Number(val) / 1e18, 0
    );

    const multiplier = currentVolume / avgVolume;

    if (multiplier >= rule.thresholdMultiplier) {
      return this._createAlert({
        ruleName: 'botVolumeSpike',
        severity: rule.severity,
        type: 'BOT_VOLUME_SPIKE',
        message: `Bot volume ${multiplier.toFixed(1)}x average (${currentVolume.toFixed(2)} vs avg ${avgVolume.toFixed(2)})`,
        value: multiplier,
        data: { current: currentVolume, average: avgVolume },
      });
    }
    return null;
  }

  _checkStakingCentralization(data, now) {
    const rule = this.rules.stakingCentralization;
    // Calculate Gini coefficient from personality distribution
    const dist = data.bot.personalityDistribution;
    const values = Object.values(dist).sort((a, b) => a - b);

    if (values.length === 0) return null;

    const gini = this._giniCoefficient(values);

    if (gini >= rule.giniThreshold) {
      return this._createAlert({
        ruleName: 'stakingCentralization',
        severity: rule.severity,
        type: 'STAKING_CENTRALIZATION',
        message: `Staking centralization high (Gini: ${gini.toFixed(3)})`,
        value: gini,
        data: { gini, distribution: dist },
      });
    }
    return null;
  }

  // ── Alert Management ─────────────────────────────────────────────

  _createAlert(alert) {
    return {
      ...alert,
      id: `${alert.type}_${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Fire an alert: deduplicate, store, emit, notify
   */
  _fireAlert(alert) {
    // Check cooldown
    const lastTime = this.state.lastAlertTime[alert.ruleName] || 0;
    const rule = this.rules[alert.ruleName];
    const cooldownMs = (rule?.cooldownSeconds || 60) * 1000;

    if (alert.timestamp - lastTime < cooldownMs) {
      return; // Still in cooldown
    }

    // Update last alert time
    this.state.lastAlertTime[alert.ruleName] = alert.timestamp;

    // Store in history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.shift();
    }

    // Emit event
    this.emit('alert', alert);

    // Console output
    this._logAlert(alert);

    // Webhook notifications
    this._sendWebhook(alert);
  }

  /**
   * Log alert to console with colors
   */
  _logAlert(alert) {
    const prefix = {
      INFO: chalk.blue('ℹ️ '),
      WARNING: chalk.yellow('⚠️ '),
      CRITICAL: chalk.red('🔴'),
    }[alert.severity] || chalk.white('•');

    const severityColor = {
      INFO: chalk.blue,
      WARNING: chalk.yellow,
      CRITICAL: chalk.red.bold,
    }[alert.severity] || chalk.white;

    const time = new Date(alert.timestamp).toLocaleTimeString();
    console.log(`${prefix} ${chalk.gray(time)} ${severityColor(`[${alert.severity}]`)} ${alert.message}`);
  }

  /**
   * Send alert to registered webhooks
   */
  async _sendWebhook(alert) {
    for (const webhook of this.webhooks) {
      // Check severity threshold
      const severityOrder = { INFO: 0, WARNING: 1, CRITICAL: 2 };
      if (severityOrder[alert.severity] < severityOrder[webhook.minSeverity]) continue;

      try {
        // Use fetch if available (Node 18+), otherwise skip
        if (typeof fetch !== 'undefined') {
          await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          });
        }
      } catch (err) {
        // Webhook failures are non-critical
        this.emit('webhookError', { url: webhook.url, error: err.message });
      }
    }
  }

  // ── Tracking Window Updates ──────────────────────────────────────

  _updateWindows(data, now) {
    const price = Number(data.token.auPriceInAg) / 1e18;
    const tvl = Number(data.staking.tvl) / 1e18;

    this.state.priceWindow.push({ price, timestamp: now });
    this.state.tvlWindow.push({ tvl, timestamp: now });

    // Keep only last 24h of data
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    this.state.priceWindow = this.state.priceWindow.filter(p => p.timestamp >= oneDayAgo);
    this.state.tvlWindow = this.state.tvlWindow.filter(t => t.timestamp >= oneDayAgo);
  }

  // ── Utility ──────────────────────────────────────────────────────

  /**
   * Calculate Gini coefficient for an array of values
   */
  _giniCoefficient(values) {
    const n = values.length;
    if (n === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;

    let sumWeighted = 0;
    for (let i = 0; i < n; i++) {
      sumWeighted += values[i] * (i + 1);
    }

    return (2 * sumWeighted) / (n * sum) - (n + 1) / n;
  }

  /**
   * Get alert history
   */
  getHistory(options = {}) {
    let result = this.alertHistory;
    if (options.since) {
      result = result.filter(a => a.timestamp >= options.since);
    }
    if (options.severity) {
      result = result.filter(a => a.severity === options.severity);
    }
    if (options.limit) {
      result = result.slice(-options.limit);
    }
    return result;
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const total = this.alertHistory.length;
    const bySeverity = {
      INFO: this.alertHistory.filter(a => a.severity === 'INFO').length,
      WARNING: this.alertHistory.filter(a => a.severity === 'WARNING').length,
      CRITICAL: this.alertHistory.filter(a => a.severity === 'CRITICAL').length,
    };
    const byType = this.alertHistory.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {});

    return { total, bySeverity, byType };
  }

  /**
   * Update rules at runtime
   */
  updateRules(rules) {
    Object.assign(this.rules, rules);
  }
}

// ── CLI ───────────────────────────────────────────────────────────

if (require.main === module) {
  const AnalyticsEngine = require('./AnalyticsEngine');

  const engine = new AnalyticsEngine({
    intervalMs: parseInt(process.env.INTERVAL_MS) || 5000,
  });

  const alertSystem = new AlertSystem(engine, {
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS) || 5000,
  });

  // Start
  engine.start()
    .then(() => alertSystem.start())
    .catch((err) => {
      console.error(chalk.red('❌ Failed to start:'), err.message);
      process.exit(1);
    });

  // Graceful shutdown
  const shutdown = () => {
    alertSystem.stop();
    engine.stop();
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = AlertSystem;
