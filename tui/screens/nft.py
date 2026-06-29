"""NFT screen - QuasiCrystal LP positions."""

from textual.screen import Screen
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.widgets import Static, Header, Footer, DataTable, Input, Button
from textual.timer import Timer
import asyncio
import time

from tui.data import feeds
from tui.data.config import QUASICYSTAL_LP_NFT


class NFTScreen(Screen):
    """QuasiCrystal LP NFT positions screen."""

    BINDINGS = [
        ("7", "app.switch_mode('nft')", "NFT"),
        ("q", "app.quit", "Quit"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._onchain_timer = None
        self._owner_address = ""

    def compose(self):
        yield Header(show_clock=True, classes="header")
        with ScrollableContainer(id="nft-content"):
            # Header info
            with Horizontal(id="nft-header"):
                with Vertical():
                    yield Static("[b]QuasiCrystal LP NFT[/b]", classes="section-title")
                    yield Static(f"[dim]{QUASICYSTAL_LP_NFT[:10]}...{QUASICYSTAL_LP_NFT[-8:]}[/]", id="nft-address")
                with Vertical():
                    yield Static("[b]Owner Address[/b]", classes="section-title")
                    yield Input(placeholder="0x... (enter wallet to query)", id="owner-input")
                    yield Button("Load Positions", id="btn-load", variant="primary")

            # Positions Table
            yield Static("[b]Active Positions[/b]", classes="section-title")
            yield DataTable(id="positions-table")

            # Rewards Summary
            with Horizontal(id="rewards-row"):
                with Vertical(classes="reward-card"):
                    yield Static("[b]Pending Rewards[/b]", classes="section-title")
                    yield Static("[cyan]0.00 Au[/cyan]", id="pending-rewards")
                with Vertical(classes="reward-card"):
                    yield Static("[b]Total Locked LP[/b]", classes="section-title")
                    yield Static("[cyan]0.00 LP[/cyan]", id="total-locked")
                with Vertical(classes="reward-card"):
                    yield Static("[b]Active Positions[/b]", classes="section-title")
                    yield Static("[cyan]0[/cyan]", id="active-count")

            # Stake/Unstake
            with Horizontal(id="stake-controls"):
                with Vertical():
                    yield Static("[b]Stake LP[/b]", classes="section-title")
                    yield Input(placeholder="Token ID", id="stake-token-id")
                    yield Input(placeholder="LP Amount", id="stake-amount")
                    yield Input(placeholder="Lock Duration (days)", id="stake-duration")
                    yield Button("Stake", id="btn-stake", variant="success")
                with Vertical():
                    yield Static("[b]Unstake[/b]", classes="section-title")
                    yield Input(placeholder="Token ID", id="unstake-token-id")
                    yield Button("Unstake", id="btn-unstake", variant="warning")
                with Vertical():
                    yield Static("[b]Claim Rewards[/b]", classes="section-title")
                    yield Input(placeholder="Token ID (empty for all)", id="claim-token-id")
                    yield Button("Claim", id="btn-claim", variant="primary")

            yield Static("", id="nft-status")

        yield Footer()

    def on_mount(self):
        """Start timers."""
        self._onchain_timer = self.set_interval(3.0, self._fetch_data)
        self.run_worker(self._fetch_data())
        self._setup_table()

    def _setup_table(self):
        """Setup positions table."""
        table = self.query_one("#positions-table", DataTable)
        table.add_columns("Token ID", "LP Amount", "Lock End", "Multiplier", "Pending Rewards", "Status")

    async def _fetch_data(self):
        """Fetch NFT data."""
        try:
            if not self._owner_address:
                table = self.query_one("#positions-table", DataTable)
                table.clear()
                table.add_row("-", "-", "-", "-", "-", "Enter wallet address above")
                return

            positions = await feeds.fetch_nft_positions(self._owner_address)

            table = self.query_one("#positions-table", DataTable)
            table.clear()

            total_lp = 0
            total_rewards = 0

            for pos in positions:
                token_id = pos["token_id"]
                lp_amount = pos["lp_amount"] / 1e18
                lock_end = pos["lock_end"]
                multiplier = pos["multiplier"]
                pending = pos["pending_rewards"] / 1e18

                total_lp += lp_amount
                total_rewards += pending

                # Lock status
                now = int(time.time())
                if lock_end > now:
                    remaining = lock_end - now
                    days = remaining // 86400
                    hours = (remaining % 86400) // 3600
                    lock_str = f"{days}d {hours}h"
                    status = "[yellow]Locked[/yellow]"
                else:
                    lock_str = "Expired"
                    status = "[green]Unlocked[/green]"

                mult_str = f"{multiplier / 100:.1f}x" if multiplier else "1.0x"

                table.add_row(
                    str(token_id),
                    f"{lp_amount:,.2f}",
                    lock_str,
                    mult_str,
                    f"{pending:,.4f} Au",
                    status,
                )

            if not positions:
                table.add_row("-", "-", "-", "-", "-", "No positions found")

            # Update summary
            self.query_one("#pending-rewards", Static).update(f"[cyan]{total_rewards:,.4f} Au[/cyan]")
            self.query_one("#total-locked", Static).update(f"[cyan]{total_lp:,.2f} LP[/cyan]")
            self.query_one("#active-count", Static).update(f"[cyan]{len(positions)}[/cyan]")

        except Exception:
            pass

    def on_button_pressed(self, event: Button.Pressed):
        """Handle button presses."""
        btn_id = event.button.id
        status = self.query_one("#nft-status", Static)

        if btn_id == "btn-load":
            owner_input = self.query_one("#owner-input", Input)
            addr = owner_input.value.strip()
            if addr and len(addr) == 42 and addr.startswith("0x"):
                self._owner_address = addr
                status.update(f"[green]Loading positions for {addr[:10]}...[/green]")
                self.run_worker(self._fetch_data())
            else:
                status.update("[red]Invalid address format[/red]")

        elif btn_id == "btn-stake":
            token_id = self.query_one("#stake-token-id", Input).value
            amount = self.query_one("#stake-amount", Input).value
            duration = self.query_one("#stake-duration", Input).value
            if token_id and amount and duration:
                status.update(f"[yellow]Stake {amount} LP for {duration} days - Connect wallet[/yellow]")
            else:
                status.update("[red]Please fill all fields[/red]")

        elif btn_id == "btn-unstake":
            token_id = self.query_one("#unstake-token-id", Input).value
            if token_id:
                status.update(f"[yellow]Unstake token #{token_id} - Connect wallet[/yellow]")
            else:
                status.update("[red]Please enter token ID[/red]")

        elif btn_id == "btn-claim":
            token_id = self.query_one("#claim-token-id", Input).value
            if token_id:
                status.update(f"[yellow]Claim rewards for token #{token_id} - Connect wallet[/yellow]")
            else:
                status.update("[yellow]Claim all rewards - Connect wallet[/yellow]")
