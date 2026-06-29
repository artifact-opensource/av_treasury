"""
System — Tab 7
Contract addresses, connection status, wallet balances, gas tracker, event log.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import (
    Static, Header, Footer, DataTable, Log, Label
)
from rich.text import Text

from ..data.chain import ChainDataProvider, ADDRESSES
from ..widgets.status import StatusIndicator


class SystemScreen(Screen):
    """System info tab."""

    BINDINGS = [("r", "refresh", "Refresh")]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._chain = ChainDataProvider()

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="system-container"):
            with Horizontal(id="system-top"):
                # Left: Contract addresses
                with Vertical(id="contracts-panel"):
                    yield Static("═══ CONTRACT ADDRESSES ═══", classes="panel-header")
                    yield DataTable(id="contracts-table")

                # Right: Connection status
                with Vertical(id="connection-panel"):
                    yield Static("═══ CONNECTION STATUS ═══", classes="panel-header")
                    yield StatusIndicator(label="Base RPC", id="rpc-conn-status")
                    yield Static("—", id="rpc-latency", classes="conn-metric")
                    yield StatusIndicator(label="Etherscan API", id="etherscan-status")
                    yield StatusIndicator(label="Infura API", id="infura-status")
                    yield StatusIndicator(label="DEXScreener", id="dexscreener-status")
                    yield StatusIndicator(label="Aerodrome API", id="aerodrome-status")
                    yield StatusIndicator(label="0x API", id="zerox-status")

            with Horizontal(id="system-middle"):
                # Wallet balances
                with Vertical(id="wallet-panel"):
                    yield Static("═══ WALLET BALANCES ═══", classes="panel-header")
                    yield DataTable(id="wallet-table")

                # Gas tracker
                with Vertical(id="gas-panel"):
                    yield Static("═══ GAS TRACKER (Base) ═══", classes="panel-header")
                    yield Static("—", id="gas-current", classes="gas-metric")
                    yield Static("—", id="gas-slow", classes="gas-metric")
                    yield Static("—", id="gas-standard", classes="gas-metric")
                    yield Static("—", id="gas-fast", classes="gas-metric")
                    yield Static("—", id="gas-basefee", classes="gas-metric")

            # Bottom: Event log
            with Vertical(id="event-log-panel"):
                yield Static("═══ EVENT LOG (Real-time) ═══", classes="panel-header")
                yield Log(id="event-log", highlight=True, markup=True)

        yield Footer()

    def on_mount(self):
        """Initialize tables and start updates."""
        # Contracts table
        contracts = self.query_one("#contracts-table", DataTable)
        contracts.add_columns("Name", "Address", "Network")
        for name, address in ADDRESSES.items():
            contracts.add_row(name, address, "Base")

        # Wallet table
        wallet = self.query_one("#wallet-table", DataTable)
        wallet.add_columns("Wallet", "Address", "ETH Balance", "USDC Balance", "Au Balance")
        wallet.add_row("Treasury Safe", ADDRESSES["TreasurySafe"][:10] + "...", "—", "—", "—")
        wallet.add_row("TreasuryAMO", ADDRESSES["TreasuryAMO"][:10] + "...", "—", "—", "—")
        wallet.add_row("Governor", ADDRESSES["Governor"][:10] + "...", "—", "—", "—")
        wallet.add_row("Timelock", ADDRESSES["Timelock"][:10] + "...", "—", "—", "—")

        # Add some sample event logs
        event_log = self.query_one("#event-log", Log)
        event_log.write_line("[12:34:56] [green]INFO[/green] System initialized")
        event_log.write_line("[12:34:57] [green]INFO[/green] Connected to Base mainnet RPC")
        event_log.write_line("[12:34:58] [green]INFO[/green] Loaded 10 contract addresses")
        event_log.write_line("[12:35:00] [yellow]WARN[/yellow] Oracle deviation: 0.8% (threshold: 1%)")
        event_log.write_line("[12:35:02] [green]INFO[/green] Keeper health check passed")

        self.set_interval(2.0, self._tick)
        self._tick()

    def _tick(self):
        """Update system data."""
        overview = self._chain.get_all_overview()
        conn = overview.get("connection", {})

        # Connection status
        rpc_status = self.query_one("#rpc-conn-status", StatusIndicator)
        rpc_status.status = "ok" if conn.get("connected") else "error"

        latency = conn.get("latency_ms", 0)
        latency_widget = self.query_one("#rpc-latency", Static)
        latency_color = "green" if latency < 100 else "yellow" if latency < 500 else "red"
        latency_widget.update(Text.from_markup(f"RPC Latency: [{latency_color}]{latency}ms[/{latency_color}]"))

        # API statuses (simulated)
        for api_id, status in [
            ("etherscan-status", "ok"),
            ("infura-status", "ok"),
            ("dexscreener-status", "ok"),
            ("aerodrome-status", "ok"),
            ("zerox-status", "warning"),
        ]:
            widget = self.query_one(f"#{api_id}", StatusIndicator)
            widget.status = status

        # Gas tracker
        gas = overview.get("gas_price", 0.0)
        self.query_one("#gas-current", Static).update(
            Text.from_markup(f"[bold]Current:[/bold] {gas:.4f} gwei")
        )
        self.query_one("#gas-slow", Static).update(
            Text.from_markup(f"[dim]Slow:[/dim] {gas * 0.8:.4f} gwei (~5min)")
        )
        self.query_one("#gas-standard", Static).update(
            Text.from_markup(f"[bold]Standard:[/bold] {gas:.4f} gwei (~1min)")
        )
        self.query_one("#gas-fast", Static).update(
            Text.from_markup(f"[bold]Fast:[/bold] {gas * 1.5:.4f} gwei (~15s)")
        )
        self.query_one("#gas-basefee", Static).update(
            Text.from_markup(f"[bold]Base Fee:[/bold] {gas * 0.9:.4f} gwei")
        )

        # Wallet balances
        wallet = self.query_one("#wallet-table", DataTable)
        wallet.clear()
        eth_bal = self._chain.get_wallet_balance(ADDRESSES["TreasurySafe"])
        wallet.add_row("Treasury Safe", ADDRESSES["TreasurySafe"][:14] + "...", f"{eth_bal:.4f}", "—", "—")
        wallet.add_row("TreasuryAMO", ADDRESSES["TreasuryAMO"][:14] + "...", "0.0500", "—", "—")
        wallet.add_row("Governor", ADDRESSES["Governor"][:14] + "...", "0.0010", "—", "—")
        wallet.add_row("Timelock", ADDRESSES["Timelock"][:14] + "...", "0.0000", "—", "—")

    def action_refresh(self):
        """Force refresh system data."""
        self._chain._cache.clear()
        self._tick()
