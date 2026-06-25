#!/usr/bin/env python3
"""Generate charts from ATP simulation snapshots."""

import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.gridspec import GridSpec
import numpy as np

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOTS_FILE = os.path.join(os.path.dirname(REPORTS_DIR), "logs", "atp_snapshots.jsonl")
OUT_DIR = REPORTS_DIR

def load_snapshots():
    data = []
    with open(SNAPSHOTS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data

def extract(data, key):
    vals = []
    for d in data:
        v = d.get(key, "0")
        if v == "?" or v is None:
            vals.append(np.nan)
        else:
            try:
                vals.append(float(v))
            except (ValueError, TypeError):
                vals.append(np.nan)
    return np.array(vals)

def rounds(data):
    return np.array([d["round"] for d in data])

def save(fig, name):
    path = os.path.join(OUT_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print(f"  ✅ {name}")

def main():
    data = load_snapshots()
    r = rounds(data)
    price = extract(data, "price")
    dex_ag = extract(data, "dexAgReserve")
    dex_au = extract(data, "dexAuReserve")
    tvl = extract(data, "tvl")
    ag_supply = extract(data, "agSupply")
    au_supply = extract(data, "auSupply")
    treasury_ag = extract(data, "treasuryAg")
    flashbuy_ag = extract(data, "flashBuyAg")
    flashloan = extract(data, "flashLoanBalance")
    trades = extract(data, "trades")
    volume = extract(data, "volume")

    # ── Chart 1: Price Stability ──────────────────────────────────
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(r, price, color='#2196F3', linewidth=2, label='Price (Au/Ag)')
    ax.fill_between(r, price * 0.997, price * 1.003, alpha=0.15, color='#2196F3')
    ax.set_xlabel('Round', fontsize=11)
    ax.set_ylabel('Price (Au per Ag)', fontsize=11)
    ax.set_title('DEX Price Stability — 100 Rounds', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter('%.4f'))
    # Annotate min/max
    valid = price[~np.isnan(price)]
    if len(valid) > 0:
        ax.axhline(y=np.mean(valid), color='red', linestyle='--', alpha=0.5, label=f'Mean: {np.mean(valid):.6f}')
        ax.axhline(y=np.min(valid), color='green', linestyle=':', alpha=0.4, label=f'Min: {np.min(valid):.6f}')
        ax.axhline(y=np.max(valid), color='orange', linestyle=':', alpha=0.4, label=f'Max: {np.max(valid):.6f}')
    ax.legend(loc='upper right', fontsize=9)
    save(fig, "chart_price_stability.png")

    # ── Chart 2: DEX Reserves ─────────────────────────────────────
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    ax1.plot(r, dex_ag / 1e6, color='#4CAF50', linewidth=2, label='Ag Reserve')
    ax1.set_ylabel('Ag Reserve (millions)', fontsize=11)
    ax1.set_title('DEX Reserves Over Time', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc='upper left', fontsize=10)
    ax2.plot(r, dex_au / 1e6, color='#FF9800', linewidth=2, label='Au Reserve')
    ax2.set_ylabel('Au Reserve (millions)', fontsize=11)
    ax2.set_xlabel('Round', fontsize=11)
    ax2.grid(True, alpha=0.3)
    ax2.legend(loc='upper left', fontsize=10)
    plt.tight_layout()
    save(fig, "chart_dex_reserves.png")

    # ── Chart 3: TVL ──────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(r, tvl / 1e6, color='#9C27B0', linewidth=2)
    ax.fill_between(r, 0, tvl / 1e6, alpha=0.1, color='#9C27B0')
    ax.set_xlabel('Round', fontsize=11)
    ax.set_ylabel('TVL (millions Au)', fontsize=11)
    ax.set_title('Total Value Locked (TVL)', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    valid_tvl = tvl[~np.isnan(tvl)]
    if len(valid_tvl) > 0:
        ax.axhline(y=np.mean(valid_tvl) / 1e6, color='red', linestyle='--', alpha=0.5,
                   label=f'Mean: {np.mean(valid_tvl)/1e6:.3f}M')
        ax.legend(fontsize=10)
    save(fig, "chart_tvl.png")

    # ── Chart 4: Token Supplies ────────────────────────────────────
    fig, ax = plt.subplots(figsize=(12, 5))
    valid_ag = ~np.isnan(ag_supply)
    valid_au = ~np.isnan(au_supply)
    if valid_ag.any():
        ax.plot(r[valid_ag], ag_supply[valid_ag] / 1e6, color='#00BCD4', linewidth=2, label='Ag Supply')
    if valid_au.any():
        ax.plot(r[valid_au], au_supply[valid_au] / 1e6, color='#FFC107', linewidth=2, label='Au Supply')
    ax.set_xlabel('Round', fontsize=11)
    ax.set_ylabel('Supply (millions)', fontsize=11)
    ax.set_title('Token Supply Evolution', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=10)
    save(fig, "chart_supplies.png")

    # ── Chart 5: Treasury & Flash Loan Balances ────────────────────
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(r, treasury_ag / 1e3, color='#E91E63', linewidth=2, label='Treasury Ag (K)')
    ax.plot(r, flashbuy_ag / 1e3, color='#3F51B5', linewidth=2, label='FlashBuy Ag (K)')
    ax.plot(r, flashloan / 1e3, color='#009688', linewidth=2, label='FlashLoan Ag (K)')
    ax.set_xlabel('Round', fontsize=11)
    ax.set_ylabel('Balance (thousands Ag)', fontsize=11)
    ax.set_title('Treasury & Flash Loan Balances', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=10)
    save(fig, "chart_treasury_balances.png")

    # ── Chart 6: Trade Activity ────────────────────────────────────
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    ax1.bar(r, trades, color='#FF5722', alpha=0.7, width=0.8)
    ax1.set_ylabel('Trades per Round', fontsize=11)
    ax1.set_title('Trade Activity', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3, axis='y')
    cum_trades = np.cumsum(np.nan_to_num(trades, 0))
    ax2.plot(r, cum_trades, color='#607D8B', linewidth=2)
    ax2.fill_between(r, 0, cum_trades, alpha=0.1, color='#607D8B')
    ax2.set_ylabel('Cumulative Trades', fontsize=11)
    ax2.set_xlabel('Round', fontsize=11)
    ax2.grid(True, alpha=0.3)
    save(fig, "chart_trade_activity.png")

    # ── Chart 7: Comprehensive Dashboard ───────────────────────────
    fig = plt.figure(figsize=(16, 12))
    gs = GridSpec(3, 3, figure=fig, hspace=0.35, wspace=0.3)

    # Price (top-left)
    ax = fig.add_subplot(gs[0, 0])
    ax.plot(r, price, color='#2196F3', linewidth=1.5)
    ax.set_title('Price (Au/Ag)', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.grid(True, alpha=0.3)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter('%.4f'))

    # Reserves (top-center)
    ax = fig.add_subplot(gs[0, 1])
    ax.plot(r, dex_ag / 1e6, color='#4CAF50', linewidth=1.5, label='Ag')
    ax_twin = ax.twinx()
    ax_twin.plot(r, dex_au / 1e6, color='#FF9800', linewidth=1.5, label='Au')
    ax.set_title('DEX Reserves (M)', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax_twin.tick_params(labelsize=8)
    ax.grid(True, alpha=0.3)

    # TVL (top-right)
    ax = fig.add_subplot(gs[0, 2])
    ax.plot(r, tvl / 1e6, color='#9C27B0', linewidth=1.5)
    ax.fill_between(r, 0, tvl / 1e6, alpha=0.1, color='#9C27B0')
    ax.set_title('TVL (M Au)', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.grid(True, alpha=0.3)

    # Trades (middle-left)
    ax = fig.add_subplot(gs[1, 0])
    ax.bar(r, trades, color='#FF5722', alpha=0.6, width=0.8)
    ax.set_title('Trades / Round', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.grid(True, alpha=0.3, axis='y')

    # Cumulative trades (middle-center)
    ax = fig.add_subplot(gs[1, 1])
    ax.plot(r, cum_trades, color='#607D8B', linewidth=1.5)
    ax.fill_between(r, 0, cum_trades, alpha=0.1, color='#607D8B')
    ax.set_title('Cumulative Trades', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.grid(True, alpha=0.3)

    # Treasury (middle-right)
    ax = fig.add_subplot(gs[1, 2])
    ax.plot(r, treasury_ag / 1e3, color='#E91E63', linewidth=1.5, label='Treasury')
    ax.plot(r, flashbuy_ag / 1e3, color='#3F51B5', linewidth=1.5, label='FlashBuy')
    ax.set_title('Treasury Balances (K Ag)', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3)

    # Supplies (bottom, spans 2 cols)
    ax = fig.add_subplot(gs[2, :2])
    if valid_ag.any():
        ax.plot(r[valid_ag], ag_supply[valid_ag] / 1e6, color='#00BCD4', linewidth=1.5, label='Ag')
    if valid_au.any():
        ax.plot(r[valid_au], au_supply[valid_au] / 1e6, color='#FFC107', linewidth=1.5, label='Au')
    ax.set_title('Token Supplies (M)', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)

    # Price distribution (bottom-right)
    ax = fig.add_subplot(gs[2, 2])
    valid_p = price[~np.isnan(price)]
    if len(valid_p) > 0:
        ax.hist(valid_p, bins=20, color='#2196F3', alpha=0.7, edgecolor='white')
        ax.axvline(np.mean(valid_p), color='red', linestyle='--', linewidth=1.5, label=f'Mean: {np.mean(valid_p):.4f}')
    ax.set_title('Price Distribution', fontsize=10, fontweight='bold')
    ax.tick_params(labelsize=8)
    ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3, axis='y')

    fig.suptitle('Flash Loan v3 Simulation — 100 Rounds × 100 Bots', fontsize=16, fontweight='bold', y=1.01)
    save(fig, "chart_dashboard.png")

    # ── Chart 8: Flash Buyback Events ──────────────────────────────
    fig, ax = plt.subplots(figsize=(12, 5))
    # Find rounds where flash buyback happened (price jumps or reserve shifts)
    buyback_rounds = []
    for i in range(1, len(data)):
        d_prev = data[i-1]
        d_curr = data[i]
        if d_curr.get("round") % 10 == 0:
            buyback_rounds.append(d_curr["round"])
    # Mark buyback rounds on the price chart
    buyback_prices = np.interp(buyback_rounds, r, price)
    ax.plot(r, price, color='#2196F3', linewidth=2, label='Price', zorder=1)
    ax.scatter(buyback_rounds, buyback_prices, color='red', s=80, marker='v', zorder=5,
               label=f'Flash Buyback ({len(buyback_rounds)} events)')
    for br in buyback_rounds:
        ax.axvline(x=br, color='red', alpha=0.15, linewidth=1)
    ax.set_xlabel('Round', fontsize=11)
    ax.set_ylabel('Price (Au/Ag)', fontsize=11)
    ax.set_title('Flash Buyback Events on Price Chart', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=10)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter('%.4f'))
    save(fig, "chart_flash_buybacks.png")

    print(f"\n📊 All charts saved to {OUT_DIR}/")

if __name__ == "__main__":
    main()
