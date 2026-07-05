"""
Settings class — wraps module-level config for use by god-mode subsystems.

Provides a clean interface for Warden, Strategy, MEV, and Governor modules
while staying compatible with the existing keeper config.
"""

from __future__ import annotations

from . import config


class Settings:
    """
    Unified settings interface.
    Reads from keeper.config (which reads from .env).
    Adds computed properties for god-mode modules.
    """

    def __init__(self):
        # Network
        self.rpc_url: str = config.RPC_URL
        self.chain_id: int = config.CHAIN_ID
        self.block_time: int = config.BLOCK_TIME

        # Contracts
        self.contracts: dict = config.CONTRACTS
        self.au_address: str = config.CONTRACTS["au"]
        self.ag_address: str = config.CONTRACTS["ag"]
        self.treasury_amo_address: str = config.CONTRACTS["treasury_amo"]
        self.pid_address: str = config.CONTRACTS["pid"]
        self.governor_address: str = config.CONTRACTS["governor"]
        self.timelock_address: str = config.CONTRACTS["timelock"]
        self.oracle_address: str = config.CONTRACTS["oracle"]
        self.flashbuy_address: str = config.CONTRACTS["flashbuy"]
        self.safe_address: str = config.CONTRACTS["safe"]

        # Keeper wallet
        self.keeper_private_key: str = config.KEEPER_PRIVATE_KEY
        self.keeper_address: str = config.KEEPER_ADDRESS

        # Buyback parameters
        self.daily_buy_cap_usd: float = config.BUYBACK_DAILY_CAP
        self.monthly_buy_cap_usd: float = config.BUYBACK_DAILY_CAP * 30
        self.min_buy_usd: float = config.BUYBACK_MIN_AMOUNT
        self.max_buy_usd: float = config.BUYBACK_DAILY_CAP * 0.25
        self.cooldown_blocks: int = max(1, config.BUYBACK_COOLDOWN // config.BLOCK_TIME)
        self.slippage_tolerance: float = config.BUYBACK_SLIPPAGE_BPS / 10000
        self.min_ag_output: float = 0.0

        # Price / Peg
        self.peg_price: float = 1.0
        self.peg_threshold: float = 1.0 - config.NAV_DEVIATION_THRESHOLD

        # Gas
        self.max_gas_gwei: float = config.MAX_GAS_PRICE_GWEI
        self.gas_price_multiplier: float = config.GAS_PRICE_MULTIPLIER

        # Intervals
        self.tick_interval_seconds: int = config.BUYBACK_CHECK_INTERVAL
        self.emission_check_interval: int = config.EMISSION_CHECK_INTERVAL
        self.oracle_update_interval: int = config.ORACLE_UPDATE_INTERVAL
        self.health_check_interval: int = config.HEALTH_CHECK_INTERVAL

        # Warden
        self.warden_sensitivity: float = config.WARDEN_SENSITIVITY

        # Strategy
        self.strategy_aggression: float = config.STRATEGY_AGGRESSION

        # MEV
        self.flashbots_signing_key: str = config.FLASHBOTS_SIGNING_KEY

        # Pools
        self.pool_addresses: list = config.POOL_ADDRESSES

        # Logging
        self.log_level: str = config.LOG_LEVEL
        self.log_dir: str = str(config.LOG_DIR)

    def __repr__(self) -> str:
        return (
            f"Settings(chain={self.chain_id}, "
            f"keeper={self.keeper_address[:10]}..., "
            f"daily_cap=${self.daily_buy_cap_usd})"
        )
