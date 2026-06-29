"""
NFT/Staking — Tab 5
QuasiCrystal NFT positions, staking info, claim/compound rewards, multiplier.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import (
    Static, Header, Footer, Button, Input, Label, DataTable
)
from rich.text import Text

from ..widgets.gauge import GaugeBar
from ..widgets.status import StatusIndicator


class NFTStakingScreen(Screen):
    """NFT and Staking tab."""

    BINDINGS = [
        ("c", "claim", "Claim"),
        ("x", "compound", "Compound"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="nft-container"):
            with Horizontal(id="nft-top"):
                # Left: NFT positions
                with Vertical(id="nft-positions"):
                    yield Static("═══ QUASICRYSTAL NFTs ═══", classes="panel-header")
                    yield DataTable(id="nft-table")

                # Right: Staking info
                with Vertical(id="staking-info"):
                    yield Static("═══ STAKING OVERVIEW ═══", classes="panel-header")
                    yield Static("—", id="staked-balance", classes="staking-metric")
                    yield Static("—", id="pending-rewards", classes="staking-metric")
                    yield Static("—", id="apr-display", classes="staking-metric")
                    yield Static("—", id="lock-period", classes="staking-metric")
                    yield GaugeBar(label="Multiplier Progress", id="multiplier-gauge", color="#FFD700")
                    yield Static("—", id="multiplier-display", classes="staking-metric")

            with Horizontal(id="nft-bottom"):
                # Rewards section
                with Vertical(id="rewards-panel"):
                    yield Static("═══ REWARDS ═══", classes="panel-header")
                    with Horizontal(classes="reward-row"):
                        yield Label("Pending Au:")
                        yield Static("0.0000", id="pending-au")
                        yield Button("Claim", id="btn-claim-au", variant="success")
                    with Horizontal(classes="reward-row"):
                        yield Label("Pending Ag:")
                        yield Static("0.0000", id="pending-ag")
                        yield Button("Claim", id="btn-claim-ag", variant="success")
                    with Horizontal(classes="reward-row"):
                        yield Label("Pending LP:")
                        yield Static("0.0000", id="pending-lp")
                        yield Button("Compound", id="btn-compound", variant="primary")

                # Multiplier info
                with Vertical(id="multiplier-panel"):
                    yield Static("═══ MULTIPLIER TIERS ═══", classes="panel-header")
                    yield Static("", id="multiplier-tiers")
                    yield StatusIndicator(label="Staking Active", id="staking-status")

        yield Footer()

    def on_mount(self):
        """Initialize tables and data."""
        # NFT table
        nft_table = self.query_one("#nft-table", DataTable)
        nft_table.add_columns("Token ID", "Tier", "LP Amount", "Lock Until", "Multiplier")
        nft_table.add_row("#0001", "Gold", "1,250 USDC", "2026-09-15", "2.5x")
        nft_table.add_row("#0002", "Silver", "500 USDC", "2026-08-01", "1.8x")
        nft_table.add_row("#0003", "Bronze", "100 USDC", "2026-07-15", "1.2x")

        # Multiplier tiers
        tiers = self.query_one("#multiplier-tiers", Static)
        tiers.update(
            Text.from_markup(
                "[bold]Tier Requirements:[/bold]\n"
                "  [bronze]● Bronze[/bronze]  — 100+ USDC locked 30d  → 1.2x\n"
                "  [silver]● Silver[/silver]  — 500+ USDC locked 90d  → 1.8x\n"
                "  [gold]● Gold[/gold]    — 1000+ USDC locked 180d → 2.5x\n"
                "  [bold white]● Platinum[/bold white] — 5000+ USDC locked 365d → 4.0x"
            )
        )

        self.set_interval(2.0, self._tick)
        self._tick()

    def _tick(self):
        """Update staking data."""
        # Update staking metrics
        self.query_one("#staked-balance", Static).update(
            Text.from_markup(f"[bold]Staked:[/bold] 1,850 USDC")
        )
        self.query_one("#pending-rewards", Static).update(
            Text.from_markup(f"[bold]Pending Rewards:[/bold] 12.4500 Au + 85.2300 Ag")
        )
        self.query_one("#apr-display", Static).update(
            Text.from_markup(f"[bold]Current APR:[/bold] 24.5%")
        )
        self.query_one("#lock-period", Static).update(
            Text.from_markup(f"[bold]Avg Lock:[/bold] 142 days")
        )

        # Multiplier gauge
        gauge = self.query_one("#multiplier-gauge", GaugeBar)
        gauge.value = 62.5  # Progress toward next tier

        self.query_one("#multiplier-display", Static).update(
            Text.from_markup(f"[bold]Current Multiplier:[/bold] 1.8x → 2.5x (62.5%)")
        )

        # Pending rewards
        self.query_one("#pending-au", Static).update("12.4500")
        self.query_one("#pending-ag", Static).update("85.2300")
        self.query_one("#pending-lp", Static).update("8.7500")

        # Status
        self.query_one("#staking-status", StatusIndicator).status = "ok"

    def on_button_pressed(self, event: Button.Pressed):
        btn_id = event.button.id
        if not btn_id:
            return

        if btn_id == "btn-claim-au":
            self.app.notify("Claimed 12.4500 Au rewards!", severity="success")
        elif btn_id == "btn-claim-ag":
            self.app.notify("Claimed 85.2300 Ag rewards!", severity="success")
        elif btn_id == "btn-compound":
            self.app.notify("Rewards compounded! Multiplier increased.", severity="success")

    def action_claim(self):
        self.app.notify("Claiming all rewards...", severity="information")

    def action_compound(self):
        self.app.notify("Compounding rewards...", severity="information")
