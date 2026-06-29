"""
Warden — Adversarial Defense Engine for the AV Treasury Keeper.

The Warden monitors all ecosystem activity for attacks, manipulation,
and anomalies. It can trigger defensive actions including:
- Pausing buybacks during oracle manipulation
- Alerting on MEV/sandwich attacks
- Detecting peg gaming by whales
- Emergency kill switch for the entire keeper

Architecture: stateful detectors that feed into a threat level system.
Threat level determines keeper behavior (normal → cautious → defensive → halted).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

from .logger import get_logger

log = get_logger("warden")


# ─────────────────────────────────────────────────────────────────────────────
# Threat Levels
# ─────────────────────────────────────────────────────────────────────────────

class ThreatLevel(Enum):
    NORMAL = 0      # All clear, operate normally
    CAUTIOUS = 1    # Minor anomaly detected, tighten parameters
    DEFENSIVE = 2   # Active threat, reduce exposure, increase monitoring
    HALTED = 3      # Critical threat, pause all operations


class ThreatType(Enum):
    ORACLE_MANIPULATION = "oracle_manipulation"
    MEV_SANDWICH = "mev_sandwich"
    PEG_GAMING = "peg_gaming"
    WASH_TRADING = "wash_trading"
    LIQUIDITY_DRAIN = "liquidity_drain"
    GOVERNANCE_ATTACK = "governance_attack"
    CONTRACT_VULNERABILITY = "contract_vulnerability"
    FLASH_LOAN_ATTACK = "flash_loan_attack"


# ─────────────────────────────────────────────────────────────────────────────
# Threat Event
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ThreatEvent:
    """A detected threat or anomaly."""
    threat_type: ThreatType
    severity: ThreatLevel
    timestamp: float
    description: str
    source_address: Optional[str] = None
    tx_hash: Optional[str] = None
    data: dict = field(default_factory=dict)
    resolved: bool = False

    def __str__(self) -> str:
        addr = f" from {self.source_address[:10]}..." if self.source_address else ""
        return f"[{self.severity.name}] {self.threat_type.value}{addr}: {self.description}"


# ─────────────────────────────────────────────────────────────────────────────
# Detectors
# ─────────────────────────────────────────────────────────────────────────────

class OracleManipulationDetector:
    """
    Detects oracle manipulation by comparing price feeds.
    
    If Chainlink and TWAP diverge beyond a threshold, someone may be
    manipulating one feed to trigger (or prevent) buybacks.
    
    Also detects sudden price spikes/dumps that don't correlate with
    CEX prices — a sign of spot manipulation on Base DEXs.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.divergence_threshold = 0.02  # 2% divergence triggers alert
        self.critical_divergence = 0.05   # 5% divergence = critical
        self.price_history: list[tuple[float, float]] = []  # (timestamp, price)
        self.max_history = 288  # ~1 hour at 12s blocks

    def check(
        self,
        chainlink_price: float,
        twap_price: float,
        cex_price: Optional[float] = None,
    ) -> Optional[ThreatEvent]:
        """Check for oracle manipulation. Returns ThreatEvent if detected."""
        now = time.time()

        # Record price history
        self.price_history.append((now, chainlink_price))
        if len(self.price_history) > self.max_history:
            self.price_history = self.price_history[-self.max_history:]

        if chainlink_price <= 0 or twap_price <= 0:
            return ThreatEvent(
                threat_type=ThreatType.ORACLE_MANIPULATION,
                severity=ThreatLevel.HALTED,
                timestamp=now,
                description="Oracle returned zero price — feeds may be broken",
            )

        # Check Chainlink vs TWAP divergence
        divergence = abs(chainlink_price - twap_price) / min(chainlink_price, twap_price)

        if divergence >= self.critical_divergence:
            return ThreatEvent(
                threat_type=ThreatType.ORACLE_MANIPULATION,
                severity=ThreatLevel.HALTED,
                timestamp=now,
                description=(
                    f"CRITICAL: Chainlink ({chainlink_price:.4f}) vs TWAP "
                    f"({twap_price:.4f}) diverge by {divergence*100:.1f}%"
                ),
                data={
                    "chainlink_price": chainlink_price,
                    "twap_price": twap_price,
                    "divergence": divergence,
                },
            )

        if divergence >= self.divergence_threshold:
            return ThreatEvent(
                threat_type=ThreatType.ORACLE_MANIPULATION,
                severity=ThreatLevel.CAUTIOUS,
                timestamp=now,
                description=(
                    f"Chainlink ({chainlink_price:.4f}) vs TWAP "
                    f"({twap_price:.4f}) diverge by {divergence*100:.1f}%"
                ),
                data={
                    "chainlink_price": chainlink_price,
                    "twap_price": twap_price,
                    "divergence": divergence,
                },
            )

        # Check against CEX price if available
        if cex_price and cex_price > 0:
            dex_avg = (chainlink_price + twap_price) / 2
            cex_divergence = abs(dex_avg - cex_price) / cex_price
            if cex_divergence > 0.03:  # 3% DEX vs CEX
                return ThreatEvent(
                    threat_type=ThreatType.ORACLE_MANIPULATION,
                    severity=ThreatLevel.CAUTIOUS,
                    timestamp=now,
                    description=(
                        f"DEX price ({dex_avg:.4f}) vs CEX ({cex_price:.4f}) "
                        f"diverge by {cex_divergence*100:.1f}%"
                    ),
                    data={
                        "dex_price": dex_avg,
                        "cex_price": cex_price,
                        "divergence": cex_divergence,
                    },
                )

        # Check for sudden price movement
        if len(self.price_history) >= 6:  # ~1 minute of data
            recent = self.price_history[-6:]
            price_change = abs(recent[-1][1] - recent[0][1]) / recent[0][1]
            if price_change > 0.05:  # 5% move in ~1 minute
                return ThreatEvent(
                    threat_type=ThreatType.ORACLE_MANIPULATION,
                    severity=ThreatLevel.DEFENSIVE,
                    timestamp=now,
                    description=(
                        f"Rapid price movement: {price_change*100:.1f}% "
                        f"in ~1 minute"
                    ),
                    data={"price_change": price_change},
                )

        return None


class PegGamingDetector:
    """
    Detects whales gaming the peg threshold.
    
    Attack pattern: small dump to trigger keeper buyback, then buy back
    at lower price. The attacker profits from the spread while the
    keeper loses value.
    
    Tracks sell/buy patterns around the peg threshold.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.threshold = settings.peg_threshold
        self.recent_trades: list[dict] = []
        self.suspicious_addresses: dict[str, float] = {}  # addr -> suspicion score
        self.lookback_window = 3600  # 1 hour
        self.gaming_threshold = 3    # N suspicious trades to flag

    def record_trade(
        self,
        address: str,
        side: str,  # "sell" or "buy"
        amount_usd: float,
        price: float,
        timestamp: float,
        tx_hash: str,
    ) -> Optional[ThreatEvent]:
        """Record a trade and check for peg gaming patterns."""
        trade = {
            "address": address,
            "side": side,
            "amount_usd": amount_usd,
            "price": price,
            "timestamp": timestamp,
            "tx_hash": tx_hash,
        }
        self.recent_trades.append(trade)

        # Prune old trades
        cutoff = timestamp - self.lookback_window
        self.recent_trades = [t for t in self.recent_trades if t["timestamp"] > cutoff]

        # Check for gaming pattern: sell near threshold, then buy back lower
        if side == "sell" and price < self.threshold * 1.02:
            # Look for buyback from same address after a sell near threshold
            recent_buys = [
                t for t in self.recent_trades
                if t["address"] == address
                and t["side"] == "buy"
                and t["price"] < price * 0.98  # Bought back 2% lower
                and t["timestamp"] > timestamp - 600  # Within 10 min
            ]

            if recent_buys:
                self.suspicious_addresses[address] = (
                    self.suspicious_addresses.get(address, 0) + 1
                )

                if self.suspicious_addresses[address] >= self.gaming_threshold:
                    return ThreatEvent(
                        threat_type=ThreatType.PEG_GAMING,
                        severity=ThreatLevel.DEFENSIVE,
                        timestamp=timestamp,
                        description=(
                            f"Address {address[:10]}... flagged for peg gaming "
                            f"({self.suspicious_addresses[address]} incidents)"
                        ),
                        source_address=address,
                        tx_hash=tx_hash,
                        data={
                            "suspicion_score": self.suspicious_addresses[address],
                            "sell_price": price,
                            "buy_price": recent_buys[-1]["price"],
                        },
                    )

                return ThreatEvent(
                    threat_type=ThreatType.PEG_GAMING,
                    severity=ThreatLevel.CAUTIOUS,
                    timestamp=timestamp,
                    description=(
                        f"Possible peg gaming detected from {address[:10]}... "
                        f"(sell at {price:.4f}, buy back at {recent_buys[-1]['price']:.4f})"
                    ),
                    source_address=address,
                    tx_hash=tx_hash,
                )

        return None

    def get_suspicious_addresses(self) -> dict[str, float]:
        """Return addresses flagged as suspicious with their scores."""
        return dict(self.suspicious_addresses)


class MEVDetector:
    """
    Detects MEV attacks targeting our transactions.
    
    Monitors for:
    - Sandwich attacks (frontrun + backrun around our txs)
    - Frontrunning of our buyback transactions
    - Pending mempool transactions that target our operations
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.our_tx_hashes: list[str] = []
        self.sandwich_count = 0
        self.frontrun_count = 0

    def record_our_tx(self, tx_hash: str):
        """Record our own transaction hash for monitoring."""
        self.our_tx_hashes.append(tx_hash)
        # Keep last 50
        if len(self.our_tx_hashes) > 50:
            self.our_tx_hashes = self.our_tx_hashes[-50:]

    def check_sandwich(
        self,
        our_tx_hash: str,
        frontrun_hash: Optional[str],
        backrun_hash: Optional[str],
        price_before: float,
        price_during: float,
        price_after: float,
    ) -> Optional[ThreatEvent]:
        """Check if our transaction was sandwiched."""
        if frontrun_hash and backrun_hash:
            self.sandwich_count += 1
            slippage = abs(price_during - price_before) / price_before

            return ThreatEvent(
                threat_type=ThreatType.MEV_SANDWICH,
                severity=ThreatLevel.CAUTIOUS,
                timestamp=time.time(),
                description=(
                    f"Sandwich attack detected! Slippage: {slippage*100:.2f}% "
                    f"(total sandwiches: {self.sandwich_count})"
                ),
                tx_hash=our_tx_hash,
                data={
                    "frontrun_hash": frontrun_hash,
                    "backrun_hash": backrun_hash,
                    "slippage": slippage,
                    "price_before": price_before,
                    "price_during": price_during,
                    "price_after": price_after,
                    "total_sandwiches": self.sandwich_count,
                },
            )

        return None

    def check_frontrun(
        self,
        pending_tx: dict,
        our_pending: bool = False,
    ) -> Optional[ThreatEvent]:
        """Check if a pending transaction is frontrunning ours."""
        if not our_pending:
            return None

        # If we have a pending tx and someone submits a similar tx with higher gas
        if pending_tx.get("gas_price", 0) > pending_tx.get("our_gas_price", 0) * 1.5:
            self.frontrun_count += 1
            return ThreatEvent(
                threat_type=ThreatType.MEV_SANDWICH,
                severity=ThreatLevel.CAUTIOUS,
                timestamp=time.time(),
                description=(
                    f"Possible frontrun detected — competitor gas "
                    f"{pending_tx.get('gas_price', 0)} vs ours "
                    f"{pending_tx.get('our_gas_price', 0)}"
                ),
                data=pending_tx,
            )

        return None

    def get_stats(self) -> dict:
        """Return MEV detection statistics."""
        return {
            "sandwich_count": self.sandwich_count,
            "frontrun_count": self.frontrun_count,
            "total_attacks": self.sandwich_count + self.frontrun_count,
        }


class LiquidityDrainDetector:
    """
    Monitors DEX liquidity for sudden drains.
    
    A sudden liquidity drop could indicate:
    - A rug or exploit in a paired token
    - A coordinated exit before an attack
    - Normal volatility (we need to distinguish)
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.liquidity_history: list[tuple[float, float]] = []  # (timestamp, tvl_usd)
        self.drain_threshold = 0.15  # 15% drop triggers alert
        self.critical_drain = 0.30   # 30% drop = critical

    def check(self, current_tvl_usd: float) -> Optional[ThreatEvent]:
        """Check for liquidity drain. Returns ThreatEvent if detected."""
        now = time.time()
        self.liquidity_history.append((now, current_tvl_usd))

        # Keep 24 hours of data
        cutoff = now - 86400
        self.liquidity_history = [
            (t, v) for t, v in self.liquidity_history if t > cutoff
        ]

        if len(self.liquidity_history) < 2:
            return None

        # Compare to recent peak
        peak = max(v for _, v in self.liquidity_history)
        if peak <= 0:
            return None

        drop = (peak - current_tvl_usd) / peak

        if drop >= self.critical_drain:
            return ThreatEvent(
                threat_type=ThreatType.LIQUIDITY_DRAIN,
                severity=ThreatLevel.HALTED,
                timestamp=now,
                description=(
                    f"CRITICAL: Liquidity dropped {drop*100:.0f}% from peak "
                    f"(${peak:,.0f} → ${current_tvl_usd:,.0f})"
                ),
                data={"peak_tvl": peak, "current_tvl": current_tvl_usd, "drop": drop},
            )

        if drop >= self.drain_threshold:
            return ThreatEvent(
                threat_type=ThreatType.LIQUIDITY_DRAIN,
                severity=ThreatLevel.CAUTIOUS,
                timestamp=now,
                description=(
                    f"Liquidity dropped {drop*100:.0f}% from peak "
                    f"(${peak:,.0f} → ${current_tvl_usd:,.0f})"
                ),
                data={"peak_tvl": peak, "current_tvl": current_tvl_usd, "drop": drop},
            )

        return None


# ─────────────────────────────────────────────────────────────────────────────
# Warden — Central Brain
# ─────────────────────────────────────────────────────────────────────────────

class Warden:
    """
    Central adversarial defense coordinator.
    
    Aggregates signals from all detectors, maintains threat level,
    and provides recommendations to the keeper main loop.
    
    The Warden can:
    - Escalate/de-escalate threat levels
    - Recommend parameter adjustments (wider thresholds, smaller buys)
    - Trigger emergency halt
    - Log all threats for post-mortem analysis
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.threat_level = ThreatLevel.NORMAL
        self.active_threats: list[ThreatEvent] = []
        self.threat_history: list[ThreatEvent] = []
        self.max_history = 1000

        # Detectors
        self.oracle_detector = OracleManipulationDetector(settings)
        self.peg_detector = PegGamingDetector(settings)
        self.mev_detector = MEVDetector(settings)
        self.liquidity_detector = LiquidityDrainDetector(settings)

        # Callbacks for threat level changes
        self._on_threat_change: Optional[Callable[[ThreatLevel, ThreatLevel], None]] = None

        # Auto-halt config
        self.halt_on_critical_oracle = True
        self.halt_on_liquidity_crash = True
        self.max_threats_before_halt = 5  # N active threats → halt

        # Recovery
        self._last_normal_time = time.time()
        self._recovery_delay = 300  # 5 min in NORMAL before de-escalating

    def on_threat_change(self, callback: Callable[[ThreatLevel, ThreatLevel], None]):
        """Register callback for threat level changes: callback(old, new)."""
        self._on_threat_change = callback

    def _set_threat_level(self, new_level: ThreatLevel, reason: str):
        """Update threat level with logging and callback."""
        if new_level != self.threat_level:
            old_level = self.threat_level
            self.threat_level = new_level
            log.warning(
                f"Threat level: {old_level.name} → {new_level.name} — {reason}"
            )
            if self._on_threat_change:
                self._on_threat_change(old_level, new_level)

            if new_level == ThreatLevel.NORMAL:
                self._last_normal_time = time.time()

    def record_threat(self, event: ThreatEvent):
        """Record a threat event and update threat level."""
        self.active_threats.append(event)
        self.threat_history.append(event)

        if len(self.threat_history) > self.max_history:
            self.threat_history = self.threat_history[-self.max_history:]

        log.warning(str(event))

        # Auto-escalate based on severity
        if event.severity.value > self.threat_level.value:
            self._set_threat_level(event.severity, event.description)

        # Auto-halt conditions
        if (event.severity == ThreatLevel.HALTED and
            self.halt_on_critical_oracle and
            event.threat_type == ThreatType.ORACLE_MANIPULATION):
            self._set_threat_level(ThreatLevel.HALTED, "Oracle manipulation halt")

        if (event.severity == ThreatLevel.HALTED and
            self.halt_on_liquidity_crash and
            event.threat_type == ThreatType.LIQUIDITY_DRAIN):
            self._set_threat_level(ThreatLevel.HALTED, "Liquidity crash halt")

        # Too many active threats → halt
        critical_count = sum(
            1 for t in self.active_threats
            if not t.resolved and t.severity.value >= ThreatLevel.DEFENSIVE.value
        )
        if critical_count >= self.max_threats_before_halt:
            self._set_threat_level(
                ThreatLevel.HALTED,
                f"{critical_count} active critical threats",
            )

    def resolve_threat(self, threat_type: ThreatType):
        """Mark all active threats of a type as resolved."""
        for t in self.active_threats:
            if t.threat_type == threat_type:
                t.resolved = True
        self.active_threats = [t for t in self.active_threats if not t.resolved]
        self._maybe_de_escalate()

    def _maybe_de_escalate(self):
        """De-escalate threat level if all active threats are resolved."""
        if not self.active_threats and self.threat_level != ThreatLevel.NORMAL:
            # Wait recovery delay before going back to normal
            if time.time() - self._last_normal_time > self._recovery_delay:
                self._set_threat_level(ThreatLevel.NORMAL, "All threats resolved")
        elif self.active_threats:
            max_severity = max(t.severity for t in self.active_threats if not t.resolved)
            if max_severity.value < self.threat_level.value:
                self._set_threat_level(
                    max_severity,
                    "Highest active threat reduced",
                )

    # ── Convenience methods for main loop ──────────────────────────────────

    def check_oracle(
        self,
        chainlink_price: float,
        twap_price: float,
        cex_price: Optional[float] = None,
    ) -> Optional[ThreatEvent]:
        """Check oracle feeds for manipulation."""
        event = self.oracle_detector.check(chainlink_price, twap_price, cex_price)
        if event:
            self.record_threat(event)
        else:
            self.resolve_threat(ThreatType.ORACLE_MANIPULATION)
        return event

    def check_liquidity(self, tvl_usd: float) -> Optional[ThreatEvent]:
        """Check DEX liquidity for drains."""
        event = self.liquidity_detector.check(tvl_usd)
        if event:
            self.record_threat(event)
        else:
            self.resolve_threat(ThreatType.LIQUIDITY_DRAIN)
        return event

    def record_buyback_tx(self, tx_hash: str):
        """Record our buyback tx for MEV monitoring."""
        self.mev_detector.record_our_tx(tx_hash)

    def check_sandwich_attack(
        self,
        our_tx_hash: str,
        frontrun_hash: Optional[str],
        backrun_hash: Optional[str],
        price_before: float,
        price_during: float,
        price_after: float,
    ) -> Optional[ThreatEvent]:
        """Check if our tx was sandwiched."""
        event = self.mev_detector.check_sandwich(
            our_tx_hash, frontrun_hash, backrun_hash,
            price_before, price_during, price_after,
        )
        if event:
            self.record_threat(event)
        return event

    def record_dex_trade(
        self,
        address: str,
        side: str,
        amount_usd: float,
        price: float,
        timestamp: float,
        tx_hash: str,
    ) -> Optional[ThreatEvent]:
        """Record a DEX trade for peg gaming detection."""
        event = self.peg_detector.record_trade(
            address, side, amount_usd, price, timestamp, tx_hash,
        )
        if event:
            self.record_threat(event)
        return event

    # ── Status & Reporting ─────────────────────────────────────────────────

    def get_status(self) -> dict:
        """Return current warden status."""
        return {
            "threat_level": self.threat_level.name,
            "active_threats": len(self.active_threats),
            "total_threats_detected": len(self.threat_history),
            "suspicious_addresses": self.peg_detector.get_suspicious_addresses(),
            "mev_stats": self.mev_detector.get_stats(),
            "can_operate": self.threat_level.value < ThreatLevel.HALTED.value,
            "recommended_action": self._recommend_action(),
        }

    def _recommend_action(self) -> str:
        """Recommend keeper action based on current threat level."""
        match self.threat_level:
            case ThreatLevel.NORMAL:
                return "operate_normally"
            case ThreatLevel.CAUTIOUS:
                return "tighten_parameters"
            case ThreatLevel.DEFENSIVE:
                return "reduce_exposure"
            case ThreatLevel.HALTED:
                return "halt_all_operations"

    def get_recommended_parameters(self) -> dict:
        """
        Return recommended keeper parameters based on threat level.
        The main loop should use these to adjust its behavior.
        """
        base = {
            "buyback_enabled": True,
            "max_buy_usd": self.settings.max_buy_usd,
            "slippage_tolerance": self.settings.slippage_tolerance,
            "cooldown_blocks": self.settings.cooldown_blocks,
            "peg_threshold": self.settings.peg_threshold,
            "use_private_mempool": False,
        }

        match self.threat_level:
            case ThreatLevel.NORMAL:
                return base

            case ThreatLevel.CAUTIOUS:
                return {
                    **base,
                    "max_buy_usd": base["max_buy_usd"] * 0.5,
                    "slippage_tolerance": base["slippage_tolerance"] * 0.7,
                    "cooldown_blocks": int(base["cooldown_blocks"] * 1.5),
                    "use_private_mempool": True,
                }

            case ThreatLevel.DEFENSIVE:
                return {
                    **base,
                    "buyback_enabled": True,
                    "max_buy_usd": base["max_buy_usd"] * 0.25,
                    "slippage_tolerance": base["slippage_tolerance"] * 0.5,
                    "cooldown_blocks": int(base["cooldown_blocks"] * 3),
                    "peg_threshold": base["peg_threshold"] * 0.95,  # Only buy if very cheap
                    "use_private_mempool": True,
                }

            case ThreatLevel.HALTED:
                return {
                    **base,
                    "buyback_enabled": False,
                    "max_buy_usd": 0,
                    "use_private_mempool": True,
                }
