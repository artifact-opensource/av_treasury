"""
On-chain state reader — async Web3 calls for keeper and TUI.
All reads are cached with configurable TTL.
"""

import asyncio
import time
from typing import Any, Optional

from web3 import Web3
from web3.middleware import ExtraDataToChainParamsMiddleware

from .config import (
    RPC_URL, CONTRACTS, CHAIN_ID,
    PID_ABI, FLASHBUY_ABI, ORACLE_ABI, TREASURY_AMO_ABI,
    AU_ABI, AG_ABI,
)

# ─── Web3 Setup ─────────────────────────────────────────────────────────────

w3 = Web3(Web3.AsyncHTTPProvider(RPC_URL))
w3.middleware_onion.add(ExtraDataToChainParamsMiddleware)


def _contract(name: str, abi: list) -> Any:
    """Get an async contract instance by name."""
    return w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACTS[name]),
        abi=abi,
    )


# ─── Cache ──────────────────────────────────────────────────────────────────

_cache: dict[str, tuple[float, Any]] = {}


async def _cached(key: str, ttl: float, coro) -> Any:
    """Simple TTL cache for async results."""
    now = time.monotonic()
    if key in _cache and (now - _cache[key][0]) < ttl:
        return _cache[key][1]
    result = await coro
    _cache[key] = (now, result)
    return result


# ─── Block & Gas ────────────────────────────────────────────────────────────

async def get_block_number() -> int:
    return await w3.eth.block_number


async def get_gas_price() -> int:
    return await w3.eth.gas_price


# ─── Au Token ───────────────────────────────────────────────────────────────

async def get_au_supply() -> int:
    contract = _contract("au", AU_ABI)
    return await contract.functions.totalSupply().call()


async def get_au_fee_bps() -> int:
    contract = _contract("au", AU_ABI)
    return await contract.functions.transferFeeBps().call()


# ─── Ag Token ───────────────────────────────────────────────────────────────

async def get_ag_supply() -> int:
    contract = _contract("ag", AG_ABI)
    return await contract.functions.totalSupply().call()


# ─── PID Controller ─────────────────────────────────────────────────────────

async def get_emission_rate() -> int:
    """Deployed PID v2: tokens that WOULD emit now (min of preview/remaining)."""
    contract = _contract("pid", PID_ABI)
    preview = await contract.functions.previewEmission().call()
    remaining = await contract.functions.remainingDailyEmission().call()
    return min(preview, remaining)


async def get_next_epoch_time() -> int:
    """Deployed PID v2: timeUntilDailyReset() -> seconds until next window."""
    contract = _contract("pid", PID_ABI)
    return await contract.functions.timeUntilDailyReset().call()


async def get_current_tvl() -> int:
    """Deployed PID v2: twatvl() (time-weighted TVL)."""
    contract = _contract("pid", PID_ABI)
    return await contract.functions.twatvl().call()


async def get_pid_error() -> int:
    """Deployed PID v2: lastError() -> last revert selector (0 = ok)."""
    contract = _contract("pid", PID_ABI)
    return await contract.functions.lastError().call()


# ─── FlashBuy ───────────────────────────────────────────────────────────────

async def can_execute_buyback() -> bool:
    """Deployed FlashBuy has no canExecute(); gate on PID daily window."""
    contract = _contract("pid", PID_ABI)
    until = await contract.functions.timeUntilDailyReset().call()
    remaining = await contract.functions.remainingDailyEmission().call()
    return (until == 0) and (remaining > 0)


async def get_last_buyback_time() -> int:
    """Deployed AMO has no getLastBuybackTime(); use lastOperationTime()."""
    contract = _contract("treasury_amo", TREASURY_AMO_ABI)
    return await contract.functions.lastOperationTime().call()


# ─── Oracle ─────────────────────────────────────────────────────────────────

async def get_au_price() -> int:
    """Deployed AvOracle v5: getAuPriceForAMO()."""
    contract = _contract("oracle", ORACLE_ABI)
    return await contract.functions.getAuPriceForAMO().call()


async def is_oracle_stale() -> bool:
    """Deployed AvOracle v5: isPriceValid(AU) is False when stale."""
    contract = _contract("oracle", ORACLE_ABI)
    au_addr = Web3.to_checksum_address(CONTRACTS.get("au"))
    return not await contract.functions.isPriceValid(au_addr).call()


# ─── Treasury AMO ───────────────────────────────────────────────────────────

async def get_nav() -> int:
    """Deployed AMO has no getNAV(); use getReserveBalance() as NAV proxy."""
    contract = _contract("treasury_amo", TREASURY_AMO_ABI)
    return await contract.functions.getReserveBalance().call()


async def get_reserve_ratio() -> int:
    """Deployed AMO has no getReserveRatio(); compute from balances * 1e4."""
    contract = _contract("treasury_amo", TREASURY_AMO_ABI)
    reserve = await contract.functions.getReserveBalance().call()
    au = await contract.functions.getAuBalance().call()
    total = reserve + au
    return int(reserve * 10000 / total) if total > 0 else 0


async def get_total_reserves() -> int:
    """Deployed AMO has no getTotalReserves(); sum Au + reserve balances."""
    contract = _contract("treasury_amo", TREASURY_AMO_ABI)
    au = await contract.functions.getAuBalance().call()
    res = await contract.functions.getReserveBalance().call()
    return au + res


# ─── Batch Reads ────────────────────────────────────────────────────────────

async def get_system_state() -> dict:
    """Read all on-chain state in parallel. Returns a dict of values."""
    results = await asyncio.gather(
        get_block_number(),
        get_gas_price(),
        get_au_supply(),
        get_ag_supply(),
        get_emission_rate(),
        get_next_epoch_time(),
        get_current_tvl(),
        get_pid_error(),
        can_execute_buyback(),
        get_last_buyback_time(),
        get_au_price(),
        is_oracle_stale(),
        get_nav(),
        get_reserve_ratio(),
        get_total_reserves(),
        return_exceptions=True,
    )

    keys = [
        "block_number", "gas_price", "au_supply", "ag_supply",
        "emission_rate", "next_epoch_time", "current_tvl", "pid_error",
        "can_execute_buyback", "last_buyback_time", "au_price", "oracle_stale",
        "nav", "reserve_ratio", "total_reserves",
    ]

    state = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            state[key] = None
            state[f"{key}_error"] = str(result)
        else:
            state[key] = result
    return state
