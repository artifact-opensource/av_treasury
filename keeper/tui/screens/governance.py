"""
Governance — Tab 4
Active proposals, voting, queue/execute, proposal creation, timelock view.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container, ScrollableContainer
from textual.widgets import (
    Static, Header, Footer, Button, Input, Label, DataTable, TextArea, Select
)
from rich.text import Text


class GovernanceScreen(Screen):
    """Governance tab."""

    BINDINGS = [
        ("v", "vote", "Vote"),
        ("q", "queue", "Queue"),
        ("e", "execute", "Execute"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="gov-container"):
            with Horizontal(id="gov-top"):
                # Left: Active proposals
                with Vertical(id="proposals-panel"):
                    yield Static("═══ ACTIVE PROPOSALS ═══", classes="panel-header")
                    yield DataTable(id="proposals-table")

                # Right: Proposal details & voting
                with Vertical(id="proposal-detail"):
                    yield Static("═══ PROPOSAL DETAIL ═══", classes="panel-header")
                    yield Static("Select a proposal to view details", id="proposal-info")
                    with Horizontal(classes="vote-buttons"):
                        yield Button("FOR", id="btn-vote-for", variant="success")
                        yield Button("AGAINST", id="btn-vote-against", variant="error")
                        yield Button("ABSTAIN", id="btn-vote-abstain", variant="default")
                    with Horizontal(classes="gov-actions"):
                        yield Button("Queue", id="btn-queue", variant="primary")
                        yield Button("Execute", id="btn-execute", variant="warning")

            with Horizontal(id="gov-bottom"):
                # Timelock queue
                with Vertical(id="timelock-panel"):
                    yield Static("═══ TIMELOCK QUEUE ═══", classes="panel-header")
                    yield DataTable(id="timelock-table")

                # Create proposal
                with Vertical(id="create-proposal-panel"):
                    yield Static("═══ CREATE PROPOSAL ═══", classes="panel-header")
                    with Horizontal(classes="form-row"):
                        yield Label("Title:")
                        yield Input(placeholder="Proposal title...", id="input-prop-title")
                    with Horizontal(classes="form-row"):
                        yield Label("Description:")
                    yield TextArea(id="input-prop-description")
                    with Horizontal(classes="form-row"):
                        yield Label("Target:")
                        yield Input(placeholder="0x...", id="input-prop-target")
                    with Horizontal(classes="form-row"):
                        yield Label("Value:")
                        yield Input(placeholder="0.0", id="input-prop-value")
                    with Horizontal(classes="form-row"):
                        yield Button("Submit Proposal", id="btn-submit-proposal", variant="primary")

        yield Footer()

    def on_mount(self):
        """Initialize tables with sample data."""
        # Proposals table
        proposals = self.query_one("#proposals-table", DataTable)
        proposals.add_columns("ID", "Title", "Status", "For", "Against", "Ends")
        proposals.add_row("#42", "Increase PID Kp by 0.1", "Active", "125K", "12K", "2d 4h")
        proposals.add_row("#41", "Add new AMO strategy", "Succeeded", "200K", "5K", "—")
        proposals.add_row("#40", "Adjust reserve ratio to 80%", "Queued", "180K", "8K", "—")
        proposals.add_row("#39", "Treasury diversification", "Executed", "250K", "2K", "—")

        # Timelock table
        timelock = self.query_one("#timelock-table", DataTable)
        timelock.add_columns("ID", "Target", "Action", "ETA", "Status")
        timelock.add_row("#40", "TreasuryAMO", "setReserveRatio(8000)", "12h 30m", "Pending")
        timelock.add_row("#38", "PID", "updateKp(0.5)", "2d 4h", "Ready")

        self.set_interval(5.0, self._tick)

    def _tick(self):
        """Refresh governance data."""
        pass  # Would fetch from Governor contract

    def on_data_table_row_selected(self, event: DataTable.RowSelected):
        """Show proposal details when selected."""
        table = event.data_table
        if table.id == "proposals-table":
            row = table.get_row_at(event.row_key)
            if row:
                info = self.query_one("#proposal-info", Static)
                info.update(
                    Text.from_markup(
                        f"[bold]Proposal {row[0]}[/bold]\n"
                        f"Title: {row[1]}\n"
                        f"Status: {row[2]}\n"
                        f"Votes For: {row[3]}\n"
                        f"Votes Against: {row[4]}\n"
                        f"Voting Ends: {row[5]}\n\n"
                        f"[dim]Description: Adjust protocol parameters for optimal performance.[/dim]"
                    )
                )

    def on_button_pressed(self, event: Button.Pressed):
        btn_id = event.button.id
        if not btn_id:
            return

        if btn_id == "btn-vote-for":
            self.app.notify("Vote cast: FOR", severity="success")
        elif btn_id == "btn-vote-against":
            self.app.notify("Vote cast: AGAINST", severity="warning")
        elif btn_id == "btn-vote-abstain":
            self.app.notify("Vote cast: ABSTAIN", severity="information")
        elif btn_id == "btn-queue":
            self.app.notify("Proposal queued in timelock", severity="information")
        elif btn_id == "btn-execute":
            self.app.notify("Proposal executed!", severity="success")
        elif btn_id == "btn-submit-proposal":
            title = self.query_one("#input-prop-title", Input).value
            if title:
                self.app.notify(f"Proposal submitted: {title}", severity="success")
            else:
                self.app.notify("Please enter a proposal title", severity="warning")

    def action_vote(self):
        self.app.notify("Select a proposal and vote", severity="information")

    def action_queue(self):
        self.app.notify("Queue selected proposal", severity="information")

    def action_execute(self):
        self.app.notify("Execute selected proposal", severity="information")
