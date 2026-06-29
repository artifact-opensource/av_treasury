"""Price card widget for displaying token prices."""

from textual.widgets import Static
from textual.color import Color
from textual.containers import Vertical


class PriceCard(Static):
    """Card showing a token price with change indicator."""

    def __init__(self, symbol: str = "", price: float = 0.0,
                 change_24h: float = 0.0, volume_24h: float = 0.0,
                 market_cap: float = 0.0, **kwargs):
        super().__init__(**kwargs)
        self._symbol = symbol
        self._price = price
        self._change = change_24h
        self._volume = volume_24h
        self._mcap = market_cap
        self._gold = Color.parse("#FFD700")
        self._green = Color.parse("#00FF88")
        self._red = Color.parse("#FF4444")
        self._dim = Color.parse("#888888")

    def update_data(self, symbol: str = None, price: float = None,
                    change_24h: float = None, volume_24h: float = None,
                    market_cap: float = None):
        """Update price card data."""
        if symbol is not None:
            self._symbol = symbol
        if price is not None:
            self._price = price
        if change_24h is not None:
            self._change = change_24h
        if volume_24h is not None:
            self._volume = volume_24h
        if market_cap is not None:
            self._mcap = market_cap
        self.refresh()

    def render(self) -> str:
        """Render the price card."""
        # Change indicator
        if self._change > 0:
            change_color = self._green
            change_icon = "▲"
        elif self._change < 0:
            change_color = self._red
            change_icon = "▼"
        else:
            change_color = self._dim
            change_icon = "─"

        change_str = f"[{change_color}]{change_icon} {abs(self._change):.2f}%[/]"

        # Format price
        if self._price >= 1:
            price_str = f"${self._price:,.4f}"
        elif self._price >= 0.01:
            price_str = f"${self._price:.6f}"
        else:
            price_str = f"${self._price:.8f}"

        # Format volume
        if self._volume >= 1_000_000:
            vol_str = f"${self._volume / 1_000_000:.2f}M"
        elif self._volume >= 1_000:
            vol_str = f"${self._volume / 1_000:.1f}K"
        else:
            vol_str = f"${self._volume:.2f}"

        # Format market cap
        if self._mcap >= 1_000_000:
            mcap_str = f"${self._mcap / 1_000_000:.2f}M"
        elif self._mcap >= 1_000:
            mcap_str = f"${self._mcap / 1_000:.1f}K"
        else:
            mcap_str = f"${self._mcap:.2f}"

        lines = [
            f"�{'─' * 38}�",
            f"│ [{self._gold}]{self._symbol:^38}[/] │",
            f"│{' ' * 38}│",
            f"│  {price_str:^36}│",
            f"│  {change_str:^44}│",
            f"│{' ' * 38}│",
            f"│  Vol 24h: [{self._dim}]{vol_str:>12}[/]{' ' * 13}│",
            f"│  Mkt Cap: [{self._dim}]{mcap_str:>12}[/]{' ' * 13}│",
            f"└{'─' * 38}�",
        ]

        return "\n".join(lines)
