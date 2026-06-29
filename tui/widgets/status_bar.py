"""Status bar widget showing block height, gas, keeper status."""

from textual.widgets import Static
from textual.color import Color
from textual.reactive import reactive
import time


class StatusBar(Static):
    """Bottom status bar with live network info."""

    block_height = reactive(0)
    gas_price = reactive(0.0)
    keeper_status = reactive("stopped")
    start_time = reactive(0)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._gold = Color.parse("#FFD700")
        self._green = Color.parse("#00FF88")
        self._red = Color.parse("#FF4444")
        self._dim = Color.parse("#888888")
        self._cyan = Color.parse("#00CCCC")
        self._orange = Color.parse("#FF8800")
        self._start_time = time.time()

    def update_block(self, height: int):
        """Update block height."""
        self.block_height = height

    def update_gas(self, gas: float):
        """Update gas price."""
        self.gas_price = gas

    def update_keeper(self, status: str):
        """Update keeper status."""
        self.keeper_status = status

    def render(self) -> str:
        """Render status bar."""
        # Keeper status color
        if self.keeper_status == "running":
            keeper_color = self._green
            keeper_icon = "●"
        elif self.keeper_status == "error":
            keeper_color = self._red
            keeper_icon = "●"
        else:
            keeper_color = self._orange
            keeper_icon = "○"

        # Uptime
        uptime = time.time() - self._start_time
        hours = int(uptime // 3600)
        minutes = int((uptime % 3600) // 60)
        secs = int(uptime % 60)
        uptime_str = f"{hours:02d}:{minutes:02d}:{secs:02d}"

        # Gas color
        if self.gas_price < 0.1:
            gas_color = self._green
        elif self.gas_price < 1.0:
            gas_color = self._gold
        else:
            gas_color = self._red

        parts = [
            f" [#3A1078]�[/] AV TREASURY",
            f" Block: [{self._cyan}]{self.block_height:,}[/]",
            f" Gas: [{gas_color}]{self.gas_price:.4f} gwei[/]",
            f" Keeper: [{keeper_color}]{keeper_icon} {self.keeper_status}[/]",
            f" Uptime: [{self._dim}]{uptime_str}[/]",
            f" [Press 1-8 for screens, q to quit]",
        ]

        return " │ ".join(parts)
