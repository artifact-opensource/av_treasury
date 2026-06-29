"""
AV Treasury Keeper Bot — Main Orchestrator

Runs all keeper modules concurrently:
- Emission Keeper: PID emissions every epoch
- Buyback Keeper: FlashBuy when below peg
- Oracle Keeper: Keep price feed fresh
- Health Monitor: System-wide health checks

Usage:
    python -m keeper run              # Start all keepers
    python -m keeper run --only emission,buyback  # Selective start
    python -m keeper status           # Show current status
    python -m keeper test              # Dry-run (no transactions)
"""

import argparse
import asyncio
import signal
import sys
import time
from typing import Optional

from .config import KEEPER_PRIVATE_KEY, HEALTH_CHECK_INTERVAL
from .logger import setup_logger, log_event, read_events
from .emission import EmissionKeeper
from .buyback import BuybackKeeper
from .oracle import OracleKeeper
from .health import HealthMonitor

logger = setup_logger("keeper.main")


class KeeperBot:
    """Orchestrates all keeper modules."""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.emission = EmissionKeeper()
        self.buyback = BuybackKeeper()
        self.oracle = OracleKeeper()
        self.health = HealthMonitor()
        self._tasks: list[asyncio.Task] = []
        self.start_time: float = 0
        self._shutdown_event = asyncio.Event()

    @property
    def uptime(self) -> float:
        if not self.start_time:
            return 0
        return time.time() - self.start_time

    @property
    def status(self) -> dict:
        return {
            "running": all(t and not t.done() for t in self._tasks) if self._tasks else False,
            "dry_run": self.dry_run,
            "uptime_seconds": self.uptime,
            "keeper_address": self.emission.keeper_address,
            "emission": {
                "running": self.emission.running,
                "total_executed": self.emission.total_emissions_executed,
                "last_tx": self.emission.last_emission_tx,
                "last_time": self.emission.last_emission_time,
                "errors": self.emission.error_count,
            },
            "buyback": {
                "running": self.buyback.running,
                "total_executed": self.buyback.total_buybacks_executed,
                "last_tx": self.buyback.last_buyback_tx,
                "last_time": self.buyback.last_buyback_time,
                "errors": self.buyback.error_count,
            },
            "oracle": {
                "running": self.oracle.running,
                "total_updates": self.oracle.total_updates,
                "last_tx": self.oracle.last_update_tx,
                "last_time": self.oracle.last_update_time,
                "errors": self.oracle.error_count,
            },
            "health": {
                "running": self.health.running,
                "is_healthy": self.health.is_healthy,
                "issues": self.health.issues,
                "check_count": self.health.check_count,
            },
        }

    async def _health_check_loop(self):
        """Periodic system health check."""
        while not self._shutdown_event.is_set():
            try:
                status = self.status
                # Alert on excessive errors
                for module in ["emission", "buyback", "oracle"]:
                    if status[module]["errors"] > 5:
                        logger.warning(
                            f"⚠️  {module} keeper has {status[module]['errors']} errors"
                        )
                        log_event(
                            event_type="health_warning",
                            data={"module": module, "errors": status[module]["errors"]},
                            status="warning",
                        )
            except Exception as e:
                logger.error(f"Health check error: {e}")

            await asyncio.sleep(HEALTH_CHECK_INTERVAL)

    async def start(self, modules: Optional[list[str]] = None):
        """Start keeper modules."""
        self.start_time = time.time()
        all_modules = {
            "emission": self.emission.run,
            "buyback": self.buyback.run,
            "oracle": self.oracle.run,
            "health": self.health.run,
        }

        active = modules if modules else list(all_modules.keys())

        logger.info(f"Starting keeper bot (modules={active}, dry_run={self.dry_run})")
        logger.info(f"Keeper address: {self.emission.keeper_address}")

        log_event(
            event_type="keeper_started",
            data={"modules": active, "dry_run": self.dry_run},
        )

        # Start selected modules
        for name in active:
            if name in all_modules:
                task = asyncio.create_task(all_modules[name]())
                self._tasks.append(task)
                logger.info(f"  ✓ {name} keeper started")
            else:
                logger.warning(f"  ✗ Unknown module: {name}")

        # Start health check
        health_task = asyncio.create_task(self._health_check_loop())
        self._tasks.append(health_task)

        # Wait for shutdown signal
        await self._shutdown_event.wait()

        # Stop all modules
        self.emission.stop()
        self.buyback.stop()
        self.oracle.stop()
        self.health.stop()

        # Cancel remaining tasks
        for task in self._tasks:
            if not task.done():
                task.cancel()

        log_event(event_type="keeper_stopped", data={"uptime": self.uptime})
        logger.info(f"Keeper bot stopped (uptime={self.uptime:.0f}s)")

    def stop(self):
        """Signal shutdown."""
        logger.info("Shutdown signal received")
        self._shutdown_event.set()


async def run_keeper(modules: Optional[list[str]] = None, dry_run: bool = False):
    """Main entry point."""
    bot = KeeperBot(dry_run=dry_run)

    # Handle signals
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, bot.stop)

    await bot.start(modules=modules)


def show_status():
    """Display current keeper status from event log."""
    events = read_events(limit=20)
    if not events:
        print("No keeper events found. Is the keeper running?")
        return

    print("\n=== AV Treasury Keeper — Recent Events ===\n")
    for event in reversed(events):
        ts = event.get("timestamp", "?")[:19]
        etype = event.get("event_type", "?")
        status = event.get("status", "?")
        data = event.get("data", {})

        icon = "✅" if status == "success" else "❌" if status == "error" else "⚠️"
        print(f"  {icon} {ts} | {etype:25s} | {status}")
        if data:
            for k, v in list(data.items())[:3]:
                print(f"     └─ {k}: {v}")
    print()


def main():
    parser = argparse.ArgumentParser(description="AV Treasury Keeper Bot")
    subparsers = parser.add_subparsers(dest="command")

    # Run
    run_parser = subparsers.add_parser("run", help="Start the keeper bot")
    run_parser.add_argument(
        "--only", type=str, default=None,
        help="Comma-separated modules: emission,buyback,oracle"
    )
    run_parser.add_argument(
        "--dry-run", action="store_true",
        help="Read-only mode, no transactions"
    )

    # Status
    subparsers.add_parser("status", help="Show recent keeper events")

    args = parser.parse_args()

    if args.command == "run":
        modules = args.only.split(",") if args.only else None
        asyncio.run(run_keeper(modules=modules, dry_run=args.dry_run))
    elif args.command == "status":
        show_status()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
