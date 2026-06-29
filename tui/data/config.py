"""Configuration: contract addresses, RPC endpoints, API keys."""

# ─── Network ────────────────────────────────────────────────────────────────
CHAIN_ID = 8453
CHAIN_NAME = "Base Mainnet"
RPC_URL = "https://mainnet.base.org"
EXPLORER = "https://basescan.org"

# ─── Contract Addresses ─────────────────────────────────────────────────────
AU_TOKEN = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08"
AU_TOKEN_IMPL = "0x4682C375969DBb1CDcbA1Eaedab7FC288c8fBb61"
AG_TOKEN = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674"
AG_TOKEN_IMPL = None  # Unknown impl address
TREASURY_AMO = "0x56653245f4718fe105b95C8424947B31b84b5188"
PID_CONTROLLER = "0x99114F594Ff218028309d3E7F47C5873B9917f70"
GOVERNOR = "0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385"
TIMELOCK = "0x662321CC63700865838aB08378061BE499344714"
QUASICYSTAL_LP_NFT = "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD"
AVORACLE_V5 = "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB"
FLASHBUY_V2 = "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b"
TREASURY_SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e"

# Deployment status
NOT_DEPLOYED = {TREASURY_AMO, PID_CONTROLLER, GOVERNOR, TIMELOCK}

# ─── Token Metadata ─────────────────────────────────────────────────────────
DECIMALS = 18
ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

# ─── API Endpoints ──────────────────────────────────────────────────────────
DEXSCREENER_TOKEN = "https://api.dexscreener.com/latest/dex/tokens/{address}"
DEXSCREENER_PAIRS = "https://api.dexscreener.com/latest/dex/pairs/{chain}/{pair}"
GNOSIS_SAFE_API = "https://safe-transaction-base.safe.global/api/v1/"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# ─── Brand Colors ───────────────────────────────────────────────────────────
COLORS = {
    "gold": "#FFD700",
    "gold_dim": "#B8860B",
    "purple": "#3A1078",
    "purple_light": "#5B2C8E",
    "purple_dark": "#1A0840",
    "bg": "#0D0D0D",
    "bg_panel": "#1A1A2E",
    "bg_panel_light": "#252540",
    "text": "#E0E0E0",
    "text_dim": "#888888",
    "green": "#00FF88",
    "red": "#FF4444",
    "blue": "#4488FF",
    "cyan": "#00CCCC",
    "orange": "#FF8800",
    "white": "#FFFFFF",
}

# ─── Update Intervals (seconds) ─────────────────────────────────────────────
TICK_PRICE = 1.0
TICK_ONCHAIN = 3.0
TICK_HEAVY = 12.0
TICK_STATUS = 1.0

# ─── Keyboard Shortcuts ─────────────────────────────────────────────────────
SHORTCUTS = {
    "1": "Dashboard",
    "2": "Tokens",
    "3": "Treasury",
    "4": "Governance",
    "5": "Keeper",
    "6": "Oracle",
    "7": "NFT",
    "8": "Wallet",
    "q": "Quit",
}
