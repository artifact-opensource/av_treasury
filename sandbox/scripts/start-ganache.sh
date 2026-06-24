#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Ganache Virtual Network Launcher
# Spins up a fully confined local testnet with 100 pre-funded bots
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

PORT=8545
HOST=127.0.0.1
NETWORK_ID=1337
CHAIN_ID=1337
BALANCE_HEX="0xBC616EE17D785A00000"  # 1000 ETH in wei
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SANDBOX_DIR="$(dirname "$SCRIPT_DIR")"
LOGFILE="$SANDBOX_DIR/logs/ganache.log"
PIDFILE="$SANDBOX_DIR/logs/ganache.pid"

mkdir -p "$SANDBOX_DIR/logs"

# Kill any existing ganache
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
fi

# Launch ganache with mnemonic for deterministic accounts
ganache \
    --server.host "$HOST" \
    --server.port "$PORT" \
    --chain.chainId "$CHAIN_ID" \
    --wallet.mnemonic "test test test test test test test test test test test junk" \
    --wallet.totalAccounts 100 \
    --wallet.defaultBalance 1000 \
    --chain.hardfork "london" \
    --chain.networkId "$NETWORK_ID" \
    --miner.defaultGasPrice 1000000000 \
    --miner.defaultGasLimit 15000000 \
    --blockTime 0 \
    --database.dbPath "../logs/ganache-db" \
    --logging.verbose false \
    > "$LOGFILE" 2>&1 &

GANACHE_PID=$!
echo "$GANACHE_PID" > "$PIDFILE"

echo "═══════════════════════════════════════════════════════════════"
echo "  Ganache Virtual Network Started"
echo "═══════════════════════════════════════════════════════════════"
echo "  Host:     $HOST:$PORT"
echo "  Chain ID: $CHAIN_ID"
echo "  PID:      $GANACHE_PID"
echo "  Accounts: 100 (1000 ETH each)"
echo "  Log:      $LOGFILE"
echo "═══════════════════════════════════════════════════════════════"

# Wait for ready
for i in $(seq 1 30); do
    if curl -s -X POST -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        "http://$HOST:$PORT" > /dev/null 2>&1; then
        echo "✅ Network ready!"
        exit 0
    fi
    sleep 0.5
done

echo "❌ Ganache failed to start. Check $LOGFILE"
exit 1
