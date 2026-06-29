"""Oracle screen - Price feeds & deviation monitoring."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable
from textual.timer import Timer
import asyncio
import time

from tui.widgets.sparkline import Sparkline
from tui.widgets.gauge import ProgressBar
from tui.data import feeds
from tui.data.config import AVORACLE_V5, AU_TOKEN


class OracleScreen(Screen):
    """Oracle price feeds screen."""

    BINDINGS = [
        ("6", "app.switch_mode('oracle')", "Oracle"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._price_timer = None
        self._onchain_timer = None

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="oracle-content"):
            # Price columns
            with Horizontal(id="price-columns"):
                with Vertical(classes="oracle-col"):
                    yield Static("[b]AvOracle v5[/b]", classes="oracle-title")
                    yield Static(f"[dim]{AVORACLE_V5[:10]}...{AVORACLE_V5[-8:]}[/]")
                    yield Static("Price: [cyan]...[/cyan]", id="avoracle-price")
                    yield Static("TWAP: [cyan]...[/cyan]", id="avoracle-twap")
                    yield Static("Source: On-chain", id="avoracle-source")
                    yield Static("Status: [green]Active[/green]", id="avoracle-health")

                with Vertical(classes="oracle-col"):
                    yield Static("[b]DEXScreener[/b]", classes="oracle-title")
                    yield Static(f"[dim]{AU_TOKEN[:10]}...{AU_TOKEN[-8:]}[/]")
                    yield Static("Price: [cyan]...[/cyan]", id="dex-price")
                    yield Static("24h Vol: [cyan]...[/cyan]", id="dex-vol")
                    yield Static("Source: Aggregated DEX", id="dex-source")
                    yield Static("Status: [green]Active[/green]", id="dex-health")

                with Vertical(classes="oracle-col"):
                    yield Static("[b]Chainlink[/b]", classes="oracle-title")
                    yield Static("[dim]No feed on Base[/dim]")
                    yield Static("Price: [dim]N/A[/dim]", id="chainlink-price")
                    yield Static("Deviation: [dim]N/A[/dim]", id="chainlink-dev")
                    yield Static("Source: N/A", id="chainlink-source")
                    yield Static("Status: [dim]N/A[/dim]", id="chainlink-health")

            # Deviation indicator
            yield Static("[b]Price Deviation[/b]", classes="section-title")
            with Horizontal(id="deviation-row"):
                with Vertical():
                    yield Static("AvOracle vs DEX:", classes="deviation-label")
                    yield Static("[cyan]...[/cyan]", id="dev-oracle-dex")
                with Vertical():
                    yield Static("AvOracle vs Chainlink:", classes="deviation-label")
                    yield Static("[dim]N/A[/dim]", id="dev-oracle-chainlink")
                with Vertical():
                    yield Static("DEX vs Chainlink:", classes="deviation-label")
                    yield Static("[dim]N/A[/dim]", id="dev-dex-chainlink")

            # Below-peg alert
            yield Static("[b]Peg Status[/b]", classes="section-title")
            with Horizontal(id="peg-status"):
                yield Static("Au Peg: $1.00", id="peg-target")
                yield Static("Current: [cyan]...[/cyan]", id="peg-current")
                yield Static("Status: [green]Above Peg[/green]", id="peg-alert")
                yield ProgressBar(id="peg-progress", value=100, max_value=200, label="Peg Ratio", color="#00FF88")

            # TWAP Chart
            yield Static("[b]TWAP History[/b]", classes="section-title")
            yield Sparkline(id="twap-sparkline", width=50, height=4)

            # Oracle Health
            yield Static("[b]Oracle Health Check[/b]", classes="section-title")
            yield DataTable(id="health-table")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._price_timer = self.set_interval(1.0, self._fetch_prices)
        self._onchain_timer = self.set_interval(3.0, self._fetch_onchain)
        self.run_worker(self._fetch_prices())
        self.run_worker(self._fetch_onchain())
        self._setup_table()

    def _setup_table(self):
        """Setup health table."""
        table = self.query_one("#health-table", DataTable)
        table.add_columns("Oracle", "Price", "Last Update", "Deviation", "Status")
        table.add_row("AvOracle v5", "...", "...", "...", "...")
        table.add_row("DEXScreener", "...", "...", "...", "...")
        table.add_row("Chainlink", "N/A", "N/A", "N/A", "N/A")

    async def _fetch_prices(self):
        """Fetch DEXScreener price."""
        try:
            prices = await feeds.fetch_all_prices()
            au_data = prices.get("au", {})

            dex_price = au_data.get("price_usd", 0)
            dex_display = self.query_one("#dex-price", Static)
            dex_display.update(f"Price: [cyan]${dex_price:.6f}[/cyan]")

            dex_vol = self.query_one("#dex-vol", Static)
            dex_vol.update(f"24h Vol: [cyan]${au_data.get('volume_24h', 0):,.0f}[/cyan]")

            # Update peg status
            peg_current = self.query_one("#peg-current", Static)
            peg_current.update(f"Current: [cyan]${dex_price:.6f}[/cyan]")

            peg_alert = self.query_one("#peg-alert", Static)
            peg_progress = self.query_one("#peg-progress", ProgressBar)

            if dex_price >= 1.0:
                peg_alert.update("Status: [green]Above Peg ✓[/green]")
                peg_progress.update_value(min(dex_price * 100, 200), 200)
            elif dex_price >= 0.95:
                peg_alert.update("Status: [yellow]Near Peg ⚠[/yellow]")
                peg_progress.update_value(dex_price * 100, 200)
            else:
                peg_alert.update("Status: [red]Below Peg ✗[/red]")
                peg_progress.update_value(dex_price * 100, 200)

            # Update deviation
            oracle_price_text = self.query_one("#avoracle-price", Static)
            oracle_price_str = oracle_price_text.render_text() if hasattr(oracle_price_text, 'render_text') else ""

            # Update health table
            table = self.query_one("#health-table", DataTable)
            table.clear()
            table.add_row("DEXScreener", f"${dex_price:.6f}", "< 1s", "0.00%", "[green]Healthy[/green]")

        except Exception:
            pass

    async def _fetch_onchain(self):
        """Fetch on-chain oracle data."""
        try:
            onchain = await feeds.fetch_onchain_data()

            # AvOracle price
            oracle_price = onchain.get("avoracle_price")
            oracle_display = self.query_one("#avoracle-price", Static)
            if oracle_price is not None:
                oracle_display.update(f"Price: [cyan]${oracle_price:.6f}[/cyan]")
            else:
                oracle_display.update("Price: [dim]N/A[/dim]")

            # TWAP
            twap = onchain.get("avoracle_twap")
            twap_display = self.query_one("#avoracle-twap", Static)
            if twap is not None:
                twap_display.update(f"TWAP: [cyan]${twap:.6f}[/cyan]")
            else:
                twap_display.update("TWAP: [dim]N/A[/dim]")

            # Deviation
            if oracle_price is not None:
                prices = await feeds.fetch_all_prices()
                dex_price = prices.get("au", {}).get("price_usd", 0)
                if dex_price > 0 and oracle_price > 0:
                    deviation = abs(oracle_price - dex_price) / dex_price * 100
                    dev_display = self.query_one("#dev-oracle-dex", Static)
                    if deviation < 0.5:
                        dev_display.update(f"[green]{deviation:.4f}%[/green]")
                    elif deviation < 2.0:
                        dev_display.update(f"[yellow]{deviation:.4f}%[/yellow]")
                    else:
                        dev_display.update(f"[red]{deviation:.4f}%[/red]")

            # Update health table
            table = self.query_one("#health-table", DataTable)
            table.clear()
            if oracle_price is not None:
                table.add_row("AvOracle v5", f"${oracle_price:.6f}", "< 3s", "—", "[green]Healthy[/green]")
            else:
                table.add_row("AvOracle v5", "N/A", "N/A", "N/A", "[dim]N/A[/dim]")

            prices = await feeds.fetch_all_prices()
            dex_price = prices.get("au", {}).get("price_usd", 0)
            table.add_row("DEXScreener", f"${dex_price:.6f}", "< 1s", "—", "[green]Healthy[/green]")
            table.add_row("Chainlink", "N/A", "N/A", "N/A", "[dim]No feed[/dim]")

        except Exception:
            pass
