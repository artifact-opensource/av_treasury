"""Circular/semi-circular gauge widget."""

from textual.widgets import Static
from textual.color import Color


class Gauge(Static):
    """ASCII circular gauge for reserve ratio display."""

    def __init__(self, value: float = 0, max_value: float = 100, label: str = "", **kwargs):
        super().__init__(**kwargs)
        self._value = value
        self._max = max_value
        self._label = label
        self._gold = Color.parse("#FFD700")
        self._green = Color.parse("#00FF88")
        self._red = Color.parse("#FF4444")
        self._dim = Color.parse("#444444")

    def update_value(self, value: float):
        """Update gauge value."""
        self._value = min(value, self._max)
        self.refresh()

    def render(self) -> str:
        """Render the gauge as a semi-circle."""
        ratio = self._value / self._max if self._max > 0 else 0
        pct = ratio * 100

        # Choose color based on value
        if ratio >= 1.0:
            color = self._green
        elif ratio >= 0.8:
            color = self._gold
        else:
            color = self._red

        # Semi-circle gauge using block characters
        size = 20
        filled = int(ratio * size)

        # Build the gauge bar
        bar_chars = []
        for i in range(size):
            if i < filled:
                bar_chars.append(f"[{color}]█[/]")
            else:
                bar_chars.append(f"[{self._dim}]░[/]")

        bar = "".join(bar_chars)

        lines = [
            f"  ╭{'─' * (size * 2)}╮",
            f"  │{bar}│",
            f"  ╰{'─' * (size * 2)}╯",
            f"    {pct:6.2f}%",
            f"    {self._label}",
        ]

        return "\n".join(lines)


class ProgressBar(Static):
    """Horizontal progress bar."""

    def __init__(self, value: float = 0, max_value: float = 100,
                 label: str = "", show_pct: bool = True,
                 color: str = "#FFD700", **kwargs):
        super().__init__(**kwargs)
        self._value = value
        self._max = max_value
        self._label = label
        self._show_pct = show_pct
        self._color = Color.parse(color)

    def update_value(self, value: float, max_value: float = None):
        """Update progress bar."""
        self._value = value
        if max_value is not None:
            self._max = max_value
        self.refresh()

    def render(self) -> str:
        """Render progress bar."""
        ratio = self._value / self._max if self._max > 0 else 0
        ratio = max(0, min(ratio, 1))
        width = 30
        filled = int(ratio * width)

        bar = f"[{self._color}]{'█' * filled}[/]" + f"[#444444]{'░' * (width - filled)}[/]"

        pct_str = f" {ratio * 100:.1f}%" if self._show_pct else ""
        label_str = f"{self._label}: " if self._label else ""

        return f"{label_str}{bar}{pct_str}"
