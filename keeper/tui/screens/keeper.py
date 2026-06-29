"""
Keeper Control — Tab 2
Start/stop keepers, view logs, manual triggers, health status.
"""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, Container, ScrollableContainer
from textual.widgets import (
    Static, Header, Footer, Button, DataTable, Input, Label, Log
)
from rich.text import Text

from ..data.keeper import KeeperDataProvider
from ..widgets.status import StatusIndicator


class KeeperScreen(Screen):
    """Keeper control tab."""

    BINDINGS = [
        ("1", "toggle_emission", "Toggle Emission"),
        ("2", "toggle_buyback", "Toggle Buyback"),
        ("3", "toggle_oracle", "Toggle Oracle"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._keeper_data = KeeperDataProvider()

    def compose(self):
        yield Header(show_clock=True)
        with Container(id="keeper-container"):
            with Horizontal(id="keeper-top"):
                # Left: Keeper controls
                with Vertical(id="keeper-controls"):
                    yield Static("═══ KEEPER CONTROL ═══", classes="panel-header")

                    # Emission Keeper
                    with Horizontal(classes="keeper-row"):
                        yield StatusIndicator(label="Emission", id="emission-status")
                        yield Button("Start", id="btn-emission-start", variant="success")
                        yield Button("Stop", id="btn-emission-stop", variant="error")
                        yield Button("Execute", id="btn-emission-exec", variant="primary")

                    # Buyback Keeper
                    with Horizontal(classes="keeper-row"):
                        yield StatusIndicator(label="Buyback", id="buyback-status")
                        yield Button("Start", id="btn-buyback-start", variant="success")
                        yield Button("Stop", id="btn-buyback-stop", variant="error")
                        yield Button("Execute", id="btn-buyback-exec", variant="primary")

                    # Oracle Keeper
                    with Horizontal(classes="keeper-row"):
                        yield StatusIndicator(label="Oracle", id="oracle-status")
                        yield Button("Start", id="btn-oracle-start", variant="success")
                        yield Button("Stop", id="btn-oracle-stop", variant="error")
                        yield Button("Update", id="btn-oracle-exec", variant="primary")

                # Right: Health status
                with Vertical(id="keeper-health"):
                    yield Static("═══ HEALTH STATUS ═══", classes="panel-header")
                    yield Static("—", id="health-emission", classes="health-row")
                    yield Static("—", id="health-buyback", classes="health-row")
                    yield Static("—", id="health-oracle", classes="health-row")

            # Bottom: Logs
            with Vertical(id="keeper-logs-panel"):
                yield Static("═══ KEEPER LOGS ═══", classes="panel-header")
                with Horizontal(classes="log-controls"):
                    yield Button("Clear", id="btn-clear-logs")
                    yield Button("Refresh", id="btn-refresh-logs")
                    yield Label("Filter:")
                    yield Button("All", id="btn-filter-all")
                    yield Button("Emission", id="btn-filter-emission")
                    yield Button("Buyback", id="btn-filter-buyback")
                    yield Button("Oracle", id="btn-filter-oracle")
                yield Log(id="keeper-log", highlight=True, markup=True)

        yield Footer()

    def on_mount(self):
        """Start update timer."""
        self.set_interval(1.0, self._tick)
        self._tick()

    def _tick(self):
        """Update keeper status and health."""
        self._keeper_data.tick()

        keepers = self._keeper_data.get_all_keepers()

        # Update status indicators
        for name, keeper in keepers.items():
            status = self.query_one(f"#{name}-status", StatusIndicator)
            status.status = "ok" if keeper.running else "warning"

        # Update health display
        for name, keeper in keepers.items():
            health = self.query_one(f"#health-{name}", Static)
            status_text = "🟢 RUNNING" if keeper.running else "🔴 STOPPED"
            health.update(
                Text.from_markup(
                    f"[bold]{keeper.name}[/bold]\n"
                    f"  Status: {status_text}\n"
                    f"  Last Run: {keeper.last_run_str}\n"
                    f"  Next: {keeper.next_scheduled_str}\n"
                    f"  Uptime: {keeper.uptime_str}\n"
                    f"  Total Runs: {keeper.total_runs} | Errors: {keeper.errors}\n"
                    f"  Last Error: {keeper.last_error or 'None'}"
                )
            )

        # Update logs
        self._refresh_logs()

    def _refresh_logs(self, filter_name: str = None):
        """Refresh the log display."""
        log_widget = self.query_one("#keeper-log", Log)
        logs = self._keeper_data.get_logs(count=50, keeper_filter=filter_name)
        if logs:
            log_widget.clear()
            for entry in logs:
                style = "green" if entry.status == "success" else "red" if entry.status == "error" else "yellow"
                log_widget.write_line(
                    f"[{entry.time_str}] [{style}]{entry.keeper.upper()}[/{style}] "
                    f"{entry.action}: {entry.details}"
                )

    # Button handlers
    def on_button_pressed(self, event: Button.Pressed):
        btn_id = event.button.id
        if not btn_id:
            return

        if btn_id == "btn-emission-start":
            self._keeper_data.start_keeper("emission")
        elif btn_id == "btn-emission-stop":
            self._keeper_data.stop_keeper("emission")
        elif btn_id == "btn-emission-exec":
            self._keeper_data.trigger_manual("emission", "executeEmission")
        elif btn_id == "btn-buyback-start":
            self._keeper_data.start_keeper("buyback")
        elif btn_id == "btn-buyback-stop":
            self._keeper_data.stop_keeper("buyback")
        elif btn_id == "btn-buyback-exec":
            self._keeper_data.trigger_manual("buyback", "executeBuyback")
        elif btn_id == "btn-oracle-start":
            self._keeper_data.start_keeper("oracle")
        elif btn_id == "btn-oracle-stop":
            self._keeper_data.stop_keeper("oracle")
        elif btn_id == "btn-oracle-exec":
            self._keeper_data.trigger_manual("oracle", "updateOracle")
        elif btn_id == "btn-clear-logs":
            self._keeper_data._logs.clear()
        elif btn_id == "btn-refresh-logs":
            self._refresh_logs()
        elif btn_id == "btn-filter-all":
            self._refresh_logs()
        elif btn_id == "btn-filter-emission":
            self._refresh_logs("emission")
        elif btn_id == "btn-filter-buyback":
            self._refresh_logs("buyback")
        elif btn_id == "btn-filter-oracle":
            self._refresh_logs("oracle")

        self._tick()

    # Keyboard shortcuts
    def action_toggle_emission(self):
        keeper = self._keeper_data.get_keeper_status("emission")
        if keeper and keeper.running:
            self._keeper_data.stop_keeper("emission")
        else:
            self._keeper_data.start_keeper("emission")
        self._tick()

    def action_toggle_buyback(self):
        keeper = self._keeper_data.get_keeper_status("buyback")
        if keeper and keeper.running:
            self._keeper_data.stop_keeper("buyback")
        else:
            self._keeper_data.start_keeper("buyback")
        self._tick()

    def action_toggle_oracle(self):
        keeper = self._keeper_data.get_keeper_status("oracle")
        if keeper and keeper.running:
            self._keeper_data.stop_keeper("oracle")
        else:
            self._keeper_data.start_keeper("oracle")
        self._tick()
