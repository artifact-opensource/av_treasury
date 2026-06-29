"""
Market data provider — fetches prices from DEXScreener, Aerodrome, ccxt exchanges.
"""

import time
import requests
from typing import Any, Optional


class MarketDataProvider:
    """Provides market data from various sources."""

    def __init__(self):
        self._cache: dict[str, Any] = {}
        self._cache_time: dict[str, float] = {}
        self._cache_ttl = 10.0
        self._price_history: dict[str, list[float]] = {
            "Au": [],
            "Ag": [],
            "ETH": [],
        }
        self._max_history = 60

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
            return self._cache.get(key)

    def get_dexscreener_price(self, token_address: str) -> Optional[dict]:
        """Fetch price from DEXScreener API."""
        def fetch():
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
            resp = requests.get(url, timeout=8)
            data = resp.json()
            if data.get("pairs"):
                pair = data["pairs"][0]
                return {
                    "price_usd": float(pair.get("priceUsd", 0)),
                    "price_native": float(pair.get("priceNative", 0)),
                    "volume_24h": float(pair.get("volume", {}).get("h24", 0)),
                    "liquidity": float(pair.get("liquidity", {}).get("usd", 0)),
                    "dex": pair.get("dexId", "unknown"),
                    "pair": pair.get("pairAddress", ""),
                    "change_24h": float(pair.get("priceChange", {}).get("h24", 0)),
                }
            return None
        return self._cached(f"dex_{token_address}", fetch)

    def get_aerodrome_lp(self, token_address: str) -> Optional[dict]:
        """Fetch Aerodrome LP data."""
        def fetch():
            url = "https://api.aerodrome.finance/api/v1/pairs"
            try:
                resp = requests.get(url, timeout=8)
                data = resp.json()
                pairs = data.get("data", data) if isinstance(data, dict) else data
                if isinstance(pairs, list):
                    for pair in pairs:
                        token0 = pair.get("token0", {}).get("address", "")
                        token1 = pair.get("token1", {}).get("address", "")
                        if token_address.lower() in [token0.lower(), token1.lower()]:
                            return {
                                "pair": pair.get("symbol", "Unknown"),
                                "reserve_usd": float(pair.get("reserveUSD", pair.get("tvl", 0))),
                                "volume_24h": float(pair.get("volumeUSD24h", 0)),
                                "apr": float(pair.get("apr", 0)),
                            }
            except Exception:
                pass
            return None
        return self._cached(f"aero_lp_{token_address}", fetch)

    def get_ccxt_price(self, symbol: str = "ETH/USDC", exchange_id: str = "binance") -> Optional[dict]:
        """Fetch price via ccxt from centralized exchanges."""
        def fetch():
            try:
                import ccxt
                exchange_class = getattr(ccxt, exchange_id)
                exchange = exchange_class({"enableRateLimit": True})
                ticker = exchange.fetch_ticker(symbol)
                return {
                    "bid": ticker.get("bid", 0),
                    "ask": ticker.get("ask", 0),
                    "last": ticker.get("last", 0),
                    "volume": ticker.get("baseVolume", 0),
                    "change": ticker.get("percentage", 0),
                    "exchange": exchange_id,
                    "symbol": symbol,
                }
            except Exception:
                return None
        return self._cached(f"ccxt_{exchange_id}_{symbol}", fetch)

    def get_0x_orderbook(self, sell_token: str, buy_token: str) -> Optional[dict]:
        """Fetch 0x limit order book data."""
        def fetch():
            try:
                url = "https://base.api.0x.org/orderbook/v1"
                params = {
                    "baseToken": sell_token,
                    "quoteToken": buy_token,
                    "page": 1,
                    "perPage": 5,
                }
                resp = requests.get(url, params=params, timeout=8)
                data = resp.json()
                bids = data.get("bids", {}).get("records", [])
                asks = data.get("asks", {}).get("records", [])
                return {
                    "bids": [{"price": float(b.get("order", {}).get("makerAmount", 0)), "size": float(b.get("order", {}).get("takerAmount", 0))} for b in bids[:5]],
                    "asks": [{"price": float(a.get("order", {}).get("makerAmount", 0)), "size": float(a.get("order", {}).get("takerAmount", 0))} for a in asks[:5]],
                }
            except Exception:
                return None
        return self._cached(f"0x_{sell_token}_{buy_token}", fetch)

    def update_price_history(self, token: str, price: float):
        """Track price history for sparklines."""
        if token not in self._price_history:
            self._price_history[token] = []
        self._price_history[token].append(price)
        if len(self._price_history[token]) > self._max_history:
            self._price_history[token] = self._price_history[token][-self._max_history:]

    def get_price_history(self, token: str) -> list[float]:
        """Get price history for sparkline rendering."""
        return self._price_history.get(token, [])

    def get_all_market_data(self) -> dict:
        """Get all market data."""
        au_address = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08"
        ag_address = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674"

        au_dex = self.get_dexscreener_price(au_address)
        ag_dex = self.get_dexscreener_price(ag_address)
        au_lp = self.get_aerodrome_lp(au_address)
        ag_lp = self.get_aerodrome_lp(ag_address)
        eth_binance = self.get_ccxt_price("ETH/USDC", "binance")
        eth_coinbase = self.get_ccxt_price("ETH/USDC", "coinbase")

        # Update price history
        if au_dex:
            self.update_price_history("Au", au_dex.get("price_usd", 0))
        if ag_dex:
            self.update_price_history("Ag", ag_dex.get("price_usd", 0))
        if eth_binance:
            self.update_price_history("ETH", eth_binance.get("last", 0))

        return {
            "au_dex": au_dex,
            "ag_dex": ag_dex,
            "au_lp": au_lp,
            "ag_lp": ag_lp,
            "eth_binance": eth_binance,
            "eth_coinbase": eth_coinbase,
            "price_history": {
                "Au": self.get_price_history("Au"),
                "Ag": self.get_price_history("Ag"),
                "ETH": self.get_price_history("ETH"),
            },
        }
