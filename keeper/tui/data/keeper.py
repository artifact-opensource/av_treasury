"""
Keeper data provider — tracks keeper status, logs, and health.
"""

import time
import json
import os
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class KeeperStatus:
    """Status of a single keeper process."""
    name: str
    running: bool = False
    last_run: float = 0.0
    next_scheduled: float = 0.0
    uptime_seconds: float = 0.0
    total_runs: int = 0
    errors: int = 0
    last_error: str = ""
    interval_seconds: float = 60.0

    @property
    def last_run_str(self) -> str:
        if self.last_run == 0:
            return "Never"
        elapsed = time.time() - self.last_run
        if elapsed < 60:
            return f"{int(elapsed)}s ago"
        elif elapsed < 3600:
            return f"{int(elapsed / 60)}m ago"
        else:
            return f"{int(elapsed / 3600)}h ago"

    @property
    def next_scheduled_str(self) -> str:
        if self.next_scheduled == 0:
            return "N/A"
        remaining = self.next_scheduled - time.time()
        if remaining <= 0:
            return "Due now"
        if remaining < 60:
            return f"in {int(remaining)}s"
        return f"in {int(remaining / 60)}m"

    @property
    def uptime_str(self) -> str:
        if self.uptime_seconds < 60:
            return f"{int(self.uptime_seconds)}s"
        elif self.uptime_seconds < 3600:
            return f"{int(self.uptime_seconds / 60)}m"
        else:
            return f"{int(self.uptime_seconds / 3600)}h {int((self.uptime_seconds % 3600) / 60)}m"


@dataclass
class KeeperLogEntry:
    """A single keeper log entry."""
    timestamp: float
    keeper: str
    action: str
    status: str  # "success", "error", "warning"
    details: str = ""

    @property
    def time_str(self) -> str:
        return datetime.fromtimestamp(self.timestamp).strftime("%H:%M:%S")


class KeeperDataProvider:
    """Manages keeper state, logs, and health monitoring."""

    def __init__(self):
        self._keepers: dict[str, KeeperStatus] = {
            "emission": KeeperStatus(
                name="Emission Keeper",
                interval_seconds=300,  # 5 min
            ),
            "buyback": KeeperStatus(
                name="Buyback Keeper",
                interval_seconds=600,  # 10 min
            ),
            "oracle": KeeperStatus(
                name="Oracle Keeper",
                interval_seconds=120,  # 2 min
            ),
        }
        self._logs: list[KeeperLogEntry] = []
        self._max_logs = 100
        self._load_state()

    def _state_file(self) -> Path:
        """Path to persistent state file."""
        state_dir = Path(__file__).resolve().parent / ".state"
        state_dir.mkdir(exist_ok=True)
        return state_dir / "keeper_state.json"

    def _load_state(self):
        """Load keeper state from disk."""
        sf = self._state_file()
        if sf.exists():
            try:
                with open(sf) as f:
                    data = json.load(f)
                for name, status in data.get("keepers", {}).items():
                    if name in self._keepers:
                        for k, v in status.items():
                            if hasattr(self._keepers[name], k):
                                setattr(self._keepers[name], k, v)
                for entry in data.get("logs", [])[-self._max_logs:]:
                    self._logs.append(KeeperLogEntry(**entry))
            except Exception:
                pass

    def _save_state(self):
        """Persist keeper state to disk."""
        try:
            data = {
                "keepers": {
                    name: {
                        "running": k.running,
                        "last_run": k.last_run,
                        "next_scheduled": k.next_scheduled,
                        "uptime_seconds": k.uptime_seconds,
                        "total_runs": k.total_runs,
                        "errors": k.errors,
                        "last_error": k.last_error,
                    }
                    for name, k in self._keepers.items()
                },
                "logs": [
                    {
                        "timestamp": e.timestamp,
                        "keeper": e.keeper,
                        "action": e.action,
                        "status": e.status,
                        "details": e.details,
                    }
                    for e in self._logs[-self._max_logs:]
                ],
            }
            with open(self._state_file(), "w") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    def start_keeper(self, name: str) -> bool:
        """Start a keeper process."""
        if name not in self._keepers:
            return False
        keeper = self._keepers[name]
        keeper.running = True
        keeper.next_scheduled = time.time() + keeper.interval_seconds
        self._add_log(name, "start", "success", f"{keeper.name} started")
        self._save_state()
        return True

    def stop_keeper(self, name: str) -> bool:
        """Stop a keeper process."""
        if name not in self._keepers:
            return False
        keeper = self._keepers[name]
        keeper.running = False
        keeper.next_scheduled = 0
        self._add_log(name, "stop", "success", f"{keeper.name} stopped")
        self._save_state()
        return True

    def trigger_manual(self, name: str, action: str) -> bool:
        """Manually trigger a keeper action."""
        if name not in self._keepers:
            return False
        keeper = self._keepers[name]
        keeper.last_run = time.time()
        keeper.total_runs += 1
        if keeper.running:
            keeper.next_scheduled = time.time() + keeper.interval_seconds
        self._add_log(name, action, "success", f"Manual {action} triggered")
        self._save_state()
        return True

    def record_error(self, name: str, error: str):
        """Record a keeper error."""
        if name in self._keepers:
            keeper = self._keepers[name]
            keeper.errors += 1
            keeper.last_error = error
            self._add_log(name, "error", "error", error)
            self._save_state()

    def _add_log(self, keeper: str, action: str, status: str, details: str = ""):
        """Add a log entry."""
        entry = KeeperLogEntry(
            timestamp=time.time(),
            keeper=keeper,
            action=action,
            status=status,
            details=details,
        )
        self._logs.append(entry)
        if len(self._logs) > self._max_logs:
            self._logs = self._logs[-self._max_logs:]

    def get_keeper_status(self, name: str) -> Optional[KeeperStatus]:
        """Get status of a specific keeper."""
        return self._keepers.get(name)

    def get_all_keepers(self) -> dict[str, KeeperStatus]:
        """Get all keeper statuses."""
        return dict(self._keepers)

    def get_logs(self, count: int = 20, keeper_filter: str = None) -> list[KeeperLogEntry]:
        """Get recent log entries."""
        logs = self._logs
        if keeper_filter:
            logs = [l for l in logs if l.keeper == keeper_filter]
        return logs[-count:]

    def tick(self):
        """Update keeper state (called every second)."""
        now = time.time()
        for name, keeper in self._keepers.items():
            if keeper.running:
                keeper.uptime_seconds += 1
                # Check if keeper is due to run
                if now >= keeper.next_scheduled and keeper.next_scheduled > 0:
                    keeper.last_run = now
                    keeper.total_runs += 1
                    keeper.next_scheduled = now + keeper.interval_seconds
                    self._add_log(name, "auto_run", "success", "Scheduled execution")
