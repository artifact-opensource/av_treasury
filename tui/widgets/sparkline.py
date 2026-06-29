"""Sparkline widget for price charts."""

from textual.widgets import Static
from textual.color import Color


class Sparkline(Static):
    """ASCII sparkline chart."""

    def __init__(self, data: list = None, width: int = 40, height: int = 8, **kwargs):
        super().__init__(**kwargs)
        self._data = data or []
        self._width = width
        self._height = height
        self._positive_color = Color.parse("#00FF88")
        self._negative_color = Color.parse("#FF4444")
        self._neutral_color = Color.parse("#FFD700")

    def update_data(self, data: list):
        """Update sparkline data."""
        self._data = data
        self.refresh()

    def render(self) -> str:
        """Render the sparkline."""
        if not self._data or len(self._data) < 2:
            return "  ▃�▃▃▃▃▃▃▃▃ (waiting for data...)"

        data = self._data[-self._width:]
        if len(data) < 2:
            data = [data[0], data[0]]

        min_val = min(data)
        max_val = max(data)
        range_val = max_val - min_val

        if range_val == 0:
            range_val = 1

        # Sparkline characters from low to high
        sparks = "▁▂▃▄▅�▇█"

        # Determine if trend is positive
        is_positive = data[-1] >= data[0]
        if is_positive:
            color = self._positive_color
        else:
            color = self._negative_color

        # Build sparkline string
        chars = []
        for val in data:
            idx = int(((val - min_val) / range_val) * (len(sparks) - 1))
            idx = max(0, min(idx, len(sparks) - 1))
            chars.append(sparks[idx])

        spark_str = "".join(chars)

        # Colorize: first half dim, second half bright
        lines = []
        lines.append(f"  [{color}]{spark_str}[/]")

        # Add price range
        lines.append(f"  min: ${min_val:.6f}  max: ${max_val:.6f}  cur: ${data[-1]:.6f}")

        return "\n".join(lines)
