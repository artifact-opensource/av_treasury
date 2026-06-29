"""
Sparkline widget — renders mini price charts using Unicode block characters.
"""

from textual.widget import Widget
from textual.strip import Strip
from rich.text import Text


class Sparkline(Widget):
    """A sparkline chart widget for price history."""

    DEFAULT_CSS = """
    Sparkline {
        width: 100%;
        height: 4;
        background: $surface;
    }
    """

    def __init__(
        self,
        data: list[float] | None = None,
        color: str = "#FFD700",
        label: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._data: list[float] = data or []
        self._color = color
        self._label = label

    @property
    def data(self) -> list[float]:
        return self._data

    @data.setter
    def data(self, value: list[float]):
        self._data = value
        self.refresh()

    def render(self):
        """Render the sparkline as a Rich Text object."""
        if not self._data or len(self._data) < 2:
            return Text("─" * 40, style="dim")

        # Sparkline characters from low to high
        blocks = " ▁▂▃▄▅▆▇█"

        min_val = min(self._data)
        max_val = max(self._data)
        range_val = max_val - min_val

        if range_val == 0:
            range_val = 1

        # Normalize data to block characters
        chars = []
        for val in self._data:
            normalized = (val - min_val) / range_val
            idx = int(normalized * (len(blocks) - 1))
            chars.append(blocks[idx])

        # Take last N characters to fit width
        width = self.size.width if self.size.width > 0 else 40
        display_chars = chars[-width:] if len(chars) > width else chars

        sparkline = "".join(display_chars)

        # Build the display
        text = Text()
        if self._label:
            text.append(f"{self._label} ", style="bold")

        text.append(sparkline, style=self._color)

        # Add current price
        if self._data:
            current = self._data[-1]
            prev = self._data[-2] if len(self._data) > 1 else current
            change = ((current - prev) / prev * 100) if prev != 0 else 0
            arrow = "▲" if change >= 0 else "▼"
            change_color = "green" if change >= 0 else "red"
            text.append(f"  {arrow} ${current:,.4f} ({change:+.2f}%)", style=change_color)

        return text

    def render_line(self, y: int) -> Strip:
        """Render a single line."""
        content = self.render()
        if y == 0:
            return Strip([content], self.size.width)
        return Strip.blank(self.size.width)
