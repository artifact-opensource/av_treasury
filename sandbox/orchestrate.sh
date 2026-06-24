#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Sandbox Orchestrator — One command to rule them all
#
# Usage:
#   ./sandbox/orchestrate.sh start      # Start ganache + deploy + bots
#   ./sandbox/orchestrate.sh stop       # Kill everything
#   ./sandbox/orchestrate.sh status     # Check what's running
#   ./sandbox/orchestrate.sh stress     # Run stress test
#   ./sandbox/orchestrate.sh full       # Full cycle: start → trade → stress → report
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$ROOT/sandbox"
LOGS="$SANDBOX/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[orchestrate]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err() { echo -e "${RED}[err]${NC} $1"; }

compile() {
  log "Compiling sandbox contracts with Foundry..."
  cd "$ROOT"
  forge build --contracts sandbox/contracts --out-path artifacts/sandbox 2>&1
  if [ $? -eq 0 ]; then
    success "Contracts compiled to artifacts/sandbox/"
  else
    # Fallback: compile individual contracts
    warn "Trying individual compilation..."
    mkdir -p artifacts/sandbox
    for f in sandbox/contracts/*.sol; do
      name=$(basename "$f" .sol)
      forge compile "$f" --out-path "artifacts/sandbox" 2>&1
    done
    success "Contracts compiled individually"
  fi
}

start_ganache() {
  log "Starting ganache..."
  mkdir -p "$LOGS"
  bash "$SANDBOX/scripts/start-ganache.sh"
  success "Ganache running on 127.0.0.1:8545"
}

deploy() {
  log "Compiling and deploying full DAO system..."
  cd "$ROOT"
  
  # Compile sandbox contracts
  forge build --contracts sandbox/contracts --out-path artifacts/sandbox 2>&1 || true
  
  # Deploy everything (tokens + DEX + LP + staking + PID + AMO + governor)
  node "$SANDBOX/scripts/deploy-sandbox.js"
  success "Full DAO deployed (8 contracts + 100 bots funded)"
}

start_bots() {
  log "Starting 100 trading bots..."
  cd "$ROOT"
  nohup node "$SANDBOX/bots/BotEngine.js" > "$LOGS/bot-engine.log" 2>&1 &
  echo $! > "$LOGS/bot-engine.pid"
  success "Bot engine PID: $(cat "$LOGS/bot-engine.pid")"
}

start_dashboard() {
  log "Starting monitoring dashboard..."
  cd "$ROOT"
  nohup node "$SANDBOX/monitoring/index.js" --dashboard --alerts --report > "$LOGS/dashboard.log" 2>&1 &
  echo $! > "$LOGS/dashboard.pid"
  success "Dashboard PID: $(cat "$LOGS/dashboard.pid")"
}

stop_all() {
  log "Stopping all sandbox processes..."
  
  for pidfile in "$LOGS"/ganache.pid "$LOGS"/bot-engine.pid "$LOGS"/dashboard.pid; do
    if [ -f "$pidfile" ]; then
      pid=$(cat "$pidfile")
      kill "$pid" 2>/dev/null || true
      rm -f "$pidfile"
      success "Killed PID $pid"
    fi
  done
  
  # Fallback: kill by port
  lsof -ti:8545 2>/dev/null | xargs kill 2>/dev/null || true
  success "All stopped"
}

status() {
  echo "═══════════════════════════════════════"
  echo "  SANDBOX STATUS"
  echo "═══════════════════════════════════════"
  
  # Check ganache
  if curl -s -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://127.0.0.1:8545 > /dev/null 2>&1; then
    block=$(curl -s -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://127.0.0.1:8545 | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
    success "Ganache: RUNNING (block $block)"
  else
    err "Ganache: STOPPED"
  fi
  
  # Check bot engine
  if [ -f "$LOGS/bot-engine.pid" ] && kill -0 "$(cat "$LOGS/bot-engine.pid")" 2>/dev/null; then
    success "BotEngine: RUNNING (PID $(cat "$LOGS/bot-engine.pid"))"
  else
    err "BotEngine: STOPPED"
  fi
  
  # Check dashboard
  if [ -f "$LOGS/dashboard.pid" ] && kill -0 "$(cat "$LOGS/dashboard.pid")" 2>/dev/null; then
    success "Dashboard: RUNNING (PID $(cat "$LOGS/dashboard.pid"))"
  else
    err "Dashboard: STOPPED"
  fi
  
  # Check deployed contracts
  if [ -f "$SANDBOX/config/deployed.json" ]; then
    success "Contracts: DEPLOYED"
    cat "$SANDBOX/config/deployed.json" | head -8
  else
    warn "Contracts: NOT DEPLOYED"
  fi
}

run_stress() {
  local mode="${1:-normal}"
  log "Running stress test: $mode"
  cd "$ROOT"
  STRESS_MODE="$mode" node "$SANDBOX/scripts/stress-test.js" "$mode"
}

run_full() {
  log "🚀 FULL CYCLE: Start → Trade → Stress → Report"
  echo ""
  
  start_ganache
  sleep 2
  deploy
  echo ""
  
  start_bots
  start_dashboard
  echo ""
  
  log "⏳ Letting bots trade for 30 seconds..."
  sleep 30
  echo ""
  
  run_stress "crash"
  echo ""
  sleep 5
  
  run_stress "squeeze"
  echo ""
  sleep 5
  
  run_stress "onesided"
  echo ""
  
  log "📊 Generating report..."
  if [ -f "$LOGS/bot-metrics.json" ]; then
    cat "$LOGS/bot-metrics.json" | python3 -m json.tool 2>/dev/null || cat "$LOGS/bot-metrics.json"
  fi
  
  success "Full cycle complete!"
}

# ─── CLI ─────────────────────────────────────────────────────
case "${1:-help}" in
  start)
    start_ganache
    deploy
    start_bots
    start_dashboard
    success "🎉 Sandbox fully operational!"
    ;;
  stop)
    stop_all
    ;;
  status)
    status
    ;;
  stress)
    run_stress "${2:-normal}"
    ;;
  full)
    run_full
    ;;
  deploy)
    deploy
    ;;
  bots)
    start_bots
    ;;
  monitor)
    start_dashboard
    ;;
  *)
    echo "Usage: $0 {start|stop|status|stress <mode>|full|deploy|bots|monitor}"
    echo ""
    echo "Modes for stress: crash, squeeze, drain, flywheel, deathspiral"
    exit 1
    ;;
esac
