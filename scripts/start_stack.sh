#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start_stack.sh — robust testnet stack orchestration for av_treasury
#
# Stacks: anvil (persistent state) -> deploy_testnet.js -> JS analytics engine
#   - State persists across restarts via anvil --state (real Foundry persistence)
#   - Stale state (address mismatch) is auto-detected and reset
#   - Engine is launched via hardhat so hre.ethers resolves correctly
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEP="$ROOT/deployments/testnet"
mkdir -p "$DEP/logs" "$DEP/analytics"
STATE="$DEP/chain-state.json"
ADDR="$DEP/addresses.json"
ANVIL_PORT=8545
ANVIL_LOG="$DEP/logs/anvil.log"
ENGINE_LOG="$DEP/logs/engine.log"

# ── 0. kill any stale stack ────────────────────────────────────────────────
pkill -f "anvil" 2>/dev/null || true
pkill -f "deployments/testnet/analytics/engine.js" 2>/dev/null || true
pkill -f "hardhat run.*engine" 2>/dev/null || true
sleep 2

# ── 1. start anvil with persistent state ───────────────────────────────────
# If state file is huge/stale, reset it (anvil will recreate on first dump).
if [ -f "$STATE" ]; then
  # stale-state guard: anvil 1.7.1 writes compact state; a 24MB file predates
  # current contracts -> reset to avoid loading wrong addresses.
  SZ=$(stat -c%s "$STATE" 2>/dev/null || echo 0)
  if [ "$SZ" -gt 2000000 ]; then
    echo "[stack] stale state detected ($SZ bytes) -> resetting"
    rm -f "$STATE"
  fi
fi

echo "[stack] launching anvil on :$ANVIL_PORT (state -> $STATE)"
nohup anvil \
  --port "$ANVIL_PORT" \
  --chain-id 31337 \
  --state "$STATE" \
  --state-interval 1000 \
  --block-time 2 \
  --gas-limit 30000000 \
  > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
echo "[stack] anvil pid=$ANVIL_PID"

# wait for RPC
for i in $(seq 1 30); do
  if curl -s -m 2 -X POST http://localhost:$ANVIL_PORT -H 'Content-Type: application/json' \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
    echo "[stack] anvil RPC up after ${i}s"
    break
  fi
  sleep 1
done

# ── 2. deploy (fresh chain) ────────────────────────────────────────────────
echo "[stack] deploying contracts..."
( cd "$ROOT" && npx hardhat run scripts/deploy_testnet.js --network localhost ) 2>&1 | tail -40

# verify addresses were written
if [ ! -f "$ADDR" ]; then
  echo "[stack] ERROR: deploy did not produce addresses.json"; exit 1
fi
echo "[stack] deploy complete -> $ADDR"

# ── 3. launch engine (via hardhat so hre.ethers resolves) ───────────────────
echo "[stack] launching analytics engine..."
nohup npx hardhat run deployments/testnet/analytics/engine.js --network localhost \
  > "$ENGINE_LOG" 2>&1 &
ENGINE_PID=$!
echo "[stack] engine pid=$ENGINE_PID"

# ── 4. health gate ──────────────────────────────────────────────────────────
sleep 25
echo "[stack] engine log tail:"
tail -12 "$ENGINE_LOG" 2>/dev/null || true

echo "[stack] DONE. anvil=$ANVIL_PID engine=$ENGINE_PID"
echo "[stack] monitor: tail -f $ENGINE_LOG"
echo "[stack] summary: node deployments/testnet/analytics/summary.js"
