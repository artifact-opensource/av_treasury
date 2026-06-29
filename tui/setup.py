"""Setup script for AV Treasury TUI."""

from setuptools import setup, find_packages

setup(
    name="av-treasury-tui",
    version="1.0.0",
    description="Terminal User Interface for AV Treasury Protocol",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "textual>=0.60.0",
        "web3>=6.0.0",
        "aiohttp>=3.9.0",
        "ccxt>=4.0.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "av-treasury=tui.run:main",
        ],
    },
)
