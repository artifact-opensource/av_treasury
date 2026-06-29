"""Tokens screen - Au & Ag token analytics."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable
from textual.timer import Timer
import asyncio
import time

from tui.widgets.sparkline import Sparkline
from tui.data import feeds
from tui.data.config import AU_TOKEN, AG_TOKEN


class TokensScreen(Screen):
    """Token analytics screen."""

    BINDINGS = [
        ("2", "app.switch_mode('tokens')", "Tokens"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._price_timer = None
        self._onchain_timer = None

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="tokens-content"):
            with Horizontal(id="token-cards-row"):
                # Au Token Card
                with Vertical(id="au-token-card", classes="token-card"):
                    yield Static("[b]Au (Gold)[/b]", classes="token-title")
                    yield Static(f"[dim]{AU_TOKEN[:10]}...{AU_TOKEN[-8:]}[/]", id="au-address")
                    yield Static("", classes="spacer")
                    yield Static("Supply: [cyan]...[/cyan]", id="au-supply")
                    yield Static("Holders: [cyan]...[/cyan]", id="au-holders")
                    yield Static("Transfer Fee: [cyan]...[/cyan]", id="au-fee")
                    yield Static("Max Wallet: [cyan]...[/cyan]", id="au-maxwallet")
                    yield Static("Price: [cyan]...[/cyan]", id="au-price")
                    yield Static("24h Change: [cyan]...[/cyan]", id="au-change")
                    yield Static("24h Volume: [cyan]...[/cyan]", id="au-volume")
                    yield Static("Market Cap: [cyan]...[/cyan]", id="au-mcap")
                    yield Static("", classes="spacer")
                    yield Static("[b]Price Chart[/b]", classes="section-title")
                    yield Sparkline(id="au-spark", width=40, height=4)

                # Ag Token Card
                with Vertical(id="ag-token-card", classes="token-card"):
                    yield Static("[b]Ag (Silver)[/b]", classes="token-title")
                    yield Static(f"[dim]{AG_TOKEN[:10]}...{AG_TOKEN[-8:]}[/]", id="ag-address")
                    yield Static("", classes="spacer")
                    yield Static("Supply: [cyan]...[/cyan]", id="ag-supply")
                    yield Static("Holders: [cyan]...[/cyan]", id="ag-holders")
                    yield Static("Staking Dist: [cyan]...[/cyan]", id="ag-staking")
                    yield Static("Price: [cyan]...[/cyan]", id="ag-price")
                    yield Static("24h Change: [cyan]...[/cyan]", id="ag-change")
                    yield Static("24h Volume: [cyan]...[/cyan]", id="ag-volume")
                    yield Static("Market Cap: [cyan]...[/cyan]", id="ag-mcap")
                    yield Static("", classes="spacer")
                    yield Static("[b]Price Chart[/b]", classes="section-title")
                    yield Sparkline(id="ag-spark", width=40, height=4)

            # Liquidity section
            yield Static("[b]Liquidity Pools[/b]", classes="section-title")
            yield DataTable(id="liquidity-table")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._price_timer = self.set_interval(1.0, self._fetch_prices)
        self._onchain_timer = self.set_interval(3.0, self._fetch_onchain)
        self.run_worker(self._fetch_prices())
        self.run_worker(self._fetch_onchain())
        self._setup_table()

    def _setup_table(self):
        """Setup liquidity table."""
        table = self.query_one("#liquidity-table", DataTable)
        table.add("DEX", "Pair", "Liquidity", "Volume 24h", "Price")

    async def _fetch_prices(self):
        """Fetch price data."""
        try:
            prices = await feeds.fetch_all_prices()
            au_data = prices.get("au", {})
            ag_data = prices.get("ag", {})

            # Update Au
            au_price = self.query_one("#au-price", Static)
            au_change = self.query_one("#au-change", Static)
            au_volume = self.query_one("#au-volume", Static)
            au_mcap = self.query_one("#au-mcap", Static)

            au_price.update(f"Price: [cyan]${au_data.get('price_usd', 0):.6f}[/cyan]")
            change = au_data.get("price_change_24h", 0)
            change_color = "green" if change >= 0 else "red"
            au_change.update(f"24h Change: [{change_color}]{change:+.2f}%[/{change_color}]")
            au_volume.update(f"24h Volume: [cyan]${au_data.get('volume_24h', 0):,.0f}[/cyan]")
            au_mcap.update(f"Market Cap: [cyan]${au_data.get('market_cap', 0):,.0f}[/cyan]")

            # Update Ag
            ag_price = self.query_one("#ag-price", Static)
            ag_change = self.query_one("#ag-change", Static)
            ag_volume = self.query_one("#ag-volume", Static)
            ag_mcap = self.query_one("#ag-mcap", Static)

            ag_price.update(f"Price: [cyan]${ag_data.get('price_usd', 0):.6f}[/cyan]")
            change = ag_data.get("price_change_24h", 0)
            change_color = "green" if change >= 0 else "red"
            ag_change.update(f"24h Change: [{change_color}]{change:+.2f}%[/{change_color}]")
            ag_volume.update(f"24h Volume: [cyan]${ag_data.get('volume_24h', 0):,.0f}[/cyan]")
            ag_mcap.update(f"Market Cap: [cyan]${ag_data.get('market_cap', 0):,.0f}[/cyan]")

            # Update sparklines
            history = feeds.get_price_history()
            if history:
                au_spark = self.query_one("#au-spark", Sparkline)
                au_spark.update_data(history)

            # Update liquidity table
            table = self.query_one("#liquidity-table", DataTable)
            table.clear()
            au_liq = au_data.get("liquidity_usd", 0)
            ag_liq = ag_data.get("liquidity_usd", 0)
            au_vol = au_data.get("volume_24h", 0)
            ag_vol = ag_data.get("volume_24h", 0)
            au_dex = au_data.get("dex", "Aerodrome")
            ag_dex = ag_data.get("dex", "Aerodrome")
            table.add_row(au_dex, "Au/ETH", f"${au_liq:,.0f}", f"${au_vol:,.0f}", f"${au_data.get('price_usd', 0):.6f}")
            table.add_row(ag_dex, "Ag/ETH", f"${ag_liq:,.0f}", f"${ag_vol:,.0f}", f"${ag_data.get('price_usd', 0):.6f}")

        except Exception:
            pass

    async def _fetch_onchain(self):
        """Fetch on-chain data."""
        try:
            onchain = await feeds.fetch_onchain_data()

            # Au supply
            au_supply = onchain.get("au_supply")
            if au_supply is not None:
                supply_display = self.query_one("#au-supply", Static)
                supply_display.update(f"Supply: [cyan]{au_supply / 1e18:,.0f} Au[/cyan]")

            # Au holders
            au_holders = onchain.get("au_holders")
            if au_holders is not None:
                holders_display = self.query_one("#au-holders", Static)
                holders_display.update(f"Holders: [cyan]{au_holders:,}[/cyan]")

            # Au transfer fee
            au_fee = onchain.get("au_transfer_fee") if "au_transfer_fee" in onchain else None
            if au_fee is None:
                # Try fetching directly
                au_fee = await feeds.fetch_au_transfer_fee()
            if au_fee is not None:
                fee_display = self.query_one("#au-fee", Static)
                fee_display.update(f"Transfer Fee: [cyan]{au_fee / 100:.2f}%[/cyan]")

            # Au max wallet
            au_max = await feeds.fetch_au_max_wallet()
            if au_max is not None:
                max_display = self.query_one("#au-maxwallet", Static)
                max_display.update(f"Max Wallet: [cyan]{au_max / 1e18:,.0f} Au[/cyan]")

            # Ag supply
            ag_supply = onchain.get("ag_supply")
            if ag_supply is not None:
                supply_display = self.query_one("#ag-supply", Static)
                supply_display.update(f"Supply: [cyan]{ag_supply / 1e18:,.0f} Ag[/cyan]")

            # Ag holders (use same as supply for now)
            ag_holders = self.query_one("#ag-holders", Static)
            ag_holders.update("Holders: [dim]N/A[/dim]")

            # Ag staking
            ag_staking = self.query_one("#ag-staking", Static)
            ag_staking.update("Staking Dist: [dim]N/A[/dim]")

        except Exception:
            pass
