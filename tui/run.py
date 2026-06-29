#!/usr/bin/env python3
"""Entry point for AV Treasury TUI."""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tui.app import AVTreasuryApp


def main():
    """Run the AV Treasury TUI."""
    app = AVTreasuryApp()
    app.run()


if __name__ == "__main__":
    main()
