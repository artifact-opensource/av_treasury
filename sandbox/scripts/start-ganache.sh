#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Anvil Virtual Network Launcher
# Spins up a fully confined local testnet with 100 pre-funded bots
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail
export PATH="/home/adam/.foundry/bin:$PATH"

PORT=8545
HOST=127.0.0.1
NETWORK_ID=1337
CHAIN_ID=1337
BALANCE_HEX="0xBC616EE17D785A00000"  # 1000 ETH in wei
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SANDBOX_DIR="$(dirname "$SCRIPT_DIR")"
LOGFILE="$SANDBOX_DIR/logs/anvil.log"
PIDFILE="$SANDBOX_DIR/logs/anvil.pid"

mkdir -p "$SANDBOX_DIR/logs"

# Kill any existing anvil
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
fi

# Launch anvil with mnemonic for deterministic accounts
anvil \
    --host "$HOST" \
    --port "$PORT" \
    --chain-id "$CHAIN_ID" \
    --mnemonic "test test test test test test test test test test test junk" \
    --accounts 100 \
    --balance 1000 \
    --block-time 1 \
    --hardfork istanbul \
    > "$LOGFILE" 2>&1 &

ANVIL_PID=$!
echo "$ANVIL_PID" > "$PIDFILE"

echo "═══════════════════════════════════════════════════════════════"
echo "  Anvil Virtual Network Started"
echo "═══════════════════════════════════════════════════════════════"
echo "  Host:     $HOST:$PORT"
echo "  Chain ID: $CHAIN_ID"
echo "  PID:      $ANVIL_PID"
echo "  Accounts: 100 (1000 ETH each)"
echo "  Log:      $LOGFILE"
echo "═══════════════════════════════════════════════════════════════"

# Wait for ready
for i in $(seq 1 60); do
    if curl -s -X POST -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        "http://$HOST:$PORT" > /dev/null 2>&1; then
        echo "Network ready!"
        exit 0
    fi
    sleep 0.5
done

echo "Anvil failed to start. Check $LOGFILE"
exit 1
