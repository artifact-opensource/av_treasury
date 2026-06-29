"""
Treasury Management — Tab 3
Deposit/redeem, FlashBuy trigger, reserve ratio, NAV, liquidity positions.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import (
    Static, Header, Footer, Button, Input, Label, DataTable
)
from rich.text import Text

from ..data.chain import ChainDataProvider
from ..widgets.gauge import GaugeBar
from ..widgets.status import StatusIndicator


class TreasuryScreen(Screen):
    """Treasury management tab."""

    BINDINGS = [
        ("d", "deposit", "Deposit"),
        ("r", "redeem", "Redeem"),
        ("f", "flashbuy", "FlashBuy"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._chain = ChainDataProvider()

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="treasury-container"):
            with Horizontal(id="treasury-top"):
                # Left: Actions
                with Vertical(id="treasury-actions"):
                    yield Static("═══ TREASURY AMO ═══", classes="panel-header")

                    with Horizontal(classes="action-row"):
                        yield Label("Amount:")
                        yield Input(placeholder="0.0", id="input-amount")
                        yield Button("Deposit", id="btn-deposit", variant="success")
                        yield Button("Redeem", id="btn-redeem", variant="warning")

                    with Horizontal(classes="action-row"):
                        yield Label("FlashBuy:")
                        yield Input(placeholder="0.0", id="input-flashbuy-amount")
                        yield Button("Trigger FlashBuy", id="btn-flashbuy", variant="error")

                    with Horizontal(classes="action-row"):
                        yield Label("LP Position:")
                        yield Input(placeholder="0.0", id="input-lp-amount")
                        yield Button("Add Liquidity", id="btn-add-lp", variant="primary")
                        yield Button("Remove Liquidity", id="btn-remove-lp", variant="warning")

                # Right: Status
                with Vertical(id="treasury-status"):
                    yield Static("═══ TREASURY METRICS ═══", classes="panel-header")
                    yield Static("—", id="nav-display", classes="metric-display")
                    yield Static("—", id="total-reserve-display", classes="metric-display")
                    yield GaugeBar(label="Reserve Ratio", id="reserve-gauge", color="#00FFFF")
                    yield GaugeBar(label="AMO Utilization", id="amo-gauge", color="#FFD700")
                    yield StatusIndicator(label="Treasury Healthy", id="treasury-health-status")

            # Bottom: Liquidity positions
            with Vertical(id="liquidity-panel"):
                yield Static("═══ LIQUIDITY POSITIONS ═══", classes="panel-header")
                yield DataTable(id="liquidity-table")

        yield Footer()

    def on_mount(self):
        """Initialize and start updates."""
        table = self.query_one("#liquidity-table", DataTable)
        table.add_columns("Pair", "Pool", "Liquidity", "APR", "Our Share", "Value")
        table.add_row("Au/USDC", "Aerodrome", "—", "—", "—", "—")
        table.add_row("Ag/USDC", "Aerodrome", "—", "—", "—", "—")
        table.add_row("Au/Ag", "Aerodrome", "—", "—", "—", "—")

        self.set_interval(2.0, self._tick)
        self._tick()

    def _tick(self):
        """Update treasury data."""
        overview = self._chain.get_all_overview()

        # NAV
        nav = overview.get("nav", 0.0)
        nav_display = self.query_one("#nav-display", Static)
        nav_display.update(Text.from_markup(f"[bold]NAV:[/bold] ${nav:,.2f}"))

        # Total Reserve
        tvl = overview.get("tvl", 0.0)
        reserve_display = self.query_one("#total-reserve-display", Static)
        reserve_display.update(Text.from_markup(f"[bold]Total Reserve:[/bold] ${tvl:,.2f}"))

        # Gauges
        reserve = overview.get("reserve_ratio", 0.0)
        reserve_gauge = self.query_one("#reserve-gauge", GaugeBar)
        reserve_gauge.value = reserve

        amo_gauge = self.query_one("#amo-gauge", GaugeBar)
        # AMO utilization = 100 - reserve ratio (simplified)
        amo_gauge.value = max(0, 100 - reserve)

        # Health status
        health = self.query_one("#treasury-health-status", StatusIndicator)
        if reserve > 50:
            health.status = "ok"
        elif reserve > 25:
            health.status = "warning"
        else:
            health.status = "error"

    def on_button_pressed(self, event: Button.Pressed):
        btn_id = event.button.id
        if not btn_id:
            return

        if btn_id == "btn-deposit":
            amount = self.query_one("#input-amount", Input).value
            self.app.notify(f"Deposit submitted: {amount} (tx pending...)", severity="information")
        elif btn_id == "btn-redeem":
            amount = self.query_one("#input-amount", Input).value
            self.app.notify(f"Redeem submitted: {amount} (tx pending...)", severity="information")
        elif btn_id == "btn-flashbuy":
            amount = self.query_one("#input-flashbuy-amount", Input).value
            self.app.notify(f"FlashBuy triggered: {amount}", severity="warning")
        elif btn_id == "btn-add-lp":
            amount = self.query_one("#input-lp-amount", Input).value
            self.app.notify(f"Add liquidity: {amount} (tx pending...)", severity="information")
        elif btn_id == "btn-remove-lp":
            amount = self.query_one("#input-lp-amount", Input).value
            self.app.notify(f"Remove liquidity: {amount} (tx pending...)", severity="information")

    def action_deposit(self):
        self.app.notify("Deposit action triggered", severity="information")

    def action_redeem(self):
        self.app.notify("Redeem action triggered", severity="information")

    def action_flashbuy(self):
        self.app.notify("FlashBuy action triggered", severity="warning")
