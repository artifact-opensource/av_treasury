"""Main Textual app for AV Treasury TUI."""

from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Static, Header, Footer
from textual.color import Color
from textual.binding import Binding
from textual.timer import Timer
import asyncio
import time

from tui.screens.dashboard import DashboardScreen
from tui.screens.tokens import TokensScreen
from tui.screens.treasury import TreasuryScreen
from tui.screens.governance import GovernanceScreen
from tui.screens.keeper import KeeperScreen
from tui.screens.oracle import OracleScreen
from tui.screens.nft import NFTScreen
from tui.screens.wallet import WalletScreen
from tui.widgets.status_bar import StatusBar
from tui.data import feeds
from tui.data.config import COLORS, SHORTCUTS


# ─── CSS Theme ───────────────────────────────────────────────────────────────
CSS = """
Screen {
    background: #0D0D0D;
    color: #E0E0E0;
}

Header {
    background: #3A1078;
    color: #FFD700;
    text-style: bold;
    height: 3;
}

.header {
    background: #3A1078;
    color: #FFD700;
}

Footer {
    background: #1A0840;
    color: #FFD700;
    height: 1;
}

#status-bar {
    background: #1A1A2E;
    color: #FFD700;
    height: 1;
    dock: bottom;
    padding: 0 1;
}

ScrollableContainer {
    height: 1fr;
}

.section-title {
    color: #FFD700;
    text-style: bold;
    padding: 1 0 0 0;
}

.token-card {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
    height: auto;
}

.token-title {
    color: #FFD700;
    text-style: bold;
    text-align: center;
}

.oracle-col {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
}

.oracle-title {
    color: #FFD700;
    text-style: bold;
}

.status-card {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
}

.balance-card {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
    text-align: center;
}

.token-label {
    color: #FFD700;
    text-style: bold;
}

.stat-card {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
    text-align: center;
}

.stat-label {
    color: #FFD700;
}

.reward-card {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
    text-align: center;
}

#network-info {
    border: solid #3A1078;
    padding: 1 2;
    margin: 0 1;
    width: 1fr;
}

#network-title {
    color: #FFD700;
    text-style: bold;
}

DataTable {
    height: auto;
    max-height: 20;
    margin: 1 0;
}

DataTable > .datatable--header {
    background: #3A1078;
    color: #FFD700;
    text-style: bold;
}

DataTable > .datatable--cursor {
    background: #252540;
}

Input {
    border: solid #3A1078;
    background: #1A1A2E;
    margin: 0 0 1 0;
}

Input:focus {
    border: solid #FFD700;
}

Button {
    margin: 0 1;
    min-width: 16;
}

Button.-primary {
    background: #3A1078;
    color: #FFD700;
    border: solid #FFD700;
}

Button.-success {
    background: #004400;
    color: #00FF88;
    border: solid #00FF88;
}

Button.-warning {
    background: #442200;
    color: #FF8800;
    border: solid #FF8800;
}

Button.-error {
    background: #440000;
    color: #FF4444;
    border: solid #FF4444;
}

TextArea {
    border: solid #3A1078;
    background: #1A1A2E;
    height: 5;
}

TextArea:focus {
    border: solid #FFD700;
}

Switch {
    background: #1A1A2E;
}

Log {
    background: #0D0D0D;
    border: solid #3A1078;
    height: 15;
    overflow-y: auto;
}

#reserve-gauge {
    width: 100%;
}

Sparkline {
    width: 100%;
    height: auto;
}

ProgressBar {
    width: 100%;
    padding: 0 1;
}

.spacer {
    height: 1;
}
"""


class AVTreasuryApp(App):
    """Main AV Treasury TUI application."""

    CSS = CSS
    TITLE = "AV Treasury - Protocol Control Center"
    SUB_TITLE = "Base Mainnet"

    MODES = {
        "dashboard": DashboardScreen,
        "tokens": TokensScreen,
        "treasury": TreasuryScreen,
        "governance": GovernanceScreen,
        "keeper": KeeperScreen,
        "oracle": OracleScreen,
        "nft": NFTScreen,
        "wallet": WalletScreen,
    }

    BINDINGS = [
        Binding("1", "switch_mode('dashboard')", "Dashboard", show=True),
        Binding("2", "switch_mode('tokens')", "Tokens", show=True),
        Binding("3", "switch_mode('treasury')", "Treasury", show=True),
        Binding("4", "switch_mode('governance')", "Gov", show=True),
        Binding("5", "switch_mode('keeper')", "Keeper", show=True),
        Binding("6", "switch_mode('oracle')", "Oracle", show=True),
        Binding("7", "switch_mode('nft')", "NFT", show=True),
        Binding("8", "switch_mode('wallet')", "Wallet", show=True),
        Binding("q", "quit", "Quit", show=True),
        Binding("d", "toggle_dark", "Dark/Light", show=False),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._status_timer = None
        self._start_time = time.time()

    def compose(self) -> ComposeResult:
        """Compose the app layout."""
        yield Header(id="app-header")
        yield StatusBar(id="status-bar")
        yield Footer()

    def on_mount(self):
        """Initialize on mount."""
        # Install all screens
        for name, screen_cls in self.MODES.items():
            self.install_screen(screen_cls, name=name)

        # Switch to dashboard
        self.switch_mode("dashboard")

        # Start status bar update timer
        self._status_timer = self.set_interval(1.0, self._update_status)
        self.run_worker(self._fetch_initial_data())

    async def _fetch_initial_data(self):
        """Fetch initial data on startup."""
        try:
            block = await feeds.fetch_block_height()
            gas = await feeds.fetch_gas_price()

            try:
                status_bar = self.query_one("#status-bar", StatusBar)
                status_bar.update_block(block)
                status_bar.update_gas(gas)
            except Exception:
                pass
        except Exception:
            pass

    async def _update_status(self):
        """Update status bar every second."""
        try:
            block = await feeds.fetch_block_height()
            gas = await feeds.fetch_gas_price()

            status_bar = self.query_one("#status-bar", StatusBar)
            status_bar.update_block(block)
            status_bar.update_gas(gas)

            # Update keeper status (placeholder)
            if hasattr(self, '_keeper_status'):
                status_bar.update_keeper(self._keeper_status)

        except Exception:
            pass
