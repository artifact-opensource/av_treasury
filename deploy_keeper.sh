#!/bin/bash
# AV Treasury Keeper — Production Deployment Script
set -e

REPO_DIR="/home/adam/Projects/ARC/av_treasury"
LOG_DIR="/opt/ava/logs/keeper"
PID_FILE="/opt/ava/keeper.pid"

echo "═══ AV Treasury Keeper Deployment ═══"

mkdir -p "$LOG_DIR"

# Load environment
cd "$REPO_DIR"
set -a; source .env; set +a

# Pull latest
echo "[1/3] Pulling latest code..."
git pull --ff-only origin main 2>/dev/null || echo "  (already up to date)"

# Stop existing
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[2/3] Stopping existing keeper (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 2
        kill -9 "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
fi

# Start keeper
echo "[3/3] Starting keeper..."
# Use the keeper's own venv (Python 3.13 with dependencies) — system python3
# lacks the keeper.main module and its deps.
KEEPER_PY="${REPO_DIR}/keeper/venv/bin/python"
if [ ! -x "$KEEPER_PY" ]; then
    echo "⚠️  keeper venv not found at $KEEPER_PY — falling back to system python3"
    KEEPER_PY="python3"
fi
# Package lives at keeper/keeper/ — run as keeper.keeper.main from REPO_DIR.
cd "$REPO_DIR"
nohup "$KEEPER_PY" -u -m keeper.keeper.main run \
    >> "$LOG_DIR/keeper.log" 2>&1 &

NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo ""
echo "✅ Keeper started (PID $NEW_PID)"
echo "   Logs: tail -f $LOG_DIR/keeper.log"
echo "   Stop: kill $NEW_PID"
echo ""

# Quick health check
sleep 3
if kill -0 "$NEW_PID" 2>/dev/null; then
    echo "✅ Process is running"
    tail -5 "$LOG_DIR/keeper.log"
else
    echo "❌ Process died — check logs:"
    tail -20 "$LOG_DIR/keeper.log"
fi
