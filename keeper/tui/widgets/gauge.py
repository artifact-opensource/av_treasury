"""
Gauge widget — renders a progress bar / gauge for ratios and percentages.
"""

from textual.widget import Widget
from textual.strip import Strip
from rich.text import Text


class GaugeBar(Widget):
    """A horizontal gauge/progress bar widget."""

    DEFAULT_CSS = """
    GaugeBar {
        width: 100%;
        height: 1;
        background: $surface;
    }
    """

    def __init__(
        self,
        value: float = 0.0,
        maximum: float = 100.0,
        label: str = "",
        color: str = "#00FFFF",
        warning_threshold: float = 30.0,
        danger_threshold: float = 15.0,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._value = value
        self._maximum = maximum
        self._label = label
        self._color = color
        self._warning_threshold = warning_threshold
        self._danger_threshold = danger_threshold

    @property
    def value(self) -> float:
        return self._value

    @value.setter
    def value(self, val: float):
        self._value = max(0, min(val, self._maximum))
        self.refresh()

    def render(self) -> Text:
        """Render the gauge as Rich Text."""
        text = Text()

        if self._label:
            text.append(f"{self._label:<20}", style="bold")

        # Calculate fill
        pct = (self._value / self._maximum * 100) if self._maximum > 0 else 0
        bar_width = max(10, self.size.width - 30) if self.size.width > 30 else 20
        filled = int(bar_width * pct / 100)
        empty = bar_width - filled

        # Determine color based on thresholds
        if pct <= self._danger_threshold:
            bar_color = "red"
        elif pct <= self._warning_threshold:
            bar_color = "yellow"
        else:
            bar_color = self._color

        # Build bar
        bar = "█" * filled + "░" * empty
        text.append(f"│", style="dim")
        text.append(bar, style=bar_color)
        text.append(f"│", style="dim")
        text.append(f" {pct:5.1f}%", style="bold")

        return text

    def render_line(self, y: int) -> Strip:
        if y == 0:
            content = self.render()
            return Strip([content], self.size.width)
        return Strip.blank(self.size.width)
