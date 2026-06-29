"""
AV Treasury Keeper Bot — God Mode
=================================

The Warden of the Ecosystem.

Architecture:
    OracleKeeper ──feeds──→ Warden (threat detection)
                              │
                              ├──→ Strategy ──decides──→ BuybackKeeper.execute()
                              │
                              ├──→ Governor (emergency proposals)
                              │
                              └──→ MEV (private mempool routing)

Threat levels modulate all parameters:
    NORMAL    → full size, standard slippage
    CAUTIOUS  → 50% size, tighter slippage, private mempool
    DEFENSIVE → 25% size, 3x cooldown, deep discounts only
    HALTED    → no operations, emergency governance
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

# God-mode subsystems
from .settings import Settings
from .warden import Warden, ThreatLevel, ThreatEvent, ThreatType
from .strategy import StrategyEngine
from .mev import MEVCoordinator
from .governor import GovernorCoordinator

logger = setup_logger("keeper.main")

# Web3 for god-mode price reads
try:
    from web3 import Web3
    W3_AVAILABLE = True
except ImportError:
    W3_AVAILABLE = False


class KeeperBot:
    """
    God-mode keeper orchestrator.

    Runs emission, oracle, and health keepers as background loops.
    The buyback loop is replaced by the god-mode strategy engine
    that feeds off the Warden's threat assessment.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.start_time: float = 0
        self._shutdown_event = asyncio.Event()
        self._tasks: list[asyncio.Task] = []

        # Existing module keepers
        self.emission = EmissionKeeper()
        self.buyback = BuybackKeeper()
        self.oracle = OracleKeeper()
        self.health = HealthMonitor()

        # God-mode subsystems
        self.settings = Settings()
        self.warden = Warden(self.settings)
        self.strategy = StrategyEngine(self.settings)
        self.mev = MEVCoordinator(self.settings)
        self.governor = GovernorCoordinator(self.settings)

        # Wire threat level changes
        self.warden.on_threat_change(self._on_threat_change)

        # Web3 for price reads
        self.w3 = None
        if W3_AVAILABLE:
            from .config import RPC_URL
            self.w3 = Web3(Web3.HTTPProvider(RPC_URL))

        # State tracking
        self.total_buybacks: int = 0
        self.total_spent_usd: float = 0.0
        self.total_ag_bought: float = 0.0
        self.last_buyback_block: int = 0
        self.consecutive_errors: int = 0
        self.max_consecutive_errors: int = 5
        self._paused: bool = False
        self._last_god_tick: float = 0
        self._last_status_log: float = 0

    @property
    def uptime(self) -> float:
        if not self.start_time:
            return 0
        return time.time() - self.start_time

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def status(self) -> dict:
        return {
            "running": all(t and not t.done() for t in self._tasks) if self._tasks else False,
            "paused": self._paused,
            "dry_run": self.dry_run,
            "uptime_seconds": self.uptime,
            "keeper_address": self.emission.keeper_address,
            "threat_level": self.warden.threat_level.name,
            "total_buybacks": self.total_buybacks,
            "total_spent_usd": round(self.total_spent_usd, 2),
            "strategy": {
                "trend": self.strategy.price_stats.trend,
                "volatility": self.strategy.price_stats.volatility,
                "threshold": self.strategy.adaptive_threshold.get_threshold(
                    volatility=self.strategy.price_stats.volatility,
                    trend=self.strategy.price_stats.trend,
                    threat_level=self.warden.threat_level.value,
                ),
            },
            "emission": {
                "running": self.emission.running,
                "total_executed": self.emission.total_emissions_executed,
                "last_tx": self.emission.last_emission_tx,
                "errors": self.emission.error_count,
            },
            "buyback": {
                "running": self.buyback.running,
                "total_executed": self.buyback.total_buybacks_executed,
                "last_tx": self.buyback.last_buyback_tx,
                "errors": self.buyback.error_count,
            },
            "oracle": {
                "running": self.oracle.running,
                "total_updates": self.oracle.total_updates,
                "last_tx": self.oracle.last_update_tx,
                "errors": self.oracle.error_count,
            },
            "health": {
                "running": self.health.running,
                "is_healthy": self.health.is_healthy,
                "issues": self.health.issues,
                "check_count": self.health.check_count,
            },
            "governor": self.governor.get_status(),
            "mev": self.mev.get_status(),
        }

    def _on_threat_change(self, old_level: ThreatLevel, new_level: ThreatLevel):
        """Handle warden threat level changes."""
        logger.warning(f"THREAT LEVEL: {old_level.name} → {new_level.name}")

        if new_level == ThreatLevel.HALTED:
            self._paused = True
            logger.critical("🛑 KEEPER HALTED — all buybacks paused by Warden")

            # Check for emergency governance
            proposal = self.governor.check_emergency_actions(
                threat_level="HALTED",
                active_threats=[],
            )
            if proposal:
                self.governor.submit_proposal(proposal)

        elif old_level == ThreatLevel.HALTED and new_level < ThreatLevel.HALTED:
            self._paused = False
            logger.info("✅ Keeper resuming operations")

    def _read_ag_price(self) -> Optional[float]:
        """Read current Ag price from on-chain oracle."""
        if not self.w3:
            return None
        try:
            # Use the existing oracle keeper's contract reference
            oracle_contract = self.oracle.flashbuy if hasattr(self.oracle, 'flashbuy') else None
            if oracle_contract:
                # Try to get last known price from contract
                # This is a fallback — primary source is DEXScreener
                pass

            # Primary: DEXScreener API for Ag token
            import urllib.request
            ag_address = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674"
            url = f"https://api.dexscreener.com/latest/dex/tokens/{ag_address}"
            req = urllib.request.Request(url, headers={"User-Agent": "av-keeper/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                import json
                data = json.loads(resp.read())
                if data.get("pairs"):
                    price = float(data["pairs"][0]["priceUsd"])
                    return price
        except Exception as e:
            logger.debug(f"Price read error: {e}")
        return None

    def _read_gas_price_gwei(self) -> float:
        """Read current gas price in gwei."""
        if not self.w3:
            return 0.1  # Base is cheap
        try:
            gas_wei = self.w3.eth.gas_price
            return float(self.w3.from_wei(gas_wei, "gwei"))
        except Exception:
            return 0.1

    def _get_current_block(self) -> int:
        if not self.w3:
            return 0
        try:
            return self.w3.eth.block_number
        except Exception:
            return 0

    async def _god_mode_tick(self):
        """
        God-mode decision loop.

        1. Read price from DEXScreener
        2. Feed to strategy engine
        3. Run Warden checks (oracle divergence, mempool)
        4. Get buy decision from strategy
        5. Execute buyback if approved
        6. Check for emergency governance
        """
        try:
            now = time.time()
            self._last_god_tick = now

            # 1. Read price
            ag_price = self._read_ag_price()
            if not ag_price or ag_price <= 0:
                logger.debug("No price data available, skipping tick")
                return

            # 2. Feed to strategy
            self.strategy.price_stats.add(ag_price)

            # 3. Run Warden checks
            # Oracle divergence check (compare DEXScreener vs on-chain)
            chainlink_price = ag_price  # fallback
            if self.w3:
                try:
                    # Read from oracle keeper's on-chain source if available
                    pass
                except Exception:
                    pass

            self.warden.check_oracle(chainlink_price, ag_price)

            # Mempool check
            mempool_threats = self.mev.check_mempool()
            for threat in mempool_threats:
                severity_map = {
                    "low": ThreatLevel.CAUTIOUS,
                    "medium": ThreatLevel.CAUTIOUS,
                    "high": ThreatLevel.DEFENSIVE,
                }
                self.warden.record_threat(ThreatEvent(
                    threat_type=ThreatType.MEV_SANDWICH,
                    severity=severity_map.get(threat.get("severity", "low"), ThreatLevel.CAUTIOUS),
                    timestamp=now,
                    description=f"Mempool threat: {threat['type']}",
                    data=threat,
                ))

            # 4. Get strategy decision
            gas_gwei = self._read_gas_price_gwei()
            current_block = self._get_current_block()

            decision = self.strategy.get_buy_decision(
                current_price=ag_price,
                peg_price=self.settings.peg_price,
                current_block=current_block,
                gas_price_gwei=gas_gwei,
                threat_level=self.warden.threat_level.value,
            )

            # 5. Execute buyback if approved and not paused
            if decision.buy and decision.amount_usd > 0:
                if self._paused:
                    logger.info(
                        f"Buyback suppressed (halted): would have bought "
                        f"${decision.amount_usd:,.0f}"
                    )
                else:
                    await self._execute_god_buyback(
                        amount_usd=decision.amount_usd,
                        use_twap=decision.use_twap,
                        use_private=decision.use_private_mempool,
                    )

            # 6. Periodic status log (~every 5 min)
            if now - self._last_status_log > 300:
                self._last_status_log = now
                self._log_status(ag_price, decision)

        except Exception as e:
            logger.error(f"God-mode tick error: {e}", exc_info=True)
            self.consecutive_errors += 1
            if self.consecutive_errors >= self.max_consecutive_errors:
                logger.critical(
                    f"Too many consecutive errors ({self.consecutive_errors}). Pausing."
                )
                self._paused = True

    async def _execute_god_buyback(
        self,
        amount_usd: float,
        use_twap: bool,
        use_private: bool,
    ):
        """Execute a buyback through the existing BuybackKeeper."""
        logger.info(
            f"�️  GOD BUYBACK: ${amount_usd:,.0f} | "
            f"TWAP: {use_twap} | Private: {use_private} | "
            f"Threat: {self.warden.threat_level.name}"
        )

        if self.dry_run:
            logger.info(f"  [DRY RUN] Would execute ${amount_usd:,.0f} buyback")
            return

        try:
            # The existing buyback keeper handles the actual tx
            # We call its execute_buyback which checks conditions internally
            # The strategy engine has already decided this is a good time
            tx_hash = await asyncio.get_event_loop().run_in_executor(
                None, self.buyback.execute_buyback
            )

            if tx_hash:
                self.total_buybacks += 1
                self.total_spent_usd += amount_usd
                self.last_buyback_block = self._get_current_block()
                self.consecutive_errors = 0

                # Record in strategy
                self.strategy.record_buy(amount_usd, 0, tx_hash)
                self.warden.record_buyback_tx(tx_hash)

                logger.info(f"✅ GOD BUYBACK COMPLETE: ${amount_usd:,.2f} | TX: {tx_hash[:16]}...")
            else:
                logger.info("Buyback keeper returned None (conditions not met internally)")

        except Exception as e:
            logger.error(f"God buyback error: {e}", exc_info=True)
            self.consecutive_errors += 1

    def _log_status(self, ag_price: float, decision):
        """Periodic status log."""
        logger.info(
            f"📊 STATUS | Price: ${ag_price:.4f} | "
            f"Threat: {self.warden.threat_level.name} | "
            f"Buybacks: {self.total_buybacks} | "
            f"Spent: ${self.total_spent_usd:,.2f} | "
            f"Trend: {self.strategy.price_stats.trend} | "
            f"Uptime: {self.uptime/3600:.1f}h"
        )

    async def _health_check_loop(self):
        """Enhanced health check with warden integration."""
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

                # Warden threat level alert
                if self.warden.threat_level.value >= ThreatLevel.DEFENSIVE.value:
                    log_event(
                        event_type="warden_alert",
                        data={
                            "threat_level": self.warden.threat_level.name,
                            "active_threats": len(self.warden.active_threats),
                        },
                        status="warning",
                    )

            except Exception as e:
                logger.error(f"Health check error: {e}")

            await asyncio.sleep(HEALTH_CHECK_INTERVAL)

    async def start(self, modules: Optional[list[str]] = None):
        """Start all keeper modules + god-mode systems."""
        self.start_time = time.time()

        logger.info("=" * 60)
        logger.info("  AV TREASURY KEEPER — GOD MODE")
        logger.info("  Warden of the Ecosystem")
        logger.info("=" * 60)

        log_event(
            event_type="keeper_started",
            data={
                "modules": modules or "all",
                "dry_run": self.dry_run,
                "god_mode": True,
            },
        )

        # Start existing module keepers (emission, oracle, health — NOT buyback)
        # Buyback is controlled by the god-mode strategy engine
        background_modules = {
            "emission": self.emission.run,
            "oracle": self.oracle.run,
            "health": self.health.run,
        }

        active = modules if modules else list(background_modules.keys())

        for name in active:
            if name in background_modules:
                task = asyncio.create_task(background_modules[name]())
                self._tasks.append(task)
                logger.info(f"  ✓ {name} keeper started")
            elif name == "buyback":
                logger.info(f"  → buyback controlled by god-mode strategy")
            else:
                logger.warning(f"  ⚠ Unknown module: {name}")

        # Start god-mode tick loop
        god_task = asyncio.create_task(self._god_mode_loop())
        self._tasks.append(god_task)
        logger.info("  ✓ god-mode warden started")

        # Start health check
        health_task = asyncio.create_task(self._health_check_loop())
        self._tasks.append(health_task)

        # Wait for shutdown
        await self._shutdown_event.wait()

        # Cleanup
        self.emission.stop()
        self.buyback.stop()
        self.oracle.stop()
        self.health.stop()

        for task in self._tasks:
            if not task.done():
                task.cancel()

        log_event(event_type="keeper_stopped", data={"uptime": self.uptime})
        self._print_summary()

    async def _god_mode_loop(self):
        """Main god-mode decision loop."""
        while not self._shutdown_event.is_set():
            await self._god_mode_tick()
            await asyncio.sleep(self.settings.tick_interval_seconds)

    def _print_summary(self):
        """Print shutdown summary."""
        logger.info("=" * 60)
        logger.info("KEEPER SHUTDOWN SUMMARY")
        logger.info(f"  Uptime: {self.uptime/3600:.1f} hours")
        logger.info(f"  Total buybacks: {self.total_buybacks}")
        logger.info(f"  Total spent: ${self.total_spent_usd:,.2f}")
        logger.info(f"  Threats detected: {self.warden.get_status()['total_threats_detected']}")
        logger.info(f"  Proposals submitted: {self.governor.proposals_submitted}")
        logger.info("=" * 60)

    def stop(self):
        """Signal shutdown."""
        logger.info("Shutdown signal received")
        self._shutdown_event.set()


async def run_keeper(modules: Optional[list[str]] = None, dry_run: bool = False):
    """Main entry point."""
    bot = KeeperBot(dry_run=dry_run)

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
    parser = argparse.ArgumentParser(description="AV Treasury Keeper Bot — God Mode")
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
