"""Treasury screen - AMO & Reserve management."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable, Input, Button
from textual.timer import Timer
import asyncio
import time

from tui.widgets.gauge import ProgressBar
from tui.data import feeds
from tui.data.config import TREASURY_AMO, NOT_DEPLOYED, TREASURY_SAFE


class TreasuryScreen(Screen):
    """Treasury AMO & Reserve screen."""

    BINDINGS = [
        ("3", "app.switch_mode('treasury')", "Treasury"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._onchain_timer = None
        self._heavy_timer = None

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="treasury-content"):
            with Horizontal(id="top-section"):
                # Reserve Composition
                with Vertical(id="reserve-panel"):
                    yield Static("[b]Reserve Composition[/b]", classes="section-title")
                    yield Static("ETH: [cyan]...[/cyan]", id="reserve-eth")
                    yield Static("USDC: [cyan]...[/cyan]", id="reserve-usdc")
                    yield Static("Total Value: [cyan]...[/cyan]", id="reserve-total")
                    yield Static("", classes="spacer")
                    yield Static("[b]NAV Per Au Token[/b]", classes="section-title")
                    yield Static("$[cyan]...[/cyan]", id="nav-display")
                    yield Static("", classes="spacer")
                    yield ProgressBar(id="nav-progress", value=0, max_value=2, label="NAV vs Peg ($1)", color="#FFD700")

                # Deposit/Redeem
                with Vertical(id="deposit-panel"):
                    yield Static("[b]Deposit / Redeem[/b]", classes="section-title")
                    yield Static("Amount:", id="deposit-label")
                    yield Input(placeholder="0.0", id="deposit-amount")
                    with Horizontal(id="deposit-buttons"):
                        yield Button("Deposit ETH", id="btn-deposit", variant="success")
                        yield Button("Redeem Au", id="btn-redeem", variant="warning")
                    yield Static("", id="deposit-status")
                    yield Static("", classes="spacer")
                    yield Static("[b]Treasury Safe[/b]", classes="section-title")
                    yield Static(f"[dim]{TREASURY_SAFE[:10]}...{TREASURY_SAFE[-8:]}[/]", id="safe-address")
                    yield Static("Balance: [cyan]...[/cyan]", id="safe-balance")

            # Buyback History
            yield Static("[b]Buyback History[/b]", classes="section-title")
            yield DataTable(id="buyback-table")

            # Recent Safe Transactions
            yield Static("[b]Recent Treasury Transactions[/b]", classes="section-title")
            yield DataTable(id="safe-tx-table")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._onchain_timer = self.set_interval(3.0, self._fetch_onchain)
        self._heavy_timer = self.set_interval(12.0, self._fetch_heavy)
        self.run_worker(self._fetch_onchain())
        self.run_worker(self._fetch_heavy())
        self._setup_tables()

    def _setup_tables(self):
        """Setup data tables."""
        buyback_table = self.query_one("#buyback-table", DataTable)
        buyback_table.add_columns("Time", "Amount (ETH)", "Au Burned", "Price", "Tx")

        safe_table = self.query_one("#safe-tx-table", DataTable)
        safe_table.add_columns("Date", "To", "Value", "Status", "Nonce")

    async def _fetch_onchain(self):
        """Fetch on-chain treasury data."""
        try:
            onchain = await feeds.fetch_onchain_data()

            # NAV
            nav = onchain.get("nav_per_token")
            nav_display = self.query_one("#nav-display", Static)
            nav_progress = self.query_one("#nav-progress", ProgressBar)

            if nav is not None:
                nav_val = nav / 1e18
                nav_display.update(f"$[cyan]{nav_val:.4f}[/cyan]")
                nav_progress.update_value(min(nav_val, 2.0), 2.0)
            elif TREASURY_AMO in NOT_DEPLOYED:
                nav_display.update("$[dim]Not Deployed[/dim]")
            else:
                nav_display.update("$[dim]N/A[/dim]")

            # Reserve value
            reserve = onchain.get("total_reserve")
            reserve_display = self.query_one("#reserve-total", Static)
            if reserve is not None:
                reserve_display.update(f"Total Value: [cyan]${reserve / 1e18:,.2f}[/cyan]")
            elif TREASURY_AMO in NOT_DEPLOYED:
                reserve_display.update("Total Value: [dim]Not Deployed[/dim]")
            else:
                reserve_display.update("Total Value: [dim]N/A[/dim]")

            # Reserve composition (placeholder until AMO is deployed)
            reserve_eth = self.query_one("#reserve-eth", Static)
            reserve_usdc = self.query_one("#reserve-usdc", Static)
            if TREASURY_AMO in NOT_DEPLOYED:
                reserve_eth.update("ETH: [dim]N/A (AMO not deployed)[/dim]")
                reserve_usdc.update("USDC: [dim]N/A (AMO not deployed)[/dim]")
            else:
                reserve_eth.update("ETH: [cyan]...[/cyan]")
                reserve_usdc.update("USDC: [cyan]...[/cyan]")

        except Exception:
            pass

    async def _fetch_heavy(self):
        """Fetch heavy data (safe txs)."""
        try:
            # Safe balance
            safe_balance = await feeds.fetch_eth_balance(TREASURY_SAFE)
            safe_display = self.query_one("#safe-balance", Static)
            safe_display.update(f"Balance: [cyan]{safe_balance / 1e18:.4f} ETH[/cyan]")

            # Safe transactions
            txs = await feeds.fetch_treasury_safe_txs(10)
            table = self.query_one("#safe-tx-table", DataTable)
            table.clear()
            for tx in txs[:10]:
                timestamp = tx.get("executionDate", "")[:16] if tx.get("executionDate") else "N/A"
                to_addr = tx.get("to", "N/A")
                if len(to_addr) > 14:
                    to_addr = f"{to_addr[:10]}...{to_addr[-4:]}"
                value = int(tx.get("value", 0)) / 1e18
                executed = tx.get("isExecuted", False)
                status = "[green]Done[/green]" if executed else "[yellow]Pending[/yellow]"
                nonce = tx.get("nonce", "N/A")
                table.add_row(timestamp, to_addr, f"{value:.4f} ETH", status, str(nonce))

        except Exception:
            pass

    def on_button_pressed(self, event: Button.Pressed):
        """Handle button presses."""
        btn_id = event.button.id
        amount_input = self.query_one("#deposit-amount", Input)
        amount = amount_input.value
        status = self.query_one("#deposit-status", Static)

        if btn_id == "btn-deposit":
            if not amount or amount == "0":
                status.update("[red]Please enter an amount[/red]")
            else:
                status.update(f"[yellow]Deposit {amount} ETH - Connect wallet to execute[/yellow]")
        elif btn_id == "btn-redeem":
            if not amount or amount == "0":
                status.update("[red]Please enter an amount[/red]")
            else:
                status.update(f"[yellow]Redeem {amount} Au - Connect wallet to execute[/yellow]")
