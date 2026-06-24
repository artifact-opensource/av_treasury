/**
 * SimulationBridge — Connects the JS monitoring stack to the Python simulator.
 * 
 * Architecture:
 *   1. Python simulator runs forge tests with speed multiplier as env var
 *   2. JS SpeedController manages the speed ramp schedule
 *   3. AnalyticsEngine processes results in real-time
 *   4. Dashboard renders the state
 *   5. AlertSystem triggers on anomalies → SpeedController auto-throttles
 * 
 * Usage:
 *   node monitoring/SimulationBridge.js --days 365 --max-speed 1000000
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { SpeedController, createSpeedRamp } = require('./SpeedController');
const { AnalyticsEngine } = require('./AnalyticsEngine');
const { AlertSystem } = require('./AlertSystem');

const args = process.argv.slice(2);

// ─── Configuration ───────────────────────────────────────────
const CONFIG = {
  days: parseInt(args.find(a => a.startsWith('--days'))?.split('=')[1] || 365),
  maxSpeed: parseInt(args.find(a => a.startsWith('--max-speed'))?.split('=')[1] || 1000000),
  outputDir: args.find(a => a.startsWith('--output'))?.split('=')[1] || './simulation_results',
  forgeProfile: 'sandbox',
  tickDurationMs: 100,  // How long each tick takes in real time
  speedRampSchedule: [
    // Start slow for calibration
    { atTick: 0,   action: 'setPreset', value: 'REALTIME' },
    // Ramp up through the gears
    { atTick: 10,  action: 'setPreset', value: 'FAST' },
    { atTick: 50,  action: 'setPreset', value: 'ACCELERATED' },
    { atTick: 100, action: 'setPreset', value: 'FAST_FORWARD' },
    { atTick: 200, action: 'setPreset', value: 'HYPERSPEED' },
    { atTick: 500, action: 'setPreset', value: 'WARP' },
    // Hold at WARP unless health degrades
    // If health is good at tick 1000, go LUDICROUS
    { atTick: 1000, action: 'setPreset', value: 'LUDICROUS' },
  ],
};

// ─── Main Simulation Loop ───────────────────────────────────
async function runSimulation() {
  console.log('═'.repeat(70));
  console.log('  SANDBOX SIMULATION — Exponential Time Compression');
  console.log('═'.repeat(70));
  console.log(`  Target: ${CONFIG.days} simulated days`);
  console.log(`  Max speed: ${CONFIG.maxSpeed}x`);
  console.log(`  Output: ${CONFIG.outputDir}`);
  console.log('═'.repeat(70));

  // Initialize components
  const speed = new SpeedController({
    initialSpeed: 1,
    maxSpeed: CONFIG.maxSpeed,
    autoThrottle: true,
    enableEventSampling: true,
  });

  const analytics = new AnalyticsEngine({
    windowSize: 50,
    anomalyThreshold: 2.5,
  });

  const alerts = new AlertSystem({
    silent: false,
  });

  // Wire up events
  speed.on('healthUpdate', (data) => {
    analytics.recordHealth(data.score, data.tick);
  });

  speed.on('emergencyBrake', (data) => {
    alerts.raise('EMERGENCY', `Health degraded to ${data.healthScore.toFixed(2)} — simulation throttled to realtime`);
  });

  speed.on('throttle', (data) => {
    alerts.raise('WARNING', `Auto-throttle engaged at health ${data.healthScore.toFixed(2)}`);
  });

  // Create speed ramp
  const applyRamp = createSpeedRamp(speed, CONFIG.speedRampSchedule);

  // Start
  speed.start();

  // Simulation loop
  const targetDays = CONFIG.days;
  let lastLog = Date.now();
  let results = [];

  while (speed.simulatedDays < targetDays && speed.running) {
    // Apply scheduled speed changes
    applyRamp();

    // Advance one tick
    const tickData = speed.tick();

    // Calculate simulated health (placeholder — real implementation
    // would read state from the forge test output)
    const health = calculateSimulatedHealth(tickData, analytics);
    speed.updateHealth(health);

    // Analytics
    analytics.recordTick(tickData);

    // Event sampling at high speeds
    if (speed.currentSpeed >= 10000) {
      if (Math.random() < 0.01) {
        speed.bufferEvent({
          type: 'sample',
          tick: tickData.tick,
          health,
          speed: speed.currentSpeed,
        });
      }
    }

    // Log periodically
    if (Date.now() - lastLog > 2000) {
      speed.printStatus();
      lastLog = Date.now();
    }

    // Emergency stop check
    if (speed.healthScore < 0.05) {
      console.log('\n🛑 CRITICAL: Health collapsed. Stopping simulation.');
      break;
    }

    // Small real-time delay to prevent CPU saturation
    // At high speeds, this is the only thing limiting the simulation
    await sleep(CONFIG.tickDurationMs);
  }

  // Stop and report
  const report = speed.stop();
  
  // Write results
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const reportPath = path.join(CONFIG.outputDir, 'speed_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  const analyticsPath = path.join(CONFIG.outputDir, 'analytics.json');
  fs.writeFileSync(analyticsPath, JSON.stringify(analytics.getFullReport(), null, 2));

  console.log(`\n📊 Results written to ${CONFIG.outputDir}/`);
  console.log(`   Speed report: ${reportPath}`);
  console.log(`   Analytics: ${analyticsPath}`);

  return report;
}

// ─── Simulated Health Calculation ────────────────────────────
/**
 * In production, this reads actual contract state from the forge runner.
 * For now, uses a stochastic model with regime changes.
 */
function calculateSimulatedHealth(tickData, analytics) {
  const { simulatedDays, tick, speed } = tickData;
  
  // Base health decays slowly over time (simulating real system stress)
  let health = 1.0 - (simulatedDays / 3650) * 0.1; // ~10% decay per 10 years
  
  // Random walk
  health += (Math.random() - 0.5) * 0.02;
  
  // Regime changes (simulate black swan events)
  if (Math.random() < 0.0001) {
    health -= 0.3; // Rare shock
  }
  
  // Speed stress: very high speeds can destabilize (modeling risk)
  if (speed > 100000) {
    health -= 0.001 * Math.log10(speed / 100000);
  }
  
  // Recovery tendency (system self-corrects)
  health += 0.001;
  
  return Math.max(0, Math.min(1, health));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── CLI ─────────────────────────────────────────────────────
if (require.main === module) {
  runSimulation().catch(err => {
    console.error('Simulation failed:', err);
    process.exit(1);
  });
}

module.exports = { runSimulation, CONFIG };
