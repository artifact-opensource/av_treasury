"""Wallet screen - Connected wallet info & send."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable, Input, Button
from textual.timer import Timer
import asyncio

from tui.data import feeds
from tui.data.config import AU_TOKEN, AG_TOKEN


class WalletScreen(Screen):
    """Connected wallet screen."""

    BINDINGS = [
        ("8", "app.switch_mode('wallet')", "Wallet"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._onchain_timer = None
        self._wallet_address = ""

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="wallet-content"):
            # Wallet connection
            with Horizontal(id="wallet-header"):
                with Vertical():
                    yield Static("[b]Wallet[/b]", classes="section-title")
                    yield Input(placeholder="0x... (paste address or connect)", id="wallet-input")
                    yield Button("Connect / Load", id="btn-connect", variant="primary")
                with Vertical():
                    yield Static("[b]Address[/b]", classes="section-title")
                    yield Static("[dim]Not connected[/dim]", id="wallet-address")
                    yield Static("Network: Base Mainnet", id="wallet-network")

            # Balances
            yield Static("[b]Token Balances[/b]", classes="section-title")
            with Horizontal(id="balances-row"):
                with Vertical(classes="balance-card"):
                    yield Static("[b]ETH[/b]", classes="token-label")
                    yield Static("[cyan]0.0000 ETH[/cyan]", id="eth-balance")
                    yield Static("$0.00", id="eth-value")
                with Vertical(classes="balance-card"):
                    yield Static("[b]Au[/b]", classes="token-label")
                    yield Static("[cyan]0.0000 Au[/cyan]", id="au-balance")
                    yield Static("$0.00", id="au-value")
                with Vertical(classes="balance-card"):
                    yield Static("[b]Ag[/b]", classes="token-label")
                    yield Static("[cyan]0.0000 Ag[/cyan]", id="ag-balance")
                    yield Static("$0.00", id="ag-value")

            # Send Form
            yield Static("[b]Send Tokens[/b]", classes="section-title")
            with Horizontal(id="send-form"):
                with Vertical():
                    yield Static("Token:")
                    yield Input(placeholder="ETH / Au / Ag", id="send-token")
                    yield Static("Recipient:")
                    yield Input(placeholder="0x...", id="send-recipient")
                    yield Static("Amount:")
                    yield Input(placeholder="0.0", id="send-amount")
                    yield Button("Send", id="btn-send", variant="success")
            yield Static("", id="send-status")

            # Recent Transactions
            yield Static("[b]Recent Transactions[/b]", classes="section-title")
            yield DataTable(id="tx-table")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._onchain_timer = self.set_interval(3.0, self._fetch_balances)
        self._setup_table()

    def _setup_table(self):
        """Setup transactions table."""
        table = self.query_one("#tx-table", DataTable)
        table.add_columns("Hash", "To", "Value", "Token", "Time", "Status")

    async def _fetch_balances(self):
        """Fetch wallet balances."""
        try:
            if not self._wallet_address:
                return

            eth_bal, au_bal, ag_bal = await asyncio.gather(
                feeds.fetch_eth_balance(self._wallet_address),
                feeds.fetch_au_balance(self._wallet_address),
                feeds.fetch_ag_balance(self._wallet_address),
            )

            # ETH
            eth_display = self.query_one("#eth-balance", Static)
            eth_display.update(f"[cyan]{eth_bal / 1e18:.4f} ETH[/cyan]")
            eth_value = self.query_one("#eth-value", Static)
            eth_value.update(f"$—")  # Would need ETH price

            # Au
            au_display = self.query_one("#au-balance", Static)
            au_display.update(f"[cyan]{au_bal / 1e18:,.4f} Au[/cyan]")

            # Ag
            ag_display = self.query_one("#ag-balance", Static)
            ag_display.update(f"[cyan]{ag_bal / 1e18:,.4f} Ag[/cyan]")

            # Get prices for values
            prices = await feeds.fetch_all_prices()
            au_price = prices.get("au", {}).get("price_usd", 0)
            ag_price = prices.get("ag", {}).get("price_usd", 0)

            au_value = self.query_one("#au-value", Static)
            au_value.update(f"${(au_bal / 1e18) * au_price:,.2f}")

            ag_value = self.query_one("#ag-value", Static)
            ag_value.update(f"${(ag_bal / 1e18) * ag_price:,.2f}")

        except Exception:
            pass

    def on_button_pressed(self, event: Button.Pressed):
        """Handle button presses."""
        btn_id = event.button.id
        status = self.query_one("#send-status", Static)

        if btn_id == "btn-connect":
            addr_input = self.query_one("#wallet-input", Input)
            addr = addr_input.value.strip()
            if len(addr) == 42 and addr.startswith("0x"):
                self._wallet_address = addr
                addr_display = self.query_one("#wallet-address", Static)
                addr_display.update(f"[cyan]{addr[:10]}...{addr[-8:]}[/cyan]")
                status.update("[green]Wallet loaded[/green]")
                self.run_worker(self._fetch_balances())
            else:
                status.update("[red]Invalid address format[/red]")

        elif btn_id == "btn-send":
            token = self.query_one("#send-token", Input).value.strip()
            recipient = self.query_one("#send-recipient", Input).value.strip()
            amount = self.query_one("#send-amount", Input).value.strip()

            if not token or not recipient or not amount:
                status.update("[red]Please fill all fields[/red]")
            elif len(recipient) != 42 or not recipient.startswith("0x"):
                status.update("[red]Invalid recipient address[/red]")
            else:
                status.update(
                    f"[yellow]Send {amount} {token} to {recipient[:10]}... - "
                    f"Connect wallet to execute[/yellow]"
                )
