"""
Keeper Configuration — All addresses, ABIs, and parameters.
Source of truth: address.book + on-chain verification.
"""

import os
import stat
from pathlib import Path

# ─── Environment ────────────────────────────────────────────────────────────
_dotenv = Path(__file__).parent.parent / ".env"
if _dotenv.exists():
    # SPECTRE FIX H6: Verify .env file permissions are restrictive (owner-only)
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
RPC_URL = os.environ.get("RPC_URL_BASE", "https://mainnet.base.org")
BLOCK_TIME = 2  # seconds (Base L2)

# ─── Contract Addresses ─────────────────────────────────────────────────────
CONTRACTS = {
    "au": "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08",
    "ag": "0x1D31719389Bd8b17277Ba367c26b830aE34D3674",
    "treasury_amo": "0x56653245f4718fe105b95C8424947B31b84b5188",
    "pid": "0x99114F594Ff218028309d3E7F47C5873B9917f70",
    "governor": "0x3DEDAf8AF86838D3EB8342c2E0AE605B5F74a9eb",
    "timelock": "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be",
    "quasicrystal": "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD",
    "oracle": "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB",
    "flashbuy": "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b",
    "safe": "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e",
}

# ─── Keeper Wallet ──────────────────────────────────────────────────────────
KEEPER_PRIVATE_KEY = os.environ.get("KEEPER_PRIVATE_KEY", "")
if not KEEPER_PRIVATE_KEY:
    raise RuntimeError(
        "KEEPER_PRIVATE_KEY not set. Create a dedicated hot key (NOT deployer). "
        "Set it in .env or environment."
    )

# ─── Keeper Parameters ──────────────────────────────────────────────────────
EMISSION_CHECK_INTERVAL = 12       # seconds — check every 12s (6 blocks)
BUYBACK_CHECK_INTERVAL = 30        # seconds — check every 30s
ORACLE_UPDATE_INTERVAL = 60        # seconds — push oracle update every 60s
HEALTH_CHECK_INTERVAL = 15         # seconds — overall system health
TVL_DROP_THRESHOLD = 0.10          # 10% TVL drop triggers emergency
NAV_DEVIATION_THRESHOLD = 0.02    # 2% NAV deviation triggers buyback
MIN_RESERVE_RATIO = 0.50           # 50% minimum reserve ratio
GAS_PRICE_MULTIPLIER = 1.1         # 10% over base gas for priority
MAX_GAS_PRICE_GWEI = 0.5           # Base L2 gas cap
TX_CONFIRMATION_BLOCKS = 1         # Wait for 1 confirmation on L2

# ─── Manual Price Fallback ─────────────────────────────────────────────────
# Used when on-chain oracle has no price data (no DEX liquidity yet).
# Set to 0.0 to disable and require live pricing.
MANUAL_AU_PRICE = float(os.environ.get("AU_PRICE_MANUAL", "1.0"))
MANUAL_AG_PRICE = float(os.environ.get("AG_PRICE_MANUAL", "0.1"))
PRICE_MAX_DEVIATION = 0.05          # 5% max deviation between on-chain and manual

# ─── Derived: Keeper Address ────────────────────────────────────────────────
try:
    from eth_account import Account as _Acct
    KEEPER_ADDRESS = _Acct.from_key(KEEPER_PRIVATE_KEY).address if KEEPER_PRIVATE_KEY else ""
except ImportError:
    KEEPER_ADDRESS = ""

# ─── God Mode Parameters ────────────────────────────────────────────────────
# Buyback strategy
BUYBACK_DAILY_CAP = float(os.environ.get("BUYBACK_DAILY_CAP", "5000"))  # $5k/day default
BUYBACK_MIN_AMOUNT = float(os.environ.get("BUYBACK_MIN_AMOUNT", "50"))  # $50 minimum
BUYBACK_COOLDOWN = int(os.environ.get("BUYBACK_COOLDOWN", "300"))       # 5min cooldown
BUYBACK_SLIPPAGE_BPS = int(os.environ.get("BUYBACK_SLIPPAGE_BPS", "50"))  # 0.5% default

# MEV Protection
FLASHBOTS_SIGNING_KEY = os.environ.get("FLASHBOTS_SIGNING_KEY", "") or None

# DEX Pool addresses for monitoring (extend as needed)
POOL_ADDRESSES = [
    os.environ.get("AG_USDC_POOL", ""),
    os.environ.get("AG_ETH_POOL", ""),
]
POOL_ADDRESSES = [a for a in POOL_ADDRESSES if a]

# Warden sensitivity (0.0 = chill, 1.0 = paranoid)
WARDEN_SENSITIVITY = float(os.environ.get("WARDEN_SENSITIVITY", "0.5"))

# Strategy
STRATEGY_AGGRESSION = os.environ.get("STRATEGY_AGGRESSION", "balanced")  # conservative|balanced|aggressive

# ─── Logging ────────────────────────────────────────────────────────────────
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_LEVEL = os.environ.get("KEEPER_LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s"

# ─── API Endpoints ──────────────────────────────────────────────────────────
DEXSCREENER_API = "https://api.dexscreener.com"
DEXSCREENER_AU = f"{DEXSCREENER_API}/latest/dex/tokens/{CONTRACTS['au']}"
GNOSIS_SAFE_API = f"https://safe-transaction-base.safe.global/api/v1/safes/{CONTRACTS['safe']}"
BASESCAN_API = "https://api.basescan.org/api"
BASESCAN_API_KEY = os.environ.get("BASESCAN_API_KEY", "")

# ─── Minimal ABIs (only functions the keeper calls) ─────────────────────────

PID_ABI = [
    {
        "inputs": [],
        "name": "executeEmission",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getNextEpochTime",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getEmissionRate",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getCurrentTVL",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getError",
        "outputs": [{"internalType": "int256", "name": "", "type": "int256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

FLASHBUY_ABI = [
    {
        "inputs": [],
        "name": "executeBuyback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "canExecute",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getLastBuybackTime",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

ORACLE_ABI = [
    {
        "inputs": [],
        "name": "updatePrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getAuPrice",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getAuAgPrices",
        "outputs": [
            {"internalType": "uint256", "name": "auPrice", "type": "uint256"},
            {"internalType": "uint256", "name": "agPrice", "type": "uint256"},
            {"internalType": "uint8", "name": "auSource", "type": "uint8"},
            {"internalType": "uint8", "name": "agSource", "type": "uint8"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "getPrice",
        "outputs": [
            {"internalType": "uint256", "name": "price", "type": "uint256"},
            {"internalType": "uint8", "name": "source", "type": "uint8"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "isStale",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]

TREASURY_AMO_ABI = [
    {
        "inputs": [],
        "name": "getNAV",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getReserveRatio",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getTotalReserves",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

AU_ABI = [
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "transferFeeBps",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

AG_ABI = [
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


# ─── Settings Wrapper ──────────────────────────────────────────────────────
# Provides a clean object interface for all keeper subsystems.

class Settings:
    """Centralized settings object consumed by all keeper modules."""

    def __init__(self) -> None:
        # Chain
        self.rpc_url = RPC_URL
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
        self.max_buy_usd = BUYBACK_DAILY_CAP * 0.25  # 25% of daily per tx
        self.min_buy_usd = BUYBACK_MIN_AMOUNT
        self.slippage_tolerance = BUYBACK_SLIPPAGE_BPS
        self.cooldown_blocks = BUYBACK_COOLDOWN // 12  # Convert secs→blocks
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

    def validate(self) -> list[str]:
        """Validate settings, return list of errors."""
        errors = []
        if not self.keeper_private_key:
            errors.append("KEEPER_PRIVATE_KEY not set")
        if not self.rpc_url:
            errors.append("RPC_URL not set")
        if not self.ag_address:
            errors.append("Ag contract address not set")
        return errors


# Singleton — import this from other modules
settings = Settings()
