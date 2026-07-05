"""
Keeper Configuration — All addresses, ABIs, and parameters.
Source of truth: address.book + on-chain verification.
"""

import os
import stat
import random
from pathlib import Path
from web3 import Web3
from web3.providers.http import HTTPProvider

# ─── Environment ────────────────────────────────────────────────────────────
_dotenv = Path(__file__).parent.parent / ".env"
if _dotenv.exists():
    _env_stat = _dotenv.stat()
    _env_mode = _env_stat.st_mode
    if _env_mode & (stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH):
        import warnings
        warnings.warn(
            f"SECURITY: .env file has loose permissions ({oct(_env_mode)}). "
            f"Run: chmod 600 {_dotenv}",
            RuntimeWarning,
            stacklevel=2,
        )

    for line in _dotenv.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))

# ─── Network ────────────────────────────────────────────────────────────────
CHAIN_ID = 8453
RPC_LIST = [url.strip() for url in os.environ.get("RPC_URL_BASE", "https://mainnet.base.org").split(",")]
BLOCK_TIME = 2  # seconds (Base L2)

class RotatingHTTPProvider(HTTPProvider):
    """HTTP Provider that rotates through a list of RPCs on 429/failure."""
    def __init__(self, urls):
        self.urls = urls
        self.current_index = 0
        super().__init__(endpoint=self.urls[self.current_index])

    def make_request(self, request):
        try:
            return super().make_request(request)
        except Exception as e:
            if "429" in str(e) or "rate limit" in str(e).lower():
                self.current_index = (self.current_index + 1) % len(self.urls)
                self.endpoint = self.urls[self.current_index]
                # Retry once with new RPC
                return super().make_request(request)
            raise e

# ─── Contract Addresses ─────────────────────────────────────────────────────
CONTRACTS = {
    "au": "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    "ag": "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    "treasury_amo": "0xF096cD4D24811B0F824c929907196bCB796bca88",
    "pid": "0xB8F240870DBc1cD5F9262F8180350A29ea404268",
    "governor": "0x5F061c177b76753686122185989C2332C1d0e8b1",
    "timelock": "0x09058FdD4dD60b4E2F2C4F_ la_C370DA3cB606c09Be",
    "quasicrystal": "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD",
    "oracle": "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB",
    "flashbuy": "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b",
    "safe": "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e",
}

# ─── Keeper Wallet ──────────────────────────────────────────────────────────
KEEPER_PRIVATE_KEY = os.environ.get("KEEPER_PRIVATE_KEY", "")
if not KEEPER_PRIVATE_KEY:
    raise RuntimeError("KEEPER_PRIVATE_KEY not set.")

try:
    from eth_account import Account as _Acct
    KEEPER_ADDRESS = _Acct.from_key(KEEPER_PRIVATE_KEY).address if KEEPER_PRIVATE_KEY else ""
except ImportError:
    KEEPER_ADDRESS = ""

# ─── Keeper Parameters ──────────────────────────────────────────────────────
EMISSION_CHECK_INTERVAL = 12
BUYBACK_CHECK_INTERVAL = 30
ORACLE_UPDATE_INTERVAL = 60
HEALTH_CHECK_INTERVAL = 15
TVL_DROP_THRESHOLD = 0.10
NAV_DEVIATION_THRESHOLD = 0.02
MIN_RESERVE_RATIO = 0.50
GAS_PRICE_MULTIPLIER = 1.1
MAX_GAS_PRICE_GWEI = 0.5
TX_CONFIRMATION_BLOCKS = 1

MANUAL_AU_PRICE = float(os.environ.get("AU_PRICE_MANUAL", "1.0"))
MANUAL_AG_PRICE = float(os.environ.get("AG_PRICE_MANUAL", "0.1"))
PRICE_MAX_DEVIATION = 0.05

BUYBACK_DAILY_CAP = float(os.environ.get("BUYBACK_DAILY_CAP", "5000"))
BUYBACK_MIN_AMOUNT = float(os.environ.get("BUYBACK_MIN_AMOUNT", "50"))
BUYBACK_COOLDOWN = int(os.environ.get("BUYBACK_COOLDOWN", "300"))
BUYBACK_SLIPPAGE_BPS = int(os.environ.get("BUYBACK_SLIPPAGE_BPS", "50"))

FLASHBOTS_SIGNING_KEY = os.environ.get("FLASHBOTS_SIGNING_KEY", "") or None
POOL_ADDRESSES = [os.environ.get("AG_USDC_POOL", ""), os.environ.get("AG_ETH_POOL", "")]
POOL_ADDRESSES = [a for a in POOL_ADDRESSES if a]
WARDEN_SENSITIVITY = float(os.environ.get("WARDEN_SENSITIVITY", "0.5"))
STRATEGY_AGGRESSION = os.environ.get("STRATEGY_AGGRESSION", "balanced")

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_LEVEL = os.environ.get("KEEPER_LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s"

DEXSCREENER_API = "https://api.dexscreener.com"
DEXSCREENER_AU = f"{DEXSCREENER_API}/latest/dex/tokens/{CONTRACTS['au']}"
GNOSIS_SAFE_API = f"https://safe-transaction-base.safe.global/api/v1/safes/{CONTRACTS['safe']}"
BASESCAN_API = "https://api.basescan.org/api"
BASESCAN_API_KEY = os.environ.get("BASESCAN_API_KEY", "")

PID_ABI = [
    {"inputs": [], "name": "executeEmission", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "getNextEpochTime", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getEmissionRate", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getCurrentTVL", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getError", "outputs": [{"internalType": "int256", "name": "", "type": "int256"}], "stateMutability": "view", "type": "function"},
]

FLASHBUY_ABI = [
    {"inputs": [], "name": "executeBuyback", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "canExecute", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getLastBuybackTime", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

ORACLE_ABI = [
    {"inputs": [], "name": "updatePrice", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "getAuPrice", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getAuAgPrices", "outputs": [{"internalType": "uint256", "name": "auPrice", "type": "uint256"}, {"internalType": "uint256", "name": "agPrice", "type": "uint256"}, {"internalType": "uint8", "name": "auSource", "type": "uint8"}, {"internalType": "uint8", "name": "agSource", "type": "uint8"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"internalType": "address", "name": "token", "type": "address"}], "name": "getPrice", "outputs": [{"internalType": "uint256", "name": "price", "type": "uint256"}, {"internalType": "uint8", "name": "source", "type": "uint8"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "isStale", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"},
]

TREASURY_AMO_ABI = [
    {"inputs": [], "name": "getNAV", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getReserveRatio", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getTotalReserves", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

AU_ABI = [
    {"inputs": [], "name": "totalSupply", "outputs": [{"internalType": "uint256", "name": "totalSupply", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "transferFeeBps", "outputs": [{"internalType": "uint256", "name": "transferFeeBps", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

AG_ABI = [
    {"inputs": [], "name": "totalSupply", "outputs": [{"internalType": "uint256", "name": "totalSupply", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

class Settings:
    def __init__(self) -> None:
        # Network
        self.rpc_provider = RotatingHTTPProvider(RPC_LIST)
        self.web3 = Web3(self.rpc_provider)
        self.chain_id = CHAIN_ID

        # Keys
        self.keeper_private_key = KEEPER_PRIVATE_KEY
        self.keeper_address = KEEPER_ADDRESS

        # Contracts
        self.ag_address = CONTRACTS["ag"]
        self.au_address = CONTRACTS["au"]
        self.treasury_amo_address = CONTRACTS["treasury_amo"]
        self.governor_address = CONTRACTS["governor"]
        self.timelock_address = CONTRACTS["timelock"]

        # Buyback parameters
        self.peg_price = 1.0
        self.peg_threshold = NAV_DEVIATION_THRESHOLD
        self.daily_buy_cap_usd = BUYBACK_DAILY_CAP
        self.monthly_buy_cap_usd = BUYBACK_DAILY_CAP * 30
        self.max_buy_usd = BUYBACK_DAILY_CAP * 0.25
        self.min_buy_usd = BUYBACK_MIN_AMOUNT
        self.slippage_tolerance = BUYBACK_SLIPPAGE_BPS
        self.cooldown_blocks = BUYBACK_COOLDOWN // 12
        self.min_ag_output = 0.0

        # Gas
        self.max_gas_gwei = MAX_GAS_PRICE_GWEI

        # Loop timing
        self.tick_interval_seconds = EMISSION_CHECK_INTERVAL

        # MEV
        self.flashbots_signing_key = FLASHBOTS_SIGNING_KEY
        self.pool_addresses = POOL_ADDRESSES

        # Strategy
        self.strategy_aggression = STRATEGY_AGGRESSION
        self.warden_sensitivity = WARDEN_SENSITIVITY

    @property
    def rpc_url(self) -> str:
        """Returns the current active RPC URL."""
        return self.rpc_provider.endpoint

    def validate(self) -> list[str]:
        errors = []
        if not self.keeper_private_key:
            errors.append("KEEPER_PRIVATE_KEY not set")
        if not RPC_LIST:
            errors.append("RPC_URL not set")
        if not self.ag_address:
            errors.append("Ag contract address not set")
        return errors

settings = Settings()
