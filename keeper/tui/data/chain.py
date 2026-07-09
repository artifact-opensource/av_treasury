"""
Chain data provider — reads on-chain state from Base mainnet.
Fetches prices, TVL, reserve ratio, PID emissions, oracle data, etc.
"""

import os
import json
import time
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv

# Load .env from project root
ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(ENV_PATH)

# Contract addresses
# NOTE: These were previously pointed at a dead "v3" deployment (code=0 on-chain).
# Reconciled 2026-07-08 to the LIVE v2 stack (matches address.book + keeper/config.py).
ADDRESSES = {
    "Au": "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    "Ag":  "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    "TreasuryAMO": "0xF096cD4D24811B0F824c929907196bCB796bca88",
    "PID": "0x43E2ecdA40B3a5F1cEC1BBD5e8147B27a3659dfD",
    "Governor": "0x5F061c177b76753686122185989C2332C1d0e8b1",
    "Timelock": "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be",
    "QuasiCrystal": "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD",
    "Oracle": "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB",
    "FlashBuy": "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b",
    "TreasurySafe": "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e",
}

RPC_URL = os.getenv("RPC_URL_BASE", "")

# Minimal ABI fragments for our contracts
TREASURY_AMO_ABI = [
    {"inputs": [], "name": "reserveRatio", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getTVL", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "nav", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "totalReserve", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

PID_ABI = [
    {"inputs": [], "name": "getCurrentEmissionRate", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "dailyEmissionCap", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "lastEmissionTime", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

ORACLE_ABI = [
    {"inputs": [], "name": "getAuPrice", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getAgPrice", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "deviation", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "lastUpdate", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

FLASHBUY_ABI = [
    {"inputs": [], "name": "isActive", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "triggerCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]


class ChainDataProvider:
    """Provides on-chain data for the TUI dashboard."""

    def __init__(self):
        self.rpc_url = RPC_URL
        self._w3 = None
        self._cache: dict[str, Any] = {}
        self._cache_time: dict[str, float] = {}
        self._cache_ttl = 5.0  # seconds

    @property
    def w3(self):
        if self._w3 is None and self.rpc_url:
            try:
                from web3 import Web3
                self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            except Exception:
                self._w3 = None
        return self._w3

    def _cached(self, key: str, fetch_fn) -> Any:
        now = time.time()
        if key in self._cache and (now - self._cache_time.get(key, 0)) < self._cache_ttl:
            return self._cache[key]
        try:
            val = fetch_fn()
            self._cache[key] = val
            self._cache_time[key] = now
            return val
        except Exception:
            return self._cache.get(key, "N/A")

    def _call(self, address: str, abi: list, function_name: str, *args) -> Any:
        """Make an eth_call to the contract."""
        if not self.w3:
            return None
        try:
            contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(address),
                abi=abi,
            )
            fn = getattr(contract.functions, function_name)
            result = fn(*args).call()
            return result
        except Exception as e:
            return f"Error: {str(e)[:40]}"

    def get_block_number(self) -> int:
        """Get current block number."""
        def fetch():
            return self.w3.eth.block_number if self.w3 else 0
        return self._cached("block_number", fetch) or 0

    def get_gas_price(self) -> float:
        """Get current gas price in gwei."""
        def fetch():
            if not self.w3:
                return 0.0
            return float(self.w3.from_wei(self.w3.eth.gas_price, "gwei"))
        return self._cached("gas_price", fetch) or 0.0

    def get_au_price(self) -> float:
        """Get Au token price from oracle."""
        def fetch():
            result = self._call(ADDRESSES["Oracle"], ORACLE_ABI, "getAuPrice")
            if isinstance(result, int):
                return result / 1e18
            return 0.0
        return self._cached("au_price", fetch) or 0.0

    def get_ag_price(self) -> float:
        """Get Ag token price from oracle."""
        def fetch():
            result = self._call(ADDRESSES["Oracle"], ORACLE_ABI, "getAgPrice")
            if isinstance(result, int):
                return result / 1e18
            return 0.0
        return self._cached("ag_price", fetch) or 0.0

    def get_tvl(self) -> float:
        """Get total TVL from TreasuryAMO."""
        def fetch():
            result = self._call(ADDRESSES["TreasuryAMO"], TREASURY_AMO_ABI, "getTVL")
            if isinstance(result, int):
                return result / 1e18
            return 0.0
        return self._cached("tvl", fetch) or 0.0

    def get_reserve_ratio(self) -> float:
        """Get reserve ratio (as percentage)."""
        def fetch():
            result = self._call(ADDRESSES["TreasuryAMO"], TREASURY_AMO_ABI, "reserveRatio")
            if isinstance(result, int):
                return result / 1e4  # basis points to percentage
            return 0.0
        return self._cached("reserve_ratio", fetch) or 0.0

    def get_pid_emission_rate(self) -> float:
        """Get current PID emission rate."""
        def fetch():
            result = self._call(ADDRESSES["PID"], PID_ABI, "getCurrentEmissionRate")
            if isinstance(result, int):
                return result / 1e18
            return 0.0
        return self._cached("pid_emission", fetch) or 0.0

    def get_oracle_deviation(self) -> float:
        """Get oracle price deviation."""
        def fetch():
            result = self._call(ADDRESSES["Oracle"], ORACLE_ABI, "deviation")
            if isinstance(result, int):
                return result / 1e4
            return 0.0
        return self._cached("oracle_deviation", fetch) or 0.0

    def get_flashbuy_status(self) -> dict:
        """Get FlashBuy contract status."""
        def fetch():
            active = self._call(ADDRESSES["FlashBuy"], FLASHBUY_ABI, "isActive")
            count = self._call(ADDRESSES["FlashBuy"], FLASHBUY_ABI, "triggerCount")
            return {
                "active": active if isinstance(active, bool) else False,
                "trigger_count": count if isinstance(count, int) else 0,
            }
        return self._cached("flashbuy", fetch) or {"active": False, "trigger_count": 0}

    def get_nav(self) -> float:
        """Get NAV from TreasuryAMO."""
        def fetch():
            result = self._call(ADDRESSES["TreasuryAMO"], TREASURY_AMO_ABI, "nav")
            if isinstance(result, int):
                return result / 1e18
            return 0.0
        return self._cached("nav", fetch) or 0.0

    def get_connection_status(self) -> dict:
        """Check RPC connection status."""
        def fetch():
            if not self.w3:
                return {"connected": False, "latency_ms": 0}
            try:
                start = time.time()
                _ = self.w3.eth.block_number
                latency = (time.time() - start) * 1000
                return {"connected": True, "latency_ms": round(latency, 1)}
            except Exception:
                return {"connected": False, "latency_ms": 0}
        return self._cached("conn_status", fetch) or {"connected": False, "latency_ms": 0}

    def get_wallet_balance(self, address: str) -> float:
        """Get ETH balance for an address."""
        def fetch():
            if not self.w3:
                return 0.0
            bal = self.w3.eth.get_balance(self.w3.to_checksum_address(address))
            return float(self.w3.from_wei(bal, "ether"))
        return self._cached(f"wallet_{address}", fetch) or 0.0

    def get_all_overview(self) -> dict:
        """Get all overview data in one call."""
        return {
            "block_number": self.get_block_number(),
            "gas_price": self.get_gas_price(),
            "au_price": self.get_au_price(),
            "ag_price": self.get_ag_price(),
            "tvl": self.get_tvl(),
            "reserve_ratio": self.get_reserve_ratio(),
            "pid_emission": self.get_pid_emission_rate(),
            "oracle_deviation": self.get_oracle_deviation(),
            "flashbuy": self.get_flashbuy_status(),
            "nav": self.get_nav(),
            "connection": self.get_connection_status(),
        }
