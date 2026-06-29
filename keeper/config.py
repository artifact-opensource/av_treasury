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
