"""Keeper screen - Bot management & monitoring."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable, Button, Switch, Log
from textual.timer import Timer
import asyncio
import time


class KeeperScreen(Screen):
    """Keeper bot management screen."""

    BINDINGS = [
        ("5", "app.switch_mode('keeper')", "Keeper"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._status_timer = None
        self._keeper_running = False
        self._emission_enabled = True
        self._buyback_enabled = True
        self._logs = []

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="keeper-content"):
            # Status Row
            with Horizontal(id="status-row"):
                with Vertical(classes="status-card"):
                    yield Static("[b]Keeper Status[/b]", classes="section-title")
                    yield Static("[red]● Stopped[/red]", id="keeper-status")
                    yield Static("Uptime: [cyan]00:00:00[/cyan]", id="keeper-uptime")
                    yield Static("Last Action: [cyan]...[/cyan]", id="last-action")
                with Vertical(classes="status-card"):
                    yield Static("[b]Emission Keeper[/b]", classes="section-title")
                    yield Static("Status: [cyan]...[/cyan]", id="emission-status")
                    yield Switch(value=True, id="emission-toggle")
                    yield Static("Last Run: [cyan]...[/cyan]", id="emission-last-run")
                with Vertical(classes="status-card"):
                    yield Static("[b]Buyback Keeper[/b]", classes="section-title")
                    yield Static("Status: [cyan]...[/cyan]", id="buyback-status")
                    yield Switch(value=True, id="buyback-toggle")
                    yield Static("Last Run: [cyan]...[/cyan]", id="buyback-last-run")

            # Control Buttons
            with Horizontal(id="control-buttons"):
                yield Button("Start Keeper", id="btn-start", variant="success")
                yield Button("Stop Keeper", id="btn-stop", variant="error")
                yield Button("Trigger Emission", id="btn-trigger-emission", variant="primary")
                yield Button("Trigger Buyback", id="btn-trigger-buyback", variant="primary")
                yield Button("Emergency Pause", id="btn-emergency", variant="error")

            # Action Log
            yield Static("[b]Action Log[/b]", classes="section-title")
            yield Log(id="keeper-log", highlight=True, max_lines=1000)
            yield Static("[b]Keeper Statistics[/b]", classes="section-title")
            yield DataTable(id="stats-table")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._status_timer = self.set_interval(1.0, self._update_status)
        self._setup_table()
        self._append_log("Keeper TUI initialized", "info")
        self._append_log("Waiting for keeper connection...", "info")

    def _setup_table(self):
        """Setup stats table."""
        table = self.query_one("#stats-table", DataTable)
        table.add_columns("Metric", "Value")
        table.add_row("Total Emissions Triggered", "0")
        table.add_row("Total Buybacks Executed", "0")
        table.add_row("ETH Spent on Buybacks", "0 ETH")
        table.add_row("Au Burned via Buybacks", "0 Au")
        table.add_row("Failed Transactions", "0")
        table.add_row("Gas Used (Total)", "0 ETH")
        table.add_row("Last Error", "None")

    def _append_log(self, message: str, level: str = "info"):
        """Append a log entry."""
        timestamp = time.strftime("%H:%M:%S")
        color_map = {
            "info": "cyan",
            "success": "green",
            "warning": "yellow",
            "error": "red",
        }
        color = color_map.get(level, "dim")
        log_widget = self.query_one("#keeper-log", Log)
        log_widget.write_line(f"[{timestamp}] [{color}]{message}[/]")

    def _update_status(self):
        """Update keeper status display."""
        status = self.query_one("#keeper-status", Static)
        if self._keeper_running:
            status.update("[green]● Running[/green]")
        else:
            status.update("[red]● Stopped[/red]")

    def on_button_pressed(self, event: Button.Pressed):
        """Handle button presses."""
        btn_id = event.button.id

        if btn_id == "btn-start":
            self._keeper_running = True
            self._append_log("Keeper started", "success")
            self.query_one("#last-action", Static).update(f"Last Action: [cyan]Started at {time.strftime('%H:%M:%S')}[/cyan]")

        elif btn_id == "btn-stop":
            self._keeper_running = False
            self._append_log("Keeper stopped", "warning")
            self.query_one("#last-action", Static).update(f"Last Action: [cyan]Stopped at {time.strftime('%H:%M:%S')}[/cyan]")

        elif btn_id == "btn-trigger-emission":
            if self._emission_enabled:
                self._append_log("Manual emission triggered", "success")
                self.query_one("#emission-last-run", Static).update(f"Last Run: [cyan]{time.strftime('%H:%M:%S')}[/cyan]")
            else:
                self._append_log("Emission keeper is disabled", "error")

        elif btn_id == "btn-trigger-buyback":
            if self._buyback_enabled:
                self._append_log("Manual buyback triggered", "success")
                self.query_one("#buyback-last-run", Static).update(f"Last Run: [cyan]{time.strftime('%H:%M:%S')}[/cyan]")
            else:
                self._append_log("Buyback keeper is disabled", "error")

        elif btn_id == "btn-emergency":
            self._keeper_running = False
            self._append_log("EMERGENCY PAUSE ACTIVATED", "error")
            self._append_log("All keeper operations halted", "error")

    def on_switch_changed(self, event: Switch.Changed):
        """Handle switch toggles."""
        switch_id = event.switch.id
        value = event.value

        if switch_id == "emission-toggle":
            self._emission_enabled = value
            status = "enabled" if value else "disabled"
            self._append_log(f"Emission keeper {status}", "info")
            self.query_one("#emission-status", Static).update(
                f"Status: [{'green' if value else 'red'}]{'Active' if value else 'Disabled'}[/]"
            )

        elif switch_id == "buyback-toggle":
            self._buyback_enabled = value
            status = "enabled" if value else "disabled"
            self._append_log(f"Buyback keeper {status}", "info")
            self.query_one("#buyback-status", Static).update(
                f"Status: [{'green' if value else 'red'}]{'Active' if value else 'Disabled'}[/]"
            )
