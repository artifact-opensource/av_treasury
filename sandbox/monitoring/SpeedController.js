/**
 * SpeedController — Exponential time compression for sandbox simulation.
 * 
 * Controls the speed multiplier for the simulation, enabling exponential
 * acceleration (1x → 10x → 100x → 1000x → ...) to compress years of
 * blockchain time into minutes of real time.
 * 
 * Architecture:
 *   - Speed multiplier is a governance-controllable parameter
 *   - Each "tick" advances (blocksPerTick * speedMultiplier) blocks
 *   - At high speeds, event sampling replaces per-block logging
 *   - Health score stays readable via time-weighted aggregation
 *   - Emergency brake triggers on regime anomalies
 */

const { EventEmitter } = require('events');
const chalk = require('chalk');

// ─── Speed Presets ────────────────────────────────────────────
const SPEED_PRESETS = {
  REALTIME:    { label: 'REALTIME',    multiplier: 1,       blocksPerTick: 1,    description: '1 block per tick — true real-time' },
  FAST:        { label: 'FAST',        multiplier: 10,      blocksPerTick: 1,    description: '10x — 10 blocks per tick' },
  ACCELERATED: { label: 'ACCELERATED', multiplier: 100,     blocksPerTick: 1,    description: '100x — 100 blocks per tick' },
  FAST_FORWARD: { label: 'FAST_FORWARD', multiplier: 1000,  blocksPerTick: 1,    description: '1000x — 1000 blocks per tick' },
  HYPERSPEED:  { label: 'HYPERSPEED',  multiplier: 10000,   blocksPerTick: 1,    description: '10000x — 10K blocks per tick' },
  WARP:        { label: 'WARP',        multiplier: 100000,  blocksPerTick: 1,    description: '100000x — 100K blocks per tick' },
  LUDICROUS:   { label: 'LUDICROUS',   multiplier: 1000000, blocksPerTick: 1,    description: '1000000x — 1M blocks per tick' },
};

// ─── Default Configuration ────────────────────────────────────
const DEFAULT_CONFIG = {
  initialSpeed: 1,
  maxSpeed: 1000000,
  speedIncrement: 10,        // Each speedup multiplies by 10
  autoThrottle: true,        // Auto-reduce speed on anomaly detection
  throttleThreshold: 0.3,    // Health score below this triggers throttle
  emergencyBrakeThreshold: 0.1, // Health score below this stops simulation
  blockTime: 12,             // Seconds per block (Ethereum default)
  maxBlocksPerTick: 1000000, // Hard cap for safety
  enableEventSampling: true, // At high speeds, sample events instead of catching all
  samplingRate: 0.01,        // At speeds > 10000x, sample 1% of events
  logIntervalMs: 1000,       // How often to emit status logs
};

class SpeedController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...options };
    
    // Speed state
    this.currentSpeed = this.config.initialSpeed;
    this.currentTick = 0;
    this.totalBlocksAdvanced = 0;
    this.startTime = null;
    this.running = false;
    
    // Health monitoring
    this.healthScore = 1.0;
    this.lastHealthScore = 1.0;
    this.healthHistory = [];
    this.anomalyCount = 0;
    this.throttleActive = false;
    
    // Time tracking
    this.simulatedTimeSeconds = 0;  // Total simulated time
    this.simulatedDays = 0;
    
    // Event sampling at high speeds
    this.eventBuffer = [];
    this.sampledEvents = [];
    
    // Speed change history
    this.speedHistory = [];
  }

  // ─── Core: Start Simulation ────────────────────────────────
  start() {
    if (this.running) return this;
    
    this.running = true;
    this.startTime = Date.now();
    
    this.emit('start', {
      speed: this.currentSpeed,
      timestamp: this.startTime,
    });
    
    console.log(chalk.cyan(`\n🚀 SpeedController started at ${this._formatSpeed(this.currentSpeed)}`));
    console.log(chalk.gray(`   Block time: ${this.config.blockTime}s | Max speed: ${this._formatSpeed(this.config.maxSpeed)}`));
    
    return this;
  }

  // ─── Core: Advance Ticks ───────────────────────────────────
  /**
   * Advance the simulation by one tick.
   * Returns the number of blocks to advance and the current speed.
   * 
   * @param {number} [overrideSpeed] — Optional speed override for this tick
   * @returns {{ blocks: number, speed: number, simulatedDays: number }}
   */
  tick(overrideSpeed = null) {
    if (!this.running) {
      throw new Error('SpeedController not started. Call start() first.');
    }
    
    const speed = overrideSpeed || this.currentSpeed;
    const blocks = Math.min(
      speed * this.config.blockTime,  // blocks = speed * (blocks per tick)
      this.config.maxBlocksPerTick
    );
    
    this.currentTick++;
    this.totalBlocksAdvanced += blocks;
    this.simulatedTimeSeconds += blocks * this.config.blockTime;
    this.simulatedDays = this.simulatedTimeSeconds / 86400;
    
    const tickData = {
      tick: this.currentTick,
      blocks,
      speed,
      totalBlocks: this.totalBlocksAdvanced,
      simulatedDays: this.simulatedDays,
      simulatedTimeSeconds: this.simulatedTimeSeconds,
      healthScore: this.healthScore,
      timestamp: Date.now(),
    };
    
    this.emit('tick', tickData);
    return tickData;
  }

  // ─── Speed Control ─────────────────────────────────────────
  /**
   * Set speed directly (clamped to maxSpeed).
   */
  setSpeed(multiplier) {
    const oldSpeed = this.currentSpeed;
    this.currentSpeed = Math.min(Math.max(1, multiplier), this.config.maxSpeed);
    
    this.speedHistory.push({
      tick: this.currentTick,
      from: oldSpeed,
      to: this.currentSpeed,
      timestamp: Date.now(),
    });
    
    this.emit('speedChange', {
      from: oldSpeed,
      to: this.currentSpeed,
      label: this._formatSpeed(this.currentSpeed),
    });
    
    const arrow = this.currentSpeed > oldSpeed ? '⏩' : '⏪';
    const color = this.currentSpeed > oldSpeed ? chalk.yellow : chalk.blue;
    console.log(color(`${arrow} Speed changed: ${this._formatSpeed(oldSpeed)} → ${this._formatSpeed(this.currentSpeed)}`));
    
    return this.currentSpeed;
  }

  /**
   * Speed up by the configured increment (default 10x).
   */
  speedUp() {
    return this.setSpeed(this.currentSpeed * this.config.speedIncrement);
  }

  /**
   * Slow down by the configured increment.
   */
  slowDown() {
    return this.setSpeed(Math.max(1, Math.floor(this.currentSpeed / this.config.speedIncrement)));
  }

  /**
   * Jump to a named preset.
   */
  setPreset(presetName) {
    const preset = SPEED_PRESETS[presetName];
    if (!preset) {
      console.log(chalk.red(`Unknown preset: ${presetName}`));
      console.log(chalk.gray(`Available: ${Object.keys(SPEED_PRESETS).join(', ')}`));
      return this.currentSpeed;
    }
    console.log(chalk.green(`\n🎯 Preset: ${preset.label} — ${preset.description}`));
    return this.setSpeed(preset.multiplier);
  }

  /**
   * List all available presets.
   */
  listPresets() {
    console.log(chalk.cyan('\n📋 Available Speed Presets:'));
    console.log(chalk.gray('─'.repeat(60)));
    for (const [name, preset] of Object.entries(SPEED_PRESETS)) {
      const active = this.currentSpeed === preset.multiplier ? chalk.green(' ← ACTIVE') : '';
      console.log(`  ${chalk.yellow(preset.label.padEnd(14))} ${String(preset.multiplier).padStart(10)}x  ${preset.description}${active}`);
    }
    console.log(chalk.gray('─'.repeat(60)));
    return SPEED_PRESETS;
  }

  // ─── Health-Based Auto-Throttle ────────────────────────────
  /**
   * Update health score and auto-throttle if needed.
   * Called by the monitoring stack on each data collection cycle.
   * 
   * @param {number} score — Current health score (0.0 to 1.0)
   */
  updateHealth(score) {
    this.lastHealthScore = this.healthScore;
    this.healthScore = Math.max(0, Math.min(1, score));
    
    this.healthHistory.push({
      tick: this.currentTick,
      score: this.healthScore,
      speed: this.currentSpeed,
      timestamp: Date.now(),
    });
    
    // Trim history to last 100 entries
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }
    
    // Emergency brake
    if (this.healthScore < this.config.emergencyBrakeThreshold) {
      this.anomalyCount++;
      console.log(chalk.red(`\n🛑 EMERGENCY BRAKE: Health ${this.healthScore.toFixed(2)} < ${this.config.emergencyBrakeThreshold}`));
      this.emit('emergencyBrake', {
        healthScore: this.healthScore,
        speed: this.currentSpeed,
        tick: this.currentTick,
      });
      this.setSpeed(1); // Drop to realtime
      this.throttleActive = true;
      return;
    }
    
    // Auto-throttle
    if (this.config.autoThrottle && !this.throttleActive) {
      if (this.healthScore < this.config.throttleThreshold) {
        this.anomalyCount++;
        const reducedSpeed = Math.max(1, Math.floor(this.currentSpeed / this.config.speedIncrement));
        console.log(chalk.yellow(`\n⚠️  AUTO-THROTTLE: Health ${this.healthScore.toFixed(2)} < ${this.config.throttleThreshold}`));
        console.log(chalk.yellow(`   Reducing speed: ${this._formatSpeed(this.currentSpeed)} → ${this._formatSpeed(reducedSpeed)}`));
        this.setSpeed(reducedSpeed);
        this.throttleActive = true;
        this.emit('throttle', {
          healthScore: this.healthScore,
          previousSpeed: this.currentSpeed,
          newSpeed: reducedSpeed,
        });
      }
    }
    
    // Release throttle if health recovers
    if (this.throttleActive && this.healthScore > this.config.throttleThreshold + 0.1) {
      this.throttleActive = false;
      console.log(chalk.green(`\n✅ Health recovered to ${this.healthScore.toFixed(2)} — throttle released`));
      this.emit('throttleReleased', { healthScore: this.healthScore });
    }
    
    this.emit('healthUpdate', { score: this.healthScore, tick: this.currentTick });
  }

  // ─── Event Sampling (for high-speed modes) ────────────────
  /**
   * Determine if an event should be captured at current speed.
   * At low speeds, capture everything. At high speeds, sample.
   * 
   * @param {string} eventType — Type of event for prioritized sampling
   * @returns {boolean}
   */
  shouldCaptureEvent(eventType = 'default') {
    if (!this.config.enableEventSampling || this.currentSpeed < 10000) {
      return true; // Capture everything at low speeds
    }
    
    // Always capture critical events
    const criticalEvents = [
      'emergencyBrake', 'throttle', 'largeTrade', 'reserveDrift',
      'priceDeviation', 'liquidityCrisis', 'oracleFailure',
    ];
    if (criticalEvents.includes(eventType)) return true;
    
    // Sample other events based on speed-adjusted rate
    const rate = Math.max(0.001, this.config.samplingRate / Math.log10(this.currentSpeed));
    return Math.random() < rate;
  }

  /**
   * Buffer an event for sampling during high-speed simulation.
   */
  bufferEvent(event) {
    this.eventBuffer.push({
      ...event,
      tick: this.currentTick,
      simulatedTime: this.simulatedTimeSeconds,
    });
    
    if (this.eventBuffer.length > 10000) {
      this.eventBuffer = this.eventBuffer.slice(-5000);
    }
  }

  /**
   * Flush buffered events (called periodically at high speeds).
   */
  flushEvents() {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.sampledEvents.push(...events);
    return events;
  }

  // ─── Status & Reporting ────────────────────────────────────
  getStatus() {
    const elapsedReal = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const blocksPerSecond = elapsedReal > 0 ? this.totalBlocksAdvanced / elapsedReal : 0;
    
    return {
      running: this.running,
      currentSpeed: this.currentSpeed,
      speedLabel: this._formatSpeed(this.currentSpeed),
      tick: this.currentTick,
      totalBlocksAdvanced: this.totalBlocksAdvanced,
      simulatedDays: this.simulatedDays,
      simulatedYears: this.simulatedDays / 365,
      simulatedTimeSeconds: this.simulatedTimeSeconds,
      healthScore: this.healthScore,
      throttleActive: this.throttleActive,
      anomalyCount: this.anomalyCount,
      elapsedRealSeconds: elapsedReal,
      blocksPerSecond: Math.round(blocksPerSecond),
      eventBufferSize: this.eventBuffer.length,
      totalSampledEvents: this.sampledEvents.length,
    };
  }

  /**
   * Print a formatted status line.
   */
  printStatus() {
    const s = this.getStatus();
    const speedColor = s.currentSpeed >= 100000 ? chalk.red :
                      s.currentSpeed >= 1000 ? chalk.yellow :
                      s.currentSpeed > 1 ? chalk.cyan : chalk.white;
    
    const healthColor = s.healthScore > 0.7 ? chalk.green :
                        s.healthScore > 0.3 ? chalk.yellow : chalk.red;
    
    console.log(
      chalk.bold(`\n╔══════════════════════════════════════════════════════╗\n`) +
      chalk.bold(`║  SpeedController Status                              ║\n`) +
      chalk.bold(`╠══════════════════════════════════════════════════════╣\n`) +
      `║  Speed:      ${speedColor(s.speedLabel.padEnd(12))}  Tick: ${String(s.tick).padStart(8)}          ║\n` +
      `║  Blocks:     ${String(s.totalBlocksAdvanced).padStart(12)}  (~${s.simulatedDays.toFixed(1)} days)       ║\n` +
      `║  Health:     ${healthColor(s.healthScore.toFixed(2).padStart(12))}  ${s.throttleActive ? '⚠ THROTTLED' : '✅ Normal   '}          ║\n` +
      `║  Real time:  ${String(s.elapsedRealSeconds.toFixed(1) + 's').padStart(12)}  Blocks/s: ${String(s.blocksPerSecond).padStart(8)}     ║\n` +
      chalk.bold(`╚══════════════════════════════════════════════════════╝`)
    );
    
    return s;
  }

  /**
   * Generate a speed report for the simulation.
   */
  generateSpeedReport() {
    const report = {
      summary: {
        totalTicks: this.currentTick,
        totalBlocksAdvanced: this.totalBlocksAdvanced,
        simulatedDays: this.simulatedDays,
        simulatedYears: this.simulatedDays / 365,
        finalSpeed: this.currentSpeed,
        peakSpeed: Math.max(...this.speedHistory.map(h => h.to), this.currentSpeed),
        anomalyCount: this.anomalyCount,
      },
      speedHistory: this.speedHistory,
      healthHistory: this.healthHistory,
      eventStats: {
        buffered: this.eventBuffer.length,
        sampled: this.sampledEvents.length,
      },
    };
    
    this.emit('speedReport', report);
    return report;
  }

  // ─── Lifecycle ─────────────────────────────────────────────
  stop() {
    this.running = false;
    const report = this.generateSpeedReport();
    
    console.log(chalk.cyan(`\n🏁 SpeedController stopped.`));
    console.log(chalk.gray(`   Advanced ${this.totalBlocksAdvanced.toLocaleString()} blocks (~${this.simulatedDays.toFixed(1)} days) in ${this.currentTick} ticks`));
    
    this.emit('stop', report);
    return report;
  }

  reset() {
    this.currentSpeed = this.config.initialSpeed;
    this.currentTick = 0;
    this.totalBlocksAdvanced = 0;
    this.simulatedTimeSeconds = 0;
    this.simulatedDays = 0;
    this.healthScore = 1.0;
    this.lastHealthScore = 1.0;
    this.healthHistory = [];
    this.anomalyCount = 0;
    this.throttleActive = false;
    this.eventBuffer = [];
    this.sampledEvents = [];
    this.speedHistory = [];
    this.startTime = null;
    this.running = false;
    
    this.emit('reset');
    return this;
  }

  // ─── Helpers ───────────────────────────────────────────────
  _formatSpeed(multiplier) {
    if (multiplier >= 1000000) return `${(multiplier / 1000000).toFixed(1)}M×`;
    if (multiplier >= 1000) return `${(multiplier / 1000).toFixed(1)}K×`;
    return `${multiplier}×`;
  }
}

// ─── Convenience: Speed Ramp ─────────────────────────────────
/**
 * Automatically ramp speed up and down based on a schedule.
 * Useful for testing: start slow, ramp up, detect anomalies, throttle, recover.
 * 
 * @param {SpeedController} controller
 * @param {Array<{ atTick: number, action: string, value?: number }>} schedule
 * @returns {function} — Call each tick to apply scheduled changes
 */
function createSpeedRamp(controller, schedule = []) {
  const sorted = [...schedule].sort((a, b) => a.atTick - b.atTick);
  let scheduleIndex = 0;
  
  return function applyRamp() {
    while (scheduleIndex < sorted.length && controller.currentTick >= sorted[scheduleIndex].atTick) {
      const entry = sorted[scheduleIndex];
      switch (entry.action) {
        case 'setSpeed':
          controller.setSpeed(entry.value);
          break;
        case 'speedUp':
          controller.speedUp();
          break;
        case 'slowDown':
          controller.slowDown();
          break;
        case 'setPreset':
          controller.setPreset(entry.value);
          break;
        case 'stop':
          controller.stop();
          break;
      }
      scheduleIndex++;
    }
  };
}

module.exports = {
  SpeedController,
  SPEED_PRESETS,
  DEFAULT_CONFIG,
  createSpeedRamp,
};
