"""
Strategy Engine — Smart Execution for the AV Treasury Keeper.

Moves beyond "price low → buy" to intelligent execution:
- TWAP (Time-Weighted Average Price) entries to minimize slippage
- Gas optimization — wait for cheap gas, batch operations
- Adaptive thresholds — dynamic peg threshold based on volatility
- Position sizing — volatility-adjusted buy sizes
- Momentum tracking — don't fight natural recovery
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Optional

from .logger import get_logger

log = get_logger("strategy")


# ─────────────────────────────────────────────────────────────────────────────
# Price Statistics
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PriceStats:
    """Rolling price statistics for decision-making."""
    prices: list[tuple[float, float]] = field(default_factory=list)  # (timestamp, price)
    max_samples: int = 288  # ~1 hour at 12s blocks

    def add(self, price: float, timestamp: Optional[float] = None):
        """Record a price sample."""
        ts = timestamp or time.time()
        self.prices.append((ts, price))
        if len(self.prices) > self.max_samples:
            self.prices = self.prices[-self.max_samples:]

    @property
    def current(self) -> Optional[float]:
        return self.prices[-1][1] if self.prices else None

    @property
    def sma(self) -> Optional[float]:
        """Simple moving average."""
        if not self.prices:
            return None
        return statistics.mean(p for _, p in self.prices)

    @property
    def volatility(self) -> Optional[float]:
        """Standard deviation of prices (coefficient of variation)."""
        if len(self.prices) < 6:
            return None
        vals = [p for _, p in self.prices]
        mean = statistics.mean(vals)
        if mean == 0:
            return None
        return statistics.stdev(vals) / mean

    @property
    def momentum(self) -> Optional[float]:
        """
        Price momentum: positive = recovering, negative = falling.
        Returns rate of change over the window.
        """
        if len(self.prices) < 6:
            return None
        recent = self.prices[-6:]  # Last ~1 minute
        older = self.prices[:6] if len(self.prices) >= 12 else self.prices[:len(self.prices)//2]
        if not older:
            return None
        recent_avg = statistics.mean(p for _, p in recent)
        older_avg = statistics.mean(p for _, p in older)
        if older_avg == 0:
            return None
        return (recent_avg - older_avg) / older_avg

    @property
    def trend(self) -> str:
        """Classify current trend."""
        m = self.momentum
        if m is None:
            return "unknown"
        if m > 0.005:
            return "recovering"
        if m > 0.001:
            return "slight_up"
        if m < -0.005:
            return "falling"
        if m < -0.001:
            return "slight_down"
        return "flat"


# ─────────────────────────────────────────────────────────────────────────────
# TWAP Executor
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class TWAPOrder:
    """A TWAP (Time-Weighted Average Price) order being executed."""
    total_amount_usd: float
    num_chunks: int
    chunk_size_usd: float
    interval_blocks: int
    start_block: int
    last_exec_block: int = 0
    chunks_executed: int = 0
    total_spent: float = 0.0
    total_received: float = 0.0
    active: bool = True

    @property
    def remaining_chunks(self) -> int:
        return self.num_chunks - self.chunks_executed

    @property
    def progress(self) -> float:
        return self.chunks_executed / self.num_chunks if self.num_chunks > 0 else 1.0

    @property
    def avg_price(self) -> float:
        if self.total_received == 0:
            return 0.0
        return self.total_spent / self.total_received


class TWAPExecutor:
    """
    Splits large buyback orders into smaller chunks executed over time.
    
    This minimizes price impact and prevents the keeper from being
    front-run on large single trades.
    
    Configuration:
    - max_chunk_usd: Maximum single chunk size
    - num_chunks: How many pieces to split into
    - interval_blocks: Blocks between each chunk
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.max_chunk_usd = settings.max_buy_usd * 0.25  # 25% of max per chunk
        self.default_chunks = 4
        self.default_interval = 6  # ~72 seconds at 12s blocks
        self.active_order: Optional[TWAPOrder] = None
        self.order_history: list[TWAPOrder] = []

    def should_use_twap(self, amount_usd: float, volatility: Optional[float] = None) -> bool:
        """Determine if an order should use TWAP execution."""
        if amount_usd > self.settings.max_buy_usd * 0.5:
            return True  # Large order → always TWAP
        if volatility and volatility > 0.02:
            return True  # High volatility → TWAP to avoid bad fills
        return False

    def create_order(
        self,
        total_amount_usd: float,
        current_block: int,
        num_chunks: Optional[int] = None,
        interval_blocks: Optional[int] = None,
    ) -> TWAPOrder:
        """Create a new TWAP order."""
        chunks = num_chunks or self.default_chunks
        interval = interval_blocks or self.default_interval

        # Adjust chunks if amount is small
        if total_amount_usd / chunks < 50:  # Min $50 per chunk
            chunks = max(1, int(total_amount_usd / 50))

        chunk_size = total_amount_usd / chunks

        # Cap chunk size
        if chunk_size > self.max_chunk_usd:
            chunks = max(1, int(total_amount_usd / self.max_chunk_usd) + 1)
            chunk_size = total_amount_usd / chunks

        order = TWAPOrder(
            total_amount_usd=total_amount_usd,
            num_chunks=chunks,
            chunk_size_usd=chunk_size,
            interval_blocks=interval,
            start_block=current_block,
            last_exec_block=current_block,
        )

        self.active_order = order
        log.info(
            f"TWAP order created: ${total_amount_usd:,.0f} in {chunks} chunks "
            f"of ${chunk_size:,.0f} every {interval} blocks"
        )
        return order

    def next_chunk(self, current_block: int) -> Optional[float]:
        """
        Get the next chunk size to execute, or None if not ready.
        Call this every block from the main loop.
        """
        if not self.active_order or not self.active_order.active:
            return None

        order = self.active_order

        # Check if enough blocks have passed
        if current_block - order.last_exec_block < order.interval_blocks:
            return None

        # Check if all chunks done
        if order.chunks_executed >= order.num_chunks:
            order.active = False
            self.order_history.append(order)
            self.active_order = None
            log.info(f"TWAP order complete: avg price ${order.avg_price:.4f}")
            return None

        # Execute next chunk
        order.last_exec_block = current_block
        order.chunks_executed += 1

        # Last chunk gets remainder
        if order.chunks_executed == order.num_chunks:
            chunk = order.total_amount_usd - order.total_spent
        else:
            chunk = order.chunk_size_usd

        log.info(
            f"TWAP chunk {order.chunks_executed}/{order.num_chunks}: "
            f"${chunk:,.0f} (progress: {order.progress*100:.0f}%)"
        )
        return chunk

    def record_fill(self, spent_usd: float, received_amount: float):
        """Record the result of a chunk execution."""
        if self.active_order:
            self.active_order.total_spent += spent_usd
            self.active_order.total_received += received_amount

    def cancel(self):
        """Cancel the active TWAP order."""
        if self.active_order:
            self.active_order.active = False
            self.order_history.append(self.active_order)
            log.warning(f"TWAP order cancelled at {self.active_order.progress*100:.0f}%")
            self.active_order = None


# ─────────────────────────────────────────────────────────────────────────────
# Gas Optimizer
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class GasState:
    """Track gas prices for optimization."""
    prices: list[tuple[float, float]] = field(default_factory=list)  # (timestamp, gwei)
    max_samples: int = 360  # ~1 hour at 10s intervals

    def add(self, gas_price_gwei: float, timestamp: Optional[float] = None):
        """Record gas price sample."""
        ts = timestamp or time.time()
        self.prices.append((ts, gas_price_gwei))
        if len(self.prices) > self.max_samples:
            self.prices = self.prices[-self.max_samples:]

    @property
    def current(self) -> Optional[float]:
        return self.prices[-1][1] if self.prices else None

    @property
    def percentile_50(self) -> Optional[float]:
        """Median gas price."""
        if not self.prices:
            return None
        sorted_prices = sorted(p for _, p in self.prices)
        mid = len(sorted_prices) // 2
        return sorted_prices[mid]

    @property
    def percentile_25(self) -> Optional[float]:
        """25th percentile (cheap gas)."""
        if not self.prices:
            return None
        sorted_prices = sorted(p for _, p in self.prices)
        return sorted_prices[len(sorted_prices) // 4]

    @property
    def percentile_75(self) -> Optional[float]:
        """75th percentile (expensive gas)."""
        if not self.prices:
            return None
        sorted_prices = sorted(p for _, p in self.prices)
        return sorted_prices[3 * len(sorted_prices) // 4]


class GasOptimizer:
    """
    Monitors gas prices and determines optimal execution timing.
    
    Strategy:
    - If gas is cheap (< p25): execute immediately
    - If gas is moderate (p25-p75): execute if peg is far from recovery
    - If gas is expensive (> p75): wait unless peg is critical
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.state = GasState()
        self.max_gas_gwei = settings.max_gas_gwei

    def record_gas(self, gas_price_gwei: float):
        """Record current gas price."""
        self.state.add(gas_price_gwei)

    def should_execute(self, price_ratio: float, gas_price_gwei: float) -> tuple[bool, str]:
        """
        Determine if we should execute now or wait.
        
        Args:
            price_ratio: current_price / peg_price (0.95 = 5% below peg)
            gas_price_gwei: current gas price in gwei
            
        Returns:
            (should_execute, reason)
        """
        # Always execute if gas is below max and peg is critical
        if price_ratio < 0.90 and gas_price_gwei < self.max_gas_gwei * 1.5:
            return True, "critical_peg"

        # Never execute if gas exceeds max
        if gas_price_gwei > self.max_gas_gwei:
            return False, f"gas_too_high ({gas_price_gwei:.1f} > {self.max_gas_gwei:.1f} gwei)"

        p25 = self.state.percentile_25
        p75 = self.state.percentile_75

        if p25 is None or p75 is None:
            # Not enough data — execute if gas is below max
            return gas_price_gwei < self.max_gas_gwei, "insufficient_gas_history"

        if gas_price_gwei <= p25:
            return True, "cheap_gas"

        if gas_price_gwei >= p75:
            # Expensive gas — only if peg is far from recovery
            if price_ratio < 0.95:
                return True, "expensive_gas_but_bad_peg"
            return False, f"expensive_gas ({gas_price_gwei:.1f} > p75 {p75:.1f} gwei)"

        # Moderate gas — execute if peg needs help
        if price_ratio < 0.97:
            return True, "moderate_gas_and_low_peg"

        return False, "moderate_gas_and_ok_peg"

    def get_status(self) -> dict:
        """Return gas optimizer status."""
        return {
            "current_gas_gwei": self.state.current,
            "median_gas_gwei": self.state.percentile_50,
            "cheap_threshold": self.state.percentile_25,
            "expensive_threshold": self.state.percentile_75,
            "max_gas_gwei": self.max_gas_gwei,
            "samples": len(self.state.prices),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Adaptive Threshold
# ─────────────────────────────────────────────────────────────────────────────

class AdaptiveThreshold:
    """
    Dynamically adjusts the buyback threshold based on market conditions.
    
    Normal: buy when price < 0.98 (2% below peg)
    High volatility: widen to 0.95 (5% below) to avoid whipsaw
    Strong downtrend: tighten to 0.99 (1% below) to defend early
    Natural recovery: raise to 0.95 (don't fight recovery)
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_threshold = settings.peg_threshold
        self.min_threshold = 0.90  # Never buy above 10% discount
        self.max_threshold = 0.995  # Never wait for >0.5% discount

    def get_threshold(
        self,
        volatility: Optional[float] = None,
        trend: str = "unknown",
        threat_level: int = 0,
    ) -> float:
        """
        Calculate the current buyback threshold.
        
        Returns: price ratio below which we buy (e.g., 0.98 = buy at 2% below peg)
        """
        threshold = self.base_threshold

        # Volatility adjustment
        if volatility:
            if volatility > 0.03:
                threshold *= 0.95  # High vol → widen (buy deeper only)
            elif volatility < 0.005:
                threshold *= 1.02  # Low vol → tighten (buy sooner)

        # Trend adjustment
        match trend:
            case "recovering":
                threshold *= 0.97  # Natural recovery → be patient
            case "falling":
                threshold *= 1.03  # Downtrend → defend early
            case "slight_down":
                threshold *= 1.01

        # Threat adjustment — higher threat = more conservative
        if threat_level >= 3:  # HALTED
            return 0.0  # Don't buy at all
        elif threat_level == 2:  # DEFENSIVE
            threshold *= 0.95
        elif threat_level == 1:  # CAUTIOUS
            threshold *= 0.98

        # Clamp
        threshold = max(self.min_threshold, min(self.max_threshold, threshold))
        return threshold


# ─────────────────────────────────────────────────────────────────────────────
# Position Sizer
# ─────────────────────────────────────────────────────────────────────────────

class PositionSizer:
    """
    Determines how much to spend on each buyback.
    
    Uses a simplified Kelly-inspired approach:
    - Larger buys when price is far below peg (asymmetric opportunity)
    - Smaller buys when price is near peg (marginal)
    - Volatility-adjusted (less in volatile markets)
    - Respects daily/monthly caps
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.daily_spent = 0.0
        self.daily_start_time = time.time()
        self.monthly_spent = 0.0
        self.monthly_start_time = time.time()

    def reset_daily(self):
        """Reset daily spending tracker."""
        self.daily_spent = 0.0
        self.daily_start_time = time.time()

    def reset_monthly(self):
        """Reset monthly spending tracker."""
        self.monthly_spent = 0.0
        self.monthly_start_time = time.time()

    def record_spend(self, amount_usd: float):
        """Record a buyback spend."""
        self.daily_spent += amount_usd
        self.monthly_spent += amount_usd

    def get_daily_remaining(self) -> float:
        """Remaining daily budget."""
        elapsed = time.time() - self.daily_start_time
        if elapsed > 86400:
            self.reset_daily()
        return max(0, self.settings.daily_buy_cap_usd - self.daily_spent)

    def get_monthly_remaining(self) -> float:
        """Remaining monthly budget."""
        elapsed = time.time() - self.monthly_start_time
        if elapsed > 2592000:
            self.reset_monthly()
        return max(0, self.settings.monthly_buy_cap_usd - self.monthly_spent)

    def calculate_buy_amount(
        self,
        price_ratio: float,
        volatility: Optional[float] = None,
        threat_level: int = 0,
    ) -> float:
        """
        Calculate optimal buy amount in USD.
        
        Args:
            price_ratio: current_price / peg_price
            volatility: coefficient of variation (optional)
            threat_level: current warden threat level (0-3)
            
        Returns:
            Recommended buy amount in USD (0 = don't buy)
        """
        if price_ratio >= 1.0:
            return 0.0

        # Base amount proportional to discount
        discount = 1.0 - price_ratio
        base_amount = self.settings.max_buy_usd * min(discount * 10, 1.0)

        # Volatility adjustment
        if volatility:
            if volatility > 0.02:
                base_amount *= 0.5  # Reduce size in volatile markets
            elif volatility < 0.005:
                base_amount *= 1.2  # Increase in calm markets

        # Threat adjustment
        if threat_level >= 3:
            return 0.0
        elif threat_level == 2:
            base_amount *= 0.25
        elif threat_level == 1:
            base_amount *= 0.5

        # Cap to remaining budgets
        base_amount = min(base_amount, self.get_daily_remaining())
        base_amount = min(base_amount, self.get_monthly_remaining())
        base_amount = min(base_amount, self.settings.max_buy_usd)

        # Minimum buy threshold (don't buy dust)
        if base_amount < self.settings.min_buy_usd:
            return 0.0

        return round(base_amount, 2)

    def get_status(self) -> dict:
        """Return sizer status."""
        return {
            "daily_spent_usd": round(self.daily_spent, 2),
            "daily_remaining_usd": round(self.get_daily_remaining(), 2),
            "daily_cap_usd": self.settings.daily_buy_cap_usd,
            "monthly_spent_usd": round(self.monthly_spent, 2),
            "monthly_remaining_usd": round(self.get_monthly_remaining(), 2),
            "monthly_cap_usd": self.settings.monthly_buy_cap_usd,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Strategy Coordinator
# ─────────────────────────────────────────────────────────────────────────────

class StrategyEngine:
    """
    Coordinates all strategy components and provides a single interface
    for the main loop to query.
    
    Usage:
        engine = StrategyEngine(settings)
        
        # Every block:
        engine.price_stats.add(price)
        engine.gas_optimizer.record_gas(gas_price)
        
        # Check if we should buy:
        decision = engine.get_buy_decision(price, peg_price, current_block, threat_level)
        if decision.buy:
            execute_buy(decision.amount_usd)
    """

    @dataclass
    class BuyDecision:
        buy: bool
        amount_usd: float
        use_twap: bool
        use_private_mempool: bool
        reason: str
        threshold_used: float

    def __init__(self, settings: Settings):
        self.settings = settings
        self.price_stats = PriceStats()
        self.twap = TWAPExecutor(settings)
        self.gas_optimizer = GasOptimizer(settings)
        self.adaptive_threshold = AdaptiveThreshold(settings)
        self.position_sizer = PositionSizer(settings)

    def get_buy_decision(
        self,
        current_price: float,
        peg_price: float,
        current_block: int,
        gas_price_gwei: float,
        threat_level: int = 0,
    ) -> BuyDecision:
        """
        Main decision function. Called every block by the keeper.
        
        Returns a BuyDecision with all the information needed to execute.
        """
        price_ratio = current_price / peg_price if peg_price > 0 else 1.0
        volatility = self.price_stats.volatility
        trend = self.price_stats.trend

        # Get adaptive threshold
        threshold = self.adaptive_threshold.get_threshold(
            volatility=volatility,
            trend=trend,
            threat_level=threat_level,
        )

        # Check if TWAP has an active chunk ready
        twap_chunk = self.twap.next_chunk(current_block)
        if twap_chunk is not None:
            return self.BuyDecision(
                buy=True,
                amount_usd=twap_chunk,
                use_twap=True,
                use_private_mempool=True,
                reason="twap_chunk",
                threshold_used=threshold,
            )

        # Check if price is below threshold
        if price_ratio >= threshold:
            return self.BuyDecision(
                buy=False,
                amount_usd=0.0,
                use_twap=False,
                use_private_mempool=False,
                reason=f"price_above_threshold ({price_ratio:.4f} >= {threshold:.4f})",
                threshold_used=threshold,
            )

        # Check gas optimization
        should_exec, gas_reason = self.gas_optimizer.should_execute(
            price_ratio, gas_price_gwei
        )
        if not should_exec:
            return self.BuyDecision(
                buy=False,
                amount_usd=0.0,
                use_twap=False,
                use_private_mempool=False,
                reason=f"gas_optimized_out ({gas_reason})",
                threshold_used=threshold,
            )

        # Calculate position size
        amount = self.position_sizer.calculate_buy_amount(
            price_ratio=price_ratio,
            volatility=volatility,
            threat_level=threat_level,
        )

        if amount <= 0:
            return self.BuyDecision(
                buy=False,
                amount_usd=0.0,
                use_twap=False,
                use_private_mempool=False,
                reason="position_size_zero",
                threshold_used=threshold,
            )

        # Determine if TWAP is needed
        use_twap = self.twap.should_use_twap(amount, volatility)

        if use_twap:
            self.twap.create_order(amount, current_block)
            first_chunk = self.twap.next_chunk(current_block)
            return self.BuyDecision(
                buy=True,
                amount_usd=first_chunk or amount,
                use_twap=True,
                use_private_mempool=True,
                reason=f"twap_initiated ({gas_reason})",
                threshold_used=threshold,
            )

        # Standard single buy
        return self.BuyDecision(
            buy=True,
            amount_usd=amount,
            use_twap=False,
            use_private_mempool=threat_level >= 1,
            reason=f"standard_buy ({gas_reason})",
            threshold_used=threshold,
        )

    def record_buy(
        self,
        amount_usd: float,
        received_amount: float,
        tx_hash: str,
    ):
        """Record a completed buyback."""
        self.position_sizer.record_spend(amount_usd)
        self.twap.record_fill(amount_usd, received_amount)

    def get_status(self) -> dict:
        """Return complete strategy status."""
        return {
            "price": {
                "current": self.price_stats.current,
                "sma": self.price_stats.sma,
                "volatility": self.price_stats.volatility,
                "trend": self.price_stats.trend,
                "momentum": self.price_stats.momentum,
            },
            "gas": self.gas_optimizer.get_status(),
            "budget": self.position_sizer.get_status(),
            "twap": {
                "active": self.twap.active_order is not None,
                "order": (
                    {
                        "progress": self.twap.active_order.progress,
                        "chunks_remaining": self.twap.active_order.remaining_chunks,
                        "total_usd": self.twap.active_order.total_amount_usd,
                    }
                    if self.twap.active_order
                    else None
                ),
            },
            "threshold": self.adaptive_threshold.base_threshold,
        }
