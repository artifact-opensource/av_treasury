"""
Ticker tape widget — scrolling marquee for price alerts and status messages.
"""

import time
from textual.widget import Widget
from textual.strip import Strip
from rich.text import Text


class TickerTape(Widget):
    """A scrolling ticker tape for alerts and status messages."""

    DEFAULT_CSS = """
    TickerTape {
        width: 100%;
        height: 1;
        background: $surface-darken-1;
    }
    """

    def __init__(self, messages: list[str] | None = None, scroll_speed: float = 30.0, **kwargs):
        super().__init__(**kwargs)
        self._messages = messages or []
        self._scroll_speed = scroll_speed
        self._scroll_pos = 0.0
        self._last_update = time.time()

    @property
    def messages(self) -> list[str]:
        return self._messages

    @messages.setter
    def messages(self, value: list[str]):
        self._messages = value
        self._scroll_pos = 0.0
        self.refresh()

    def add_message(self, msg: str):
        """Add a message to the ticker."""
        self._messages.append(msg)
        if len(self._messages) > 20:
            self._messages = self._messages[-20:]

    def on_mount(self):
        """Set up the tick timer."""
        self.set_interval(1.0 / self._scroll_speed, self._scroll)

    def _scroll(self):
        """Advance scroll position."""
        self._scroll_pos += 1
        self.refresh()

    def render(self) -> Text:
        """Render the scrolling ticker."""
        if not self._messages:
            return Text(" " * 80, style="dim")

        # Join messages with separator
        full_text = "  ◆  ".join(self._messages)
        full_text += "  ◆  " + full_text  # Duplicate for seamless loop

        width = self.size.width if self.size.width > 0 else 80
        pos = int(self._scroll_pos) % len(full_text)

        # Extract visible portion
        visible = ""
        remaining = width
        idx = pos
        while remaining > 0:
            char = full_text[idx % len(full_text)]
            visible += char
            idx += 1
            remaining -= 1

        text = Text(visible, style="#FFD700")
        return text

    def render_line(self, y: int) -> Strip:
        if y == 0:
            content = self.render()
            return Strip([content], self.size.width)
        return Strip.blank(self.size.width)
