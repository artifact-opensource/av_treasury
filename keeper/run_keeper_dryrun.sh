#!/usr/bin/env bash
# Safe keeper launcher — DRY RUN (no on-chain broadcasting).
# Uses keeper/.env (fixed RPC list) via keeper's own load_dotenv.
# Run from repo root: ./keeper/run_keeper_dryrun.sh
set -u
cd "$(dirname "$0")/.."   # -> /home/adam/Projects/ARC/av_treasury
cd keeper
exec ./venv/bin/python -u -m keeper.main run --dry-run >> /opt/ava/logs/keeper/keeper.dryrun.log 2>&1
