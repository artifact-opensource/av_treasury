"""
Keeper Logger — Structured logging with file rotation and event tracking.
"""

import logging
import logging.handlers
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import LOG_DIR, LOG_LEVEL, LOG_FORMAT


def setup_logger(name: str = "keeper") -> logging.Logger:
    """Create a rotating file logger."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # Console handler
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(console)

    # File handler with rotation (10MB, 5 backups)
    log_file = LOG_DIR / f"{name}.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(file_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """Get or create a logger instance. Alias for setup_logger with a module name."""
    logger = logging.getLogger(f"keeper.{name}")
    if not logger.handlers:
        return setup_logger(f"keeper.{name}")
    return logger


# ─── Event Log (structured JSON for TUI consumption) ────────────────────────

_event_log_file = LOG_DIR / "events.jsonl"


def log_event(
    event_type: str,
    data: dict,
    tx_hash: Optional[str] = None,
    block_number: Optional[int] = None,
    status: str = "success",
    error: Optional[str] = None,
):
    """Append a structured event to the events log."""
    import json

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "status": status,
        "data": data,
    }
    if tx_hash:
        entry["tx_hash"] = tx_hash
    if block_number:
        entry["block_number"] = block_number
    if error:
        entry["error"] = error

    with open(_event_log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


def read_events(limit: int = 100) -> list[dict]:
    """Read the last N events from the event log."""
    import json

    if not _event_log_file.exists():
        return []

    lines = _event_log_file.read_text().splitlines()
    events = []
    for line in lines[-limit:]:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events
