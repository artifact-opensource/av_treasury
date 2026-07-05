#!/usr/bin/env python3
"""
AV Treasury Keeper TUI — Entry Point
Launch the cyberpunk-themed management dashboard.

Usage:
    python run_tui.py
    python -m keeper.run_tui
"""

import sys
import os

# Ensure the project root is on the path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Ensure user-local packages are available
LOCAL_LIB = os.path.expanduser("~/.local/lib/python3.12/site-packages")
if LOCAL_LIB not in sys.path:
    sys.path.insert(0, LOCAL_LIB)


def main():
    """Launch the AV Treasury TUI."""
    try:
        from keeper.tui.app import AVTreasuryApp
    except ImportError as e:
        print(f"Error importing TUI: {e}")
        print("Make sure textual is installed: pip install textual")
        sys.exit(1)

    app = AVTreasuryApp()

    try:
        app.run()
    except KeyboardInterrupt:
        print("\n\n⚡ AV Treasury TUI shutdown complete.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
