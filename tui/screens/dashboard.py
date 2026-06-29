"""Dashboard screen - main overview of the AV Treasury ecosystem."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Grid, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable
from textual.color import Color
from textual.reactive import reactive
from textual.timer import Timer
import asyncio
import time

from tui.widgets.price_card import PriceCard
from tui.widgets.gauge import Gauge, ProgressBar
from tui.widgets.sparkline import Sparkline
from tui.data import feeds
from tui.data.config import COLORS, NOT_DEPLOYED, TREASURY_AMO, PID_CONTROLLER


class DashboardScreen(Screen):
    """Main dashboard overview screen."""

    BINDINGS = [
        ("1", "app.switch_mode('dashboard')", "Dashboard"),
        ("q", "app.quit", "Quit"),
    ]

    au_price = reactive(0.0)
    ag_price = reactive(0.0)
    block_height = reactive(0)
    gas_price = reactive(0.0)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._price_timer = None
        self._onchain_timer = None
        self._data_cache = {}

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="dashboard-content"):
            with Horizontal(id="top-row"):
                yield PriceCard(
                    id="au-price-card",
                    symbol="Au (Gold)",
                    price=0.0,
                    change_24h=0.0,
                    volume_24h=0.0,
                    market_cap=0.0,
                )
                yield PriceCard(
                    id="ag-price-card",
                    symbol="Ag (Silver)",
                    price=0.0,
                    change_24h=0.0,
                    volume_24h=0.0,
                    market_cap=0.0,
                )
                with Vertical(id="network-info"):
                    yield Static("[b]Network Status[/b]\n", id="network-title")
                    yield Static("Chain: Base Mainnet (8453)", id="chain-info")
                    yield Static("Block: [cyan]...[/cyan]", id="block-display")
                    yield Static("Gas: [cyan]...[/cyan]", id="gas-display")
                    yield Static("Status: [green]Connected[/green]", id="conn-status")
                    yield Static("", id="tvl-display")

            with Horizontal(id="middle-row"):
                with Vertical(id="left-panel"):
                    yield Static("[b]Reserve Ratio[/b]", classes="section-title")
                    yield Gauge(
                        id="reserve-gauge",
                        value=0,
                        max_value=100,
                        label="Collateral",
                    )
                    yield Static("[b]PID Emission[/b]", classes="section-title")
                    yield Static("Rate: [cyan]...[/cyan]", id="pid-rate")
                    yield Static("Next Epoch: [cyan]...[/cyan]", id="pid-epoch")
                    yield Static("Status: [cyan]...[/cyan]", id="pid-status")
                    yield Static("[b]FlashBuy[/b]", classes="section-title")
                    yield Static("Last Trigger: [cyan]...[/cyan]", id="flashbuy-last")
                    yield Static("Cooldown: [cyan]...[/cyan]", id="flashbuy-cooldown")
                    yield Static("Status: [cyan]...[/cyan]", id="flashbuy-status")

                with Vertical(id="right-panel"):
                    yield Static("[b]Au Price (60s)[/b]", classes="section-title")
                    yield Sparkline(id="au-sparkline", width=50, height=4)
                    yield Static("", id="price-range-info")
                    yield Static("[b]Total Value Locked[/b]", classes="section-title")
                    yield Static("DEX Pools: [cyan]...[/cyan]", id="tvl-dex")
                    yield Static("QuasiCrystal: [cyan]...[/cyan]", id="tvl-nft")
                    yield Static("Treasury: [cyan]...[/cyan]", id="tvl-treasury")

        yield Footer()

    def on_mount(self):
        """Start timers when screen mounts."""
        self._price_timer = self.set_interval(1.0, self._fetch_prices)
        self._onchain_timer = self.set_interval(3.0, self._fetch_onchain)
        # Initial fetch
        self.run_worker(self._fetch_prices())
        self.run_worker(self._fetch_onchain())

    async def _fetch_prices(self):
        """Fetch price data (1s tick)."""
        try:
            dashboard_data = await feeds.fetch_dashboard_data()
            self._data_cache.update(dashboard_data)

            prices = dashboard_data.get("prices", {})
            au_data = prices.get("au", {})
            ag_data = prices.get("ag", {})

            # Update price cards
            au_card = self.query_one("#au-price-card", PriceCard)
            ag_card = self.query_one("#ag-price-card", PriceCard)

            au_card.update_data(
                symbol="Au (Gold)",
                price=au_data.get("price_usd", 0),
                change_24h=au_data.get("price_change_24h", 0),
                volume_24h=au_data.get("volume_24h", 0),
                market_cap=au_data.get("market_cap", 0),
            )
            ag_card.update_data(
                symbol="Ag (Silver)",
                price=ag_data.get("price_usd", 0),
                change_24h=ag_data.get("price_change_24h", 0),
                volume_24h=ag_data.get("volume_24h", 0),
                market_cap=ag_data.get("market_cap", 0),
            )

            # Update network info
            block = dashboard_data.get("block", 0)
            gas = dashboard_data.get("gas", 0.0)

            block_display = self.query_one("#block-display", Static)
            gas_display = self.query_one("#gas-display", Static)
            block_display.update(f"Block: [cyan]{block:,}[/cyan]")
            gas_display.update(f"Gas: [cyan]{gas:.4f} gwei[/cyan]")

            # Update sparkline
            history = feeds.get_price_history()
            if history:
                sparkline = self.query_one("#au-sparkline", Sparkline)
                sparkline.update_data(history)

            # Update TVL
            tvl = au_data.get("liquidity_usd", 0) + ag_data.get("liquidity_usd", 0)
            tvl_display = self.query_one("#tvl-display", Static)
            tvl_display.update(f"TVL: [cyan]${tvl:,.0f}[/cyan]")

            tvl_dex = self.query_one("#tvl-dex", Static)
            tvl_dex.update(f"DEX Pools: [cyan]${au_data.get('liquidity_usd', 0) + ag_data.get('liquidity_usd', 0):,.0f}[/cyan]")

            # Update status bar
            try:
                status_bar = self.app.query_one("#status-bar")
                status_bar.update_block(block)
                status_bar.update_gas(gas)
            except Exception:
                pass

        except Exception:
            pass  # Never crash

    async def _fetch_onchain(self):
        """Fetch on-chain data (3s tick)."""
        try:
            onchain = await feeds.fetch_onchain_data()
            self._data_cache.update(onchain)

            # Reserve ratio
            reserve_ratio = onchain.get("reserve_ratio")
            if reserve_ratio is not None:
                ratio_pct = reserve_ratio / 100  # basis points to percent
                gauge = self.query_one("#reserve-gauge", Gauge)
                gauge.update_value(ratio_pct)

            # PID emission
            pid_rate = self.query_one("#pid-rate", Static)
            pid_epoch = self.query_one("#pid-epoch", Static)
            pid_status = self.query_one("#pid-status", Static)

            if PID_CONTROLLER in NOT_DEPLOYED:
                pid_rate.update("Rate: [dim]Not Deployed[/dim]")
                pid_epoch.update("Next Epoch: [dim]N/A[/dim]")
                pid_status.update("Status: [dim]N/A[/dim]")
            else:
                emission = onchain.get("pid_emission")
                next_epoch = onchain.get("pid_next_epoch")
                active = onchain.get("pid_active")

                if emission is not None:
                    pid_rate.update(f"Rate: [cyan]{emission / 1e18:.4f} Au/epoch[/cyan]")
                if next_epoch is not None:
                    remaining = max(0, next_epoch - int(time.time()))
                    pid_epoch.update(f"Next Epoch: [cyan]{remaining}s[/cyan]")
                if active is not None:
                    status_color = "green" if active else "red"
                    pid_status.update(f"Status: [{status_color}]{'Active' if active else 'Paused'}[/{status_color}]")

            # FlashBuy
            fb_last = self.query_one("#flashbuy-last", Static)
            fb_cool = self.query_one("#flashbuy-cooldown", Static)
            fb_status = self.query_one("#flashbuy-status", Static)

            last_trigger = onchain.get("flashbuy_last")
            cooldown = onchain.get("flashbuy_cooldown")
            fb_active = onchain.get("flashbuy_active")

            if last_trigger is not None and last_trigger > 0:
                ago = int(time.time()) - last_trigger
                fb_last.update(f"Last Trigger: [cyan]{ago}s ago[/cyan]")
            else:
                fb_last.update("Last Trigger: [dim]Never[/dim]")

            if cooldown is not None:
                fb_cool.update(f"Cooldown: [cyan]{cooldown}s remaining[/cyan]")
            else:
                fb_cool.update("Cooldown: [dim]N/A[/dim]")

            if fb_active is not None:
                color = "green" if fb_active else "red"
                fb_status.update(f"Status: [{color}]{'Active' if fb_active else 'Cooldown'}[/{color}]")
            else:
                fb_status.update("Status: [dim]N/A[/dim]")

            # Treasury NAV
            nav = self.query_one("#tvl-treasury", Static)
            nav_val = onchain.get("nav_per_token")
            if nav_val is not None:
                nav.update(f"Treasury NAV/Au: [cyan]${nav_val / 1e18:.4f}[/cyan]")
            elif TREASURY_AMO in NOT_DEPLOYED:
                nav.update("Treasury: [dim]Not Deployed[/dim]")
            else:
                nav.update("Treasury: [dim]N/A[/dim]")

        except Exception:
            pass  # Never crash
