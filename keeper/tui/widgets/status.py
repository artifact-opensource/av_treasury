"""
Status indicator widget — blinking dot with label for health/alert states.
"""

import time
from textual.widget import Widget
from textual.strip import Strip
from rich.text import Text


class StatusIndicator(Widget):
    """A blinking status indicator with label."""

    DEFAULT_CSS = """
    StatusIndicator {
        width: auto;
        height: 1;
        background: $surface;
    }
    """

    def __init__(
        self,
        label: str = "",
        status: str = "ok",  # ok, warning, error, unknown
        blink: bool = False,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._label = label
        self._status = status
        self._blink = blink
        self._last_toggle = time.time()
        self._visible = True

    @property
    def status(self) -> str:
        return self._status

    @status.setter
    def status(self, value: str):
        self._status = value
        self._blink = value in ("error", "warning")
        self.refresh()

    def on_mount(self):
        """Set up blink timer."""
        if self._blink:
            self.set_interval(0.5, self._toggle_blink)

    def _toggle_blink(self):
        """Toggle visibility for blinking effect."""
        self._visible = not self._visible
        self.refresh()

    def render(self) -> Text:
        """Render the status indicator."""
        text = Text()

        # Status dot
        if self._status == "ok":
            dot = "●" if not self._blink or self._visible else "○"
            color = "green"
        elif self._status == "warning":
            dot = "●" if self._visible else "○"
            color = "yellow"
        elif self._status == "error":
            dot = "●" if self._visible else "○"
            color = "red"
        else:
            dot = "○"
            color = "dim"

        text.append(dot, style=color)
        if self._label:
            text.append(f" {self._label}", style="bold")

        return text

    def render_line(self, y: int) -> Strip:
        if y == 0:
            content = self.render()
            return Strip([content], self.size.width)
        return Strip.blank(self.size.width)
