"""Contract ABIs and helpers for on-chain reads."""

# ─── Minimal ERC20 ABI ──────────────────────────────────────────────────────
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"},
        ],
        "name": "Transfer",
        "type": "event",
    },
]

# ─── AvOracle v5 ABI (key functions) ────────────────────────────────────────
AVORACLE_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "getPrice",
        "outputs": [
            {"internalType": "uint256", "name": "price", "type": "uint256"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "getTWAP",
        "outputs": [
            {"internalType": "uint256", "name": "twap", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── TreasuryAMO ABI (key functions) ────────────────────────────────────────
TREASURY_AMO_ABI = [
    {
        "inputs": [],
        "name": "getReserveRatio",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getNavPerToken",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalReserveValue",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── PID Controller ABI ────────────────────────────────────────────────────
PID_CONTROLLER_ABI = [
    {
        "inputs": [],
        "name": "getCurrentEmission",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
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
        "name": "getActive",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── Governor ABI ───────────────────────────────────────────────────────────
GOVERNOR_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "proposalId", "type": "uint256"}],
        "name": "getProposal",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "id", "type": "uint256"},
                    {"internalType": "address", "name": "proposer", "type": "address"},
                    {"internalType": "string", "name": "description", "type": "string"},
                    {"internalType": "uint256", "name": "forVotes", "type": "uint256"},
                    {"internalType": "uint256", "name": "againstVotes", "type": "uint256"},
                    {"internalType": "uint256", "name": "startTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "endTime", "type": "uint256"},
                    {"internalType": "bool", "name": "executed", "type": "bool"},
                ],
                "internalType": "struct Governor.Proposal",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "proposalCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "quorum",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── FlashBuy ABI ───────────────────────────────────────────────────────────
FLASHBUY_ABI = [
    {
        "inputs": [],
        "name": "getLastTriggerTime",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getCooldownRemaining",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "isActive",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── QuasiCrystal NFT ABI ──────────────────────────────────────────────────
QUASICYSTAL_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "getPosition",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "lpAmount", "type": "uint256"},
                    {"internalType": "uint256", "name": "lockEnd", "type": "uint256"},
                    {"internalType": "uint256", "name": "multiplier", "type": "uint256"},
                    {"internalType": "uint256", "name": "pendingRewards", "type": "uint256"},
                ],
                "internalType": "struct QuasiCrystal.Position",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "index", "type": "uint256"},
        ],
        "name": "tokenOfOwnerByIndex",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── Au Token Extended ABI ──────────────────────────────────────────────────
AU_TOKEN_ABI = ERC20_ABI + [
    {
        "inputs": [],
        "name": "getTransferFee",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getMaxWallet",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getHolderCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── Ag Token Extended ABI ──────────────────────────────────────────────────
AG_TOKEN_ABI = ERC20_ABI + [
    {
        "inputs": [],
        "name": "getStakingDistribution",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ─── ABI Registry ───────────────────────────────────────────────────────────
ABI_REGISTRY = {
    "erc20": ERC20_ABI,
    "avoracle": AVORACLE_ABI,
    "treasury_amo": TREASURY_AMO_ABI,
    "pid_controller": PID_CONTROLLER_ABI,
    "governor": GOVERNOR_ABI,
    "flashbuy": FLASHBUY_ABI,
    "quasicyrstal": QUASICYSTAL_ABI,
    "au_token": AU_TOKEN_ABI,
    "ag_token": AG_TOKEN_ABI,
}


def get_abi(name: str) -> list:
    """Get ABI by name."""
    return ABI_REGISTRY.get(name, ERC20_ABI)
