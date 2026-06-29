"""
AV Treasury Keeper TUI — Main Application
Cyberpunk-themed terminal HUD for the AV Treasury ecosystem.
"""

from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Header, Footer, TabbedContent, TabPane, Static
from textual.binding import Binding
from rich.text import Text

from .screens.overview import OverviewScreen
from .screens.keeper import KeeperScreen
from .screens.treasury import TreasuryScreen
from .screens.governance import GovernanceScreen
from .screens.nft_staking import NFTStakingScreen
from .screens.market import MarketScreen
from .screens.system import SystemScreen
from .widgets.ticker import TickerTape


class AVTreasuryApp(App):
    """Main AV Treasury TUI Application."""

    TITLE = "AV TREASURY — KEEPER HUD"
    SUB_TITLE = "v1.0.0 | Base Mainnet"

    CSS_PATH = "styles.tcss"

    BINDINGS = [
        Binding("q", "quit", "Quit", show=True),
        Binding("d", "toggle_dark", "Dark Mode", show=False),
        Binding("r", "refresh_all", "Refresh All", show=True),
        Binding("1", "switch_tab('overview')", "Overview", show=False),
        Binding("2", "switch_tab('keeper')", "Keeper", show=False),
        Binding("3", "switch_tab('treasury')", "Treasury", show=False),
        Binding("4", "switch_tab('governance')", "Governance", show=False),
        Binding("5", "switch_tab('nft')", "NFT/Staking", show=False),
        Binding("6", "switch_tab('market')", "Market", show=False),
        Binding("7", "switch_tab('system')", "System", show=False),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._ticker_messages = [
            "Au: $1,245.67 ▲2.3%",
            "Ag: $18.42 ▼0.5%",
            "TVL: $2.4M",
            "Reserve Ratio: 78.5%",
            "PID Emission: 0.0042/s",
            "Oracle Deviation: 0.12%",
            "FlashBuy: ACTIVE",
            "Block: #28,451,233",
            "Gas: 0.05 gwei",
        ]

    def compose(self) -> ComposeResult:
        """Compose the main application layout."""
        yield Header(
            Text.from_markup(
                "[bold gold]◆ AV TREASURY ◆[/bold gold]  "
                "[dim]Keeper Management Dashboard[/dim]  "
                "[cyan]Base Mainnet[/cyan]"
            ),
            show_clock=True,
        )

        # Ticker tape at top
        yield TickerTape(
            messages=self._ticker_messages,
            scroll_speed=25.0,
            id="main-ticker",
        )

        # Main tabbed content
        with TabbedContent(id="main-tabs"):
            with TabPane("📊 Overview", id="tab-overview"):
                yield OverviewScreen(id="screen-overview")
            with TabPane("⚙ Keeper", id="tab-keeper"):
                yield KeeperScreen(id="screen-keeper")
            with TabPane("💰 Treasury", id="tab-treasury"):
                yield TreasuryScreen(id="screen-treasury")
            with TabPane("🏛 Governance", id="tab-governance"):
                yield GovernanceScreen(id="screen-governance")
            with TabPane("💎 NFT/Stake", id="tab-nft"):
                yield NFTStakingScreen(id="screen-nft")
            with TabPane("📈 Market", id="tab-market"):
                yield MarketScreen(id="screen-market")
            with TabPane("🔧 System", id="tab-system"):
                yield SystemScreen(id="screen-system")

        yield Footer()

    def on_mount(self):
        """Called when app is mounted."""
        self.dark = True
        # Update ticker periodically
        self.set_interval(5.0, self._update_ticker)

    def _update_ticker(self):
        """Update ticker tape with fresh data."""
        try:
            from .data.chain import ChainDataProvider
            chain = ChainDataProvider()
            overview = chain.get_all_overview()

            self._ticker_messages = [
                f"Au: ${overview.get('au_price', 0):,.4f}",
                f"Ag: ${overview.get('ag_price', 0):,.4f}",
                f"TVL: ${overview.get('tvl', 0):,.0f}",
                f"Reserve: {overview.get('reserve_ratio', 0):.1f}%",
                f"PID: {overview.get('pid_emission', 0):.4f}/s",
                f"Oracle Dev: {overview.get('oracle_deviation', 0):.3f}%",
                f"Block: #{overview.get('block_number', 0):,}",
                f"Gas: {overview.get('gas_price', 0):.4f} gwei",
            ]

            ticker = self.query_one("#main-ticker", TickerTape)
            ticker.messages = self._ticker_messages
        except Exception:
            pass

    def action_switch_tab(self, tab_name: str):
        """Switch to a specific tab."""
        tab_id = f"tab-{tab_name}"
        tabs = self.query_one("#main-tabs", TabbedContent)
        tabs.active = tab_id

    def action_refresh_all(self):
        """Refresh all screens."""
        self.notify("Refreshing all data...", severity="information")
        # Force refresh on all screens
        for screen_name in ["overview", "keeper", "treasury", "governance", "nft", "market", "system"]:
            try:
                screen = self.query_one(f"#screen-{screen_name}")
                if hasattr(screen, "_tick"):
                    screen._tick()
            except Exception:
                pass

    def action_toggle_dark(self):
        """Toggle dark mode (always dark for cyberpunk)."""
        self.notify("Cyberpunk mode: always dark 🖤", severity="information")


if __name__ == "__main__":
    app = AVTreasuryApp()
    app.run()
