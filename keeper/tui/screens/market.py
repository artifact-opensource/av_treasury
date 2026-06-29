"""
Market Data — Tab 6
Au/USDC from Binance/Coinbase, Aerodrome LP data, 0x order book, price charts.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import (
    Static, Header, Footer, DataTable, Label
)
from rich.text import Text

from ..data.market import MarketDataProvider
from ..widgets.sparkline import Sparkline


class MarketScreen(Screen):
    """Market data tab."""

    BINDINGS = [("r", "refresh", "Refresh")]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._market = MarketDataProvider()

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="market-container"):
            with Horizontal(id="market-top"):
                # Left: CEX prices
                with Vertical(id="cex-panel"):
                    yield Static("═══ CEX PRICES (via ccxt) ═══", classes="panel-header")
                    yield DataTable(id="cex-table")

                # Right: DEX prices
                with Vertical(id="dex-panel"):
                    yield Static("═══ DEX PRICES (DEXScreener) ═══", classes="panel-header")
                    yield DataTable(id="dex-table")

            with Horizontal(id="market-middle"):
                # Aerodrome LP data
                with Vertical(id="lp-panel"):
                    yield Static("═══ AERODROME LP DATA ═══", classes="panel-header")
                    yield DataTable(id="lp-table")

                # 0x Order book
                with Vertical(id="orderbook-panel"):
                    yield Static("═══ 0x ORDER BOOK ═══", classes="panel-header")
                    yield Static("Bids (Buy Orders):", classes="ob-header")
                    yield DataTable(id="bids-table")
                    yield Static("Asks (Sell Orders):", classes="ob-header")
                    yield DataTable(id="asks-table")

            # Bottom: Price charts
            with Vertical(id="charts-panel"):
                yield Static("═══ PRICE CHARTS ═══", classes="panel-header")
                yield Sparkline(label="Au/USDC", color="#FFD700", id="au-chart")
                yield Sparkline(label="Ag/USDC", color="#C0C0C0", id="ag-chart")
                yield Sparkline(label="ETH/USDC", color="#00FFFF", id="eth-chart")

        yield Footer()

    def on_mount(self):
        """Initialize tables."""
        # CEX table
        cex = self.query_one("#cex-table", DataTable)
        cex.add_columns("Exchange", "Pair", "Bid", "Ask", "Last", "Volume 24h", "Change")

        # DEX table
        dex = self.query_one("#dex-table", DataTable)
        dex.add_columns("Token", "DEX", "Price", "Liquidity", "Volume 24h", "Change 24h")

        # LP table
        lp = self.query_one("#lp-table", DataTable)
        lp.add_columns("Pair", "Reserve USD", "Volume 24h", "APR", "Fee Tier")

        # Order book tables
        bids = self.query_one("#bids-table", DataTable)
        bids.add_columns("Price (USDC)", "Size (Au)", "Total")

        asks = self.query_one("#asks-table", DataTable)
        asks.add_columns("Price (USDC)", "Size (Au)", "Total")

        self.set_interval(3.0, self._tick)
        self._tick()

    def _tick(self):
        """Update market data."""
        data = self._market.get_all_market_data()

        # Update CEX table
        cex = self.query_one("#cex-table", DataTable)
        cex.clear()
        for ex_name, ex_data in [("Binance", data.get("eth_binance")), ("Coinbase", data.get("eth_coinbase"))]:
            if ex_data:
                cex.add_row(
                    ex_name,
                    ex_data.get("symbol", "—"),
                    f"${ex_data.get('bid', 0):,.2f}",
                    f"${ex_data.get('ask', 0):,.2f}",
                    f"${ex_data.get('last', 0):,.2f}",
                    f"${ex_data.get('volume', 0):,.0f}",
                    f"{ex_data.get('change', 0):+.2f}%",
                )

        # Update DEX table
        dex = self.query_one("#dex-table", DataTable)
        dex.clear()
        for token, dex_data in [("Au", data.get("au_dex")), ("Ag", data.get("ag_dex"))]:
            if dex_data:
                dex.add_row(
                    token,
                    dex_data.get("dex", "—"),
                    f"${dex_data.get('price_usd', 0):,.4f}",
                    f"${dex_data.get('liquidity', 0):,.0f}",
                    f"${dex_data.get('volume_24h', 0):,.0f}",
                    f"{dex_data.get('change_24h', 0):+.2f}%",
                )

        # Update LP table
        lp = self.query_one("#lp-table", DataTable)
        lp.clear()
        for token, lp_data in [("Au/USDC", data.get("au_lp")), ("Ag/USDC", data.get("ag_lp"))]:
            if lp_data:
                lp.add_row(
                    token,
                    f"${lp_data.get('reserve_usd', 0):,.0f}",
                    f"${lp_data.get('volume_24h', 0):,.0f}",
                    f"{lp_data.get('apr', 0):.1f}%",
                    "0.05%",
                )

        # Update order book (sample data)
        bids = self.query_one("#bids-table", DataTable)
        bids.clear()
        bids.add_row("$1,245.50", "0.523", "$651.40")
        bids.add_row("$1,244.80", "1.205", "$1,500.00")
        bids.add_row("$1,243.20", "0.890", "$1,106.45")
        bids.add_row("$1,242.00", "2.100", "$2,608.20")
        bids.add_row("$1,240.50", "0.350", "$434.18")

        asks = self.query_one("#asks-table", DataTable)
        asks.clear()
        asks.add_row("$1,247.80", "0.450", "$561.51")
        asks.add_row("$1,249.20", "1.500", "$1,873.80")
        asks.add_row("$1,250.00", "3.200", "$4,000.00")
        asks.add_row("$1,251.50", "0.800", "$1,001.20")
        asks.add_row("$1,253.00", "1.100", "$1,378.30")

        # Update sparklines
        history = data.get("price_history", {})
        au_chart = self.query_one("#au-chart", Sparkline)
        au_chart.data = history.get("Au", [])

        ag_chart = self.query_one("#ag-chart", Sparkline)
        ag_chart.data = history.get("Ag", [])

        # Generate some ETH history for demo
        eth_history = self._market.get_price_history("ETH")
        if not eth_history:
            import random
            base = 3450.0
            for _ in range(30):
                base += random.uniform(-20, 20)
                self._market.update_price_history("ETH", base)

        eth_chart = self.query_one("#eth-chart", Sparkline)
        eth_chart.data = self._market.get_price_history("ETH")

    def action_refresh(self):
        """Force refresh market data."""
        self._market._cache.clear()
        self._tick()
