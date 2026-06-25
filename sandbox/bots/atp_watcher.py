#!/usr/bin/env python3
"""
ATP Watcher — Real-time analysis feeder for Reason ATP pipeline.

Polls sandbox/logs/atp_snapshots.jsonl for new state snapshots,
feeds them into symbolic analysis, and produces live analysis output.

Usage:
  python3 sandbox/bots/atp_watcher.py [--interval 5] [--output sandbox/logs/live_analysis.log]
"""

import json
import time
import sys
import os
import math
from collections import deque
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(SCRIPT_DIR, "..", "logs", "atp_snapshots.jsonl")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "logs", "live_analysis.log")
POLL_INTERVAL = 5  # seconds


class ATPWatcher:
    """Real-time ATP analysis feeder.

    Reads state snapshots from the simulation, maintains a rolling window,
    and produces symbolic analysis (trends, anomalies, risk flags) that
    can be used to adjust simulation parameters mid-run.
    """

    def __init__(self, log_path=LOG_PATH, output_path=OUTPUT_PATH, interval=POLL_INTERVAL):
        self.log_path = log_path
        self.output_path = output_path
        self.interval = interval
        self.window = deque(maxlen=50)  # last 50 snapshots
        self.last_position = 0
        self.rounds_analyzed = 0
        self.alerts = []

    def read_new_snapshots(self):
        """Read new lines from the snapshot file."""
        snapshots = []
        try:
            with open(self.log_path, 'r') as f:
                f.seek(self.last_position)
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        snapshots.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
                self.last_position = f.tell()
        except FileNotFoundError:
            pass
        return snapshots

    def analyze(self, snapshot):
        """Produce symbolic analysis from a state snapshot.

        This is a lightweight real-time analyzer. For deep theorem generation,
        the full Reason ATP pipeline (theorem_generator.py) can be called
        on the accumulated data.
        """
        analysis = {
            "round": snapshot.get("round", "?"),
            "timestamp": datetime.now().isoformat(),
            "metrics": {},
            "trends": [],
            "anomalies": [],
            "risk_flags": [],
        }

        # ── Price Analysis ─────────────────────────────────
        price = snapshot.get("price", "?")
        if price != "?":
            price_f = float(price)
            analysis["metrics"]["price"] = price_f

            # Price trend (compare with window)
            if len(self.window) >= 5:
                recent_prices = [float(s.get("price", 0)) for s in list(self.window)[-5:] if s.get("price") != "?"]
                if recent_prices:
                    avg_prev = sum(recent_prices) / len(recent_prices)
                    if avg_prev > 0:
                        change_pct = ((price_f - avg_prev) / avg_prev) * 100
                        if abs(change_pct) > 1.0:
                            direction = "UP" if change_pct > 0 else "DOWN"
                            analysis["trends"].append(
                                f"Price {direction} {abs(change_pct):.2f}% (window avg: {avg_prev:.6f})"
                            )
                        if change_pct > 3.0:
                            analysis["risk_flags"].append(f"PRICE_SPIKE: +{change_pct:.1f}%")
                        elif change_pct < -3.0:
                            analysis["risk_flags"].append(f"PRICE_DROP: {change_pct:.1f}%")

        # ── Reserve Analysis ───────────────────────────────
        ag_res = snapshot.get("dexAgReserve", "?")
        au_res = snapshot.get("dexAuReserve", "?")
        if ag_res != "?" and au_res != "?":
            ag_f = float(ag_res)
            au_f = float(au_res)
            analysis["metrics"]["dex_ag"] = ag_f
            analysis["metrics"]["dex_au"] = au_f

            # Reserve depletion check
            if len(self.window) >= 5:
                recent_ag = [float(s.get("dexAgReserve", 0)) for s in list(self.window)[-5:] if s.get("dexAgReserve") != "?"]
                if recent_ag and recent_ag[0] > 0:
                    depletion_pct = ((recent_ag[0] - ag_f) / recent_ag[0]) * 100
                    if depletion_pct > 5.0:
                        analysis["risk_flags"].append(f"RESERVE_AG_DRAIN: -{depletion_pct:.1f}%")

        # ── Supply Analysis ────────────────────────────────
        ag_sup = snapshot.get("agSupply", "?")
        au_sup = snapshot.get("auSupply", "?")
        if ag_sup != "?":
            ag_sup_f = float(ag_sup)
            analysis["metrics"]["ag_supply"] = ag_sup_f
            if len(self.window) >= 2:
                prev_ag = float(self.window[-1].get("agSupply", ag_sup_f))
                if prev_ag > 0:
                    mint_pct = ((ag_sup_f - prev_ag) / prev_ag) * 100
                    if mint_pct > 0.5:
                        analysis["trends"].append(f"Ag MINTED +{mint_pct:.2f}% (PID active)")
                    elif mint_pct < -0.5:
                        analysis["trends"].append(f"Ag BURNED {mint_pct:.2f}%")

        # ── Flash Buyback Analysis ─────────────────────────
        fb_ag = snapshot.get("flashBuyAg", "?")
        if fb_ag != "?":
            fb_f = float(fb_ag)
            analysis["metrics"]["flashbuy_ag"] = fb_f
            if len(self.window) >= 2:
                prev_fb = float(self.window[-1].get("flashBuyAg", fb_f))
                if prev_fb > 0 and fb_f < prev_fb:
                    spent = prev_fb - fb_f
                    analysis["trends"].append(
                        f"Flash buyback executed: -{spent:.0f} Ag (sold for Au)"
                    )

        # ── Flash Loan Health ──────────────────────────────
        fl_ag = snapshot.get("flashLoanBalance", "?")
        if fl_ag != "?":
            analysis["metrics"]["flashloan_ag"] = float(fl_ag)

        # ── PID Status ─────────────────────────────────────
        pid_active = snapshot.get("pidActive", False)
        pid_em = snapshot.get("pidEmissions", "?")
        analysis["metrics"]["pid_active"] = pid_active
        if pid_em != "?":
            analysis["metrics"]["pid_emissions"] = float(pid_em)

        # ── Trade Activity ─────────────────────────────────
        trades = snapshot.get("trades", 0)
        volume = snapshot.get("volume", 0)
        analysis["metrics"]["total_trades"] = trades
        analysis["metrics"]["total_volume"] = float(volume) if volume != "?" else 0

        return analysis

    def format_output(self, analysis):
        """Format analysis for human-readable output."""
        lines = []
        lines.append(f"═══ Round {analysis['round']} | {analysis['timestamp']} ═══")

        # Metrics
        m = analysis["metrics"]
        lines.append(f"  Price: {m.get('price', '?')} Au/Ag")
        dex_ag = m.get('dex_ag', '?')
        dex_au = m.get('dex_au', '?')
        lines.append(f"  DEX: {dex_ag:.0f} Ag / {dex_au:.0f} Au" if isinstance(dex_ag, (int, float)) and isinstance(dex_au, (int, float)) else f"  DEX: {dex_ag} / {dex_au}")
        ag_sup = m.get('ag_supply', '?')
        au_sup = m.get('au_supply', '?')
        lines.append(f"  Supplies: {ag_sup:.0f} Ag / {au_sup:.0f} Au" if isinstance(ag_sup, (int, float)) and isinstance(au_sup, (int, float)) else f"  Supplies: {ag_sup} / {au_sup}")
        fb_ag = m.get('flashbuy_ag', '?')
        fl_ag = m.get('flashloan_ag', '?')
        lines.append(f"  FlashBuy: {fb_ag:.0f} Ag | FlashLoan: {fl_ag:.0f} Ag" if isinstance(fb_ag, (int, float)) and isinstance(fl_ag, (int, float)) else f"  FlashBuy: {fb_ag} | FlashLoan: {fl_ag}")
        lines.append(f"  PID: {'ACTIVE' if m.get('pid_active') else 'INACTIVE'} | Emissions: {m.get('pid_emissions', '?')}")
        vol = m.get('total_volume', 0)
        lines.append(f"  Trades: {m.get('total_trades', '?')} | Volume: {vol:.0f}" if isinstance(vol, (int, float)) else f"  Trades: {m.get('total_trades', '?')} | Volume: {vol}")

        # Trends
        if analysis["trends"]:
            lines.append("  📈 Trends:")
            for t in analysis["trends"]:
                lines.append(f"    → {t}")

        # Anomalies
        if analysis["anomalies"]:
            lines.append("  ⚠️ Anomalies:")
            for a in analysis["anomalies"]:
                lines.append(f"    → {a}")

        # Risk flags
        if analysis["risk_flags"]:
            lines.append("  🚨 RISK FLAGS:")
            for r in analysis["risk_flags"]:
                lines.append(f"    → {r}")

        return "\n".join(lines)

    def run(self):
        """Main watch loop."""
        print(f"🔬 ATP Watcher started — polling {self.log_path} every {self.interval}s")
        print(f"   Output: {self.output_path}")
        print(f"   Waiting for simulation data...")

        while True:
            snapshots = self.read_new_snapshots()

            for snap in snapshots:
                self.window.append(snap)
                analysis = self.analyze(snap)
                self.rounds_analyzed += 1

                output = self.format_output(analysis)

                # Write to live analysis log
                with open(self.output_path, 'a') as f:
                    f.write(output + "\n\n")

                # Print to stdout if significant events
                if analysis["risk_flags"] or analysis["trends"]:
                    print(output)
                    print()

            time.sleep(self.interval)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ATP Real-time Analysis Watcher")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL, help="Poll interval (seconds)")
    parser.add_argument("--output", type=str, default=OUTPUT_PATH, help="Output log path")
    parser.add_argument("--snapshot-file", type=str, default=LOG_PATH, help="Snapshot file to watch")
    args = parser.parse_args()

    watcher = ATPWatcher(
        log_path=args.snapshot_file,
        output_path=args.output,
        interval=args.interval,
    )
    watcher.run()
