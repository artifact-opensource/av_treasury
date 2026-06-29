"""
Overview Dashboard — Tab 1
Shows Au/Ag prices, TVL, reserve ratio, PID emissions, oracle deviation, FlashBuy status.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Grid, Container
from textual.widgets import Static, Header, Footer, Label, DataTable
from textual.timer import Timer

from ..data.chain import ChainDataProvider
from ..data.market import MarketDataProvider
from ..widgets.sparkline import Sparkline
from ..widgets.gauge import GaugeBar
from ..widgets.status import StatusIndicator


class PriceCard(Static):
    """A card displaying a token price with sparkline."""

    def __init__(self, token: str, color: str, **kwargs):
        super().__init__(**kwargs)
        self._token = token
        self._color = color
        self._price = 0.0
        self._change = 0.0

    def update_price(self, price: float, change: float = 0.0):
        self._price = price
        self._change = change
        self.refresh()

    def render(self):
        from rich.text import Text
        arrow = "▲" if self._change >= 0 else "▼"
        change_color = "green" if self._change >= 0 else "red"
        text = Text()
        text.append(f"  {self._token}\n", style=f"bold {self._color}")
        text.append(f"  ${self._price:,.4f}\n", style="bold white")
        text.append(f"  {arrow} {self._change:+.2f}%", style=change_color)
        return text


class MetricBox(Static):
    """A box showing a metric with label and value."""

    def __init__(self, label: str, value: str = "—", **kwargs):
        super().__init__(**kwargs)
        self._label = label
        self._value = value

    def update_value(self, value: str):
        self._value = value
        self.refresh()

    def render(self):
        from rich.text import Text
        text = Text()
        text.append(f"  {self._label}\n", style="dim")
        text.append(f"  {self._value}", style="bold white")
        return text


class OverviewScreen(Screen):
    """Overview dashboard tab."""

    BINDINGS = [("r", "refresh", "Refresh")]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._chain = ChainDataProvider()
        self._market = MarketDataProvider()
        self._update_timer: Timer | None = None

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="overview-container"):
            with Horizontal(id="top-row"):
                yield PriceCard("Au (Gold)", "#FFD700", id="au-price-card", classes="price-card")
                yield PriceCard("Ag (Silver)", "#C0C0C0", id="ag-price-card", classes="price-card")
                yield MetricBox("Total TVL", "—", id="tvl-box", classes="metric-box")
                yield MetricBox("Reserve Ratio", "—", id="reserve-box", classes="metric-box")

            with Horizontal(id="middle-row"):
                with Vertical(id="left-panel"):
                    yield Static("═══ PROTOCOL METRICS ═══", id="protocol-header", classes="panel-header")
                    yield MetricBox("PID Emission Rate", "—", id="pid-box")
                    yield MetricBox("Oracle Deviation", "—", id="oracle-box")
                    yield MetricBox("FlashBuy Status", "—", id="flashbuy-box")
                    yield GaugeBar(label="Reserve Ratio", id="reserve-gauge", color="#00FFFF")
                    yield GaugeBar(label="Oracle Health", id="oracle-gauge", color="#00FF00")

                with Vertical(id="right-panel"):
                    yield Static("═══ PRICE HISTORY ═══", id="price-header", classes="panel-header")
                    yield Sparkline(label="Au", color="#FFD700", id="au-sparkline")
                    yield Sparkline(label="Ag", color="#C0C0C0", id="ag-sparkline")

            with Horizontal(id="bottom-row"):
                yield MetricBox("Block", "—", id="block-box", classes="chain-box")
                yield MetricBox("Gas (gwei)", "—", id="gas-box", classes="chain-box")
                yield StatusIndicator(label="RPC Connected", id="rpc-status")
                yield StatusIndicator(label="Oracle Live", id="oracle-status")
                yield StatusIndicator(label="FlashBuy Ready", id="flashbuy-status")

        yield Footer()

    def on_mount(self):
        """Start the update timer."""
        self._update_timer = self.set_interval(1.0, self._tick)
        self._tick()  # Initial update

    def on_unmount(self):
        if self._update_timer:
            self._update_timer.stop()

    def _tick(self):
        """Update all data every second."""
        # Fetch chain data
        overview = self._chain.get_all_overview()

        # Update price cards
        au_card = self.query_one("#au-price-card", PriceCard)
        au_card.update_price(overview.get("au_price", 0.0))

        ag_card = self.query_one("#ag-price-card", PriceCard)
        ag_card.update_price(overview.get("ag_price", 0.0))

        # Update metric boxes
        tvl = overview.get("tvl", 0.0)
        self.query_one("#tvl-box", MetricBox).update_value(f"${tvl:,.2f}")

        reserve = overview.get("reserve_ratio", 0.0)
        self.query_one("#reserve-box", MetricBox).update_value(f"{reserve:.2f}%")

        pid = overview.get("pid_emission", 0.0)
        self.query_one("#pid-box", MetricBox).update_value(f"{pid:,.4f} /s")

        oracle_dev = overview.get("oracle_deviation", 0.0)
        self.query_one("#oracle-box", MetricBox).update_value(f"{oracle_dev:.4f}%")

        flashbuy = overview.get("flashbuy", {})
        fb_active = "ACTIVE" if flashbuy.get("active") else "INACTIVE"
        fb_count = flashbuy.get("trigger_count", 0)
        self.query_one("#flashbuy-box", MetricBox).update_value(f"{fb_active} ({fb_count} triggers)")

        # Update gauges
        reserve_gauge = self.query_one("#reserve-gauge", GaugeBar)
        reserve_gauge.value = reserve

        oracle_gauge = self.query_one("#oracle-gauge", GaugeBar)
        oracle_gauge.value = max(0, 100 - oracle_dev * 100)  # Invert: lower deviation = higher health

        # Update sparklines
        market_data = self._market.get_all_market_data()
        history = market_data.get("price_history", {})

        au_spark = self.query_one("#au-sparkline", Sparkline)
        au_spark.data = history.get("Au", [])

        ag_spark = self.query_one("#ag-sparkline", Sparkline)
        ag_spark.data = history.get("Ag", [])

        # Update chain info
        block = overview.get("block_number", 0)
        self.query_one("#block-box", MetricBox).update_value(f"#{block:,}")

        gas = overview.get("gas_price", 0.0)
        self.query_one("#gas-box", MetricBox).update_value(f"{gas:.2f}")

        # Update status indicators
        conn = overview.get("connection", {})
        rpc_status = self.query_one("#rpc-status", StatusIndicator)
        rpc_status.status = "ok" if conn.get("connected") else "error"

        oracle_status = self.query_one("#oracle-status", StatusIndicator)
        oracle_status.status = "ok" if oracle_dev < 1.0 else "warning" if oracle_dev < 5.0 else "error"

        flashbuy_status = self.query_one("#flashbuy-status", StatusIndicator)
        flashbuy_status.status = "ok" if flashbuy.get("active") else "warning"

    def action_refresh(self):
        """Force refresh all data."""
        self._chain._cache.clear()
        self._market._cache.clear()
        self._tick()
