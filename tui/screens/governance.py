"""Governance screen - Proposals & Voting."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable, Input, Button, TextArea
from textual.timer import Timer
import asyncio
import time

from tui.widgets.gauge import ProgressBar
from tui.data import feeds
from tui.data.config import GOVERNOR, NOT_DEPLOYED


class GovernanceScreen(Screen):
    """Governance proposals & voting screen."""

    BINDINGS = [
        ("4", "app.switch_mode('governance')", "Governance"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._heavy_timer = None

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="gov-content"):
            # Top stats
            with Horizontal(id="gov-stats"):
                with Vertical(classes="stat-card"):
                    yield Static("[b]Active Proposals[/b]", classes="stat-label")
                    yield Static("[cyan]...[/cyan]", id="active-count")
                with Vertical(classes="stat-card"):
                    yield Static("[b]Quorum Required[/b]", classes="stat-label")
                    yield Static("[cyan]...[/cyan]", id="quorum-value")
                with Vertical(classes="stat-card"):
                    yield Static("[b]Total Proposals[/b]", classes="stat-label")
                    yield Static("[cyan]...[/cyan]", id="total-proposals")
                with Vertical(classes="stat-card"):
                    yield Static("[b]Timelock Queue[/b]", classes="stat-label")
                    yield Static("[cyan]...[/cyan]", id="timelock-queue")

            # Proposals Table
            yield Static("[b]Active Proposals[/b]", classes="section-title")
            yield DataTable(id="proposals-table")

            # Vote Progress
            yield Static("[b]Vote Progress[/b]", classes="section-title")
            yield Static("For: [green]...[/green]", id="votes-for")
            yield Static("Against: [red]...[/red]", id="votes-against")
            yield ProgressBar(id="quorum-bar", value=0, max_value=100, label="Quorum Reached", color="#00FF88")

            # Create Proposal
            yield Static("[b]Create Proposal[/b]", classes="section-title")
            with Horizontal(id="proposal-form"):
                with Vertical():
                    yield Static("Title:")
                    yield Input(placeholder="Proposal title...", id="prop-title")
                    yield Static("Description:")
                    yield TextArea(id="prop-description")
                with Vertical():
                    yield Static("Target Address:")
                    yield Input(placeholder="0x...", id="prop-target")
                    yield Static("Calldata:")
                    yield Input(placeholder="0x...", id="prop-calldata")
            with Horizontal(id="proposal-buttons"):
                yield Button("Submit Proposal", id="btn-submit-prop", variant="primary")
            yield Static("", id="proposal-status")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._heavy_timer = self.set_interval(12.0, self._fetch_data)
        self.run_worker(self._fetch_data())
        self._setup_tables()

    def _setup_tables(self):
        """Setup data tables."""
        table = self.query_one("#proposals-table", DataTable)
        table.add_columns("ID", "Proposer", "Description", "For", "Against", "Status", "Ends")

    async def _fetch_data(self):
        """Fetch governance data."""
        try:
            onchain = await feeds.fetch_onchain_data()
            heavy = await feeds.fetch_heavy_data()

            # Total proposals
            prop_count = heavy.get("proposal_count")
            total_display = self.query_one("#total-proposals", Static)
            if prop_count is not None:
                total_display.update(f"[cyan]{prop_count}[/cyan]")
            elif GOVERNOR in NOT_DEPLOYED:
                total_display.update("[dim]Not Deployed[/dim]")
            else:
                total_display.update("[dim]N/A[/dim]")

            # Quorum
            quorum = heavy.get("quorum")
            quorum_display = self.query_one("#quorum-value", Static)
            if quorum is not None:
                quorum_display.update(f"[cyan]{quorum:,}[/cyan]")
            elif GOVERNOR in NOT_DEPLOYED:
                quorum_display.update("[dim]N/A[/dim]")
            else:
                quorum_display.update("[dim]N/A[/dim]")

            # Active proposals
            active_display = self.query_one("#active-count", Static)
            active_display.update("[cyan]0[/cyan]")

            # Timelock queue
            timelock_display = self.query_one("#timelock-queue", Static)
            if GOVERNOR in NOT_DEPLOYED:
                timelock_display.update("[dim]Not Deployed[/dim]")
            else:
                timelock_display.update("[cyan]0[/cyan]")

            # Proposals table
            table = self.query_one("#proposals-table", DataTable)
            table.clear()
            if GOVERNOR in NOT_DEPLOYED:
                table.add_row("-", "-", "Governor not yet deployed", "-", "-", "-", "-")
            else:
                table.add_row("-", "-", "No active proposals", "-", "-", "-", "-")

        except Exception:
            pass

    def on_button_pressed(self, event: Button.Pressed):
        """Handle button presses."""
        btn_id = event.button.id
        status = self.query_one("#proposal-status", Static)

        if btn_id == "btn-submit-prop":
            title = self.query_one("#prop-title", Input).value
            if not title:
                status.update("[red]Please enter a proposal title[/red]")
            else:
                status.update(f"[yellow]Proposal '{title}' - Connect wallet to submit[/yellow]")
