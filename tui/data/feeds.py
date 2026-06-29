"""All data fetching logic - DEXScreener, on-chain reads, exchange data."""

import asyncio
import time
from typing import Optional
from decimal import Decimal

import aiohttp

from tui.data.config import (
    AU_TOKEN, AG_TOKEN, AVORACLE_V5, TREASURY_AMO, PID_CONTROLLER,
    FLASHBUY_V2, QUASICYSTAL_LP_NFT, GOVERNOR, TREASURY_SAFE,
    DEXSCREENER_TOKEN, RPC_URL, NOT_DEPLOYED, DECIMALS, GNOSIS_SAFE_API,
    AU_TOKEN_IMPL, AG_TOKEN_IMPL,
)
from tui.data.contracts import (
    AU_TOKEN_ABI, AG_TOKEN_ABI, ERC20_ABI, AVORACLE_ABI,
    TREASURY_AMO_ABI, PID_CONTROLLER_ABI, FLASHBUY_ABI,
    GOVERNOR_ABI, QUASICYSTAL_ABI,
)

# ─── Caches ──────────────────────────────────────────────────────────────────
_price_cache: dict = {}
_onchain_cache: dict = {}
_heavy_cache: dict = {}
_price_history: list = []  # For sparklines
_price_history_max = 60


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _format_amount(wei_value: int, decimals: int = DECIMALS) -> str:
    """Format wei to human-readable."""
    if wei_value is None or wei_value == "N/A":
        return "N/A"
    val = wei_value / (10 ** decimals)
    if val >= 1_000_000_000:
        return f"{val / 1_000_000_000:.2f}B"
    elif val >= 1_000_000:
        return f"{val / 1_000_000:.2f}M"
    elif val >= 1_000:
        return f"{val / 1_000:.2f}K"
    else:
        return f"{val:.6f}"


def _safe_div(a, b):
    """Safe division."""
    try:
        if b == 0 or b is None:
            return 0
        return a / b
    except (TypeError, ZeroDivisionError):
        return 0


def _usd_from_ether(wei_value: int) -> float:
    """Convert wei to USD float."""
    if wei_value is None:
        return 0.0
    return wei_value / 1e18


# ─── DEXScreener API ────────────────────────────────────────────────────────
async def fetch_dexscreener_token(address: str) -> dict:
    """Fetch token data from DEXScreener."""
    url = DEXSCREENER_TOKEN.format(address=address)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    pairs = data.get("pairs", [])
                    if pairs:
                        # Sort by volume, take top pair
                        pairs.sort(key=lambda p: float(p.get("volume", {}).get("h24", 0) or 0), reverse=True)
                        pair = pairs[0]
                        result = {
                            "price_usd": float(pair.get("priceUsd", 0) or 0),
                            "price_change_24h": float(pair.get("priceChange", {}).get("h24", 0) or 0),
                            "volume_24h": float(pair.get("volume", {}).get("h24", 0) or 0),
                            "liquidity_usd": float(pair.get("liquidity", {}).get("usd", 0) or 0),
                            "market_cap": float(pair.get("marketCap", 0) or pair.get("fdv", 0) or 0),
                            "pair_address": pair.get("pairAddress", ""),
                            "dex": pair.get("dexId", ""),
                            "chain": pair.get("chainId", ""),
                            "base_token": pair.get("baseToken", {}).get("symbol", ""),
                            "price_history": _extract_price_history(pair),
                        }
                        return result
                return {}
    except Exception as e:
        return {"error": str(e)}


def _extract_price_history(pair: dict) -> list:
    """Extract price history from pair data for sparkline."""
    # DEXScreener doesn't give full history, return current price as single point
    price = pair.get("priceUsd", "0")
    try:
        return [float(price)]
    except (ValueError, TypeError):
        return [0.0]


async def fetch_all_prices() -> dict:
    """Fetch all token prices from DEXScreener."""
    result = {}
    tasks = {
        "au": fetch_dexscreener_token(AU_TOKEN),
        "ag": fetch_dexscreener_token(AG_TOKEN),
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    for key, data in zip(tasks.keys(), results):
        if isinstance(data, Exception):
            result[key] = {"error": str(data)}
        else:
            result[key] = data

    # Update price history for sparkline
    au_price = result.get("au", {}).get("price_usd", 0)
    if au_price > 0:
        _price_history.append(au_price)
        if len(_price_history) > _price_history_max:
            _price_history.pop(0)

    return result


def get_price_history() -> list:
    """Get stored price history for sparklines."""
    return list(_price_history)


# ─── On-chain Reads (web3.py) ──────────────────────────────────────────────
_w3 = None


def _get_w3():
    """Get or create Web3 instance."""
    global _w3
    if _w3 is None:
        try:
            from web3 import Web3
            _w3 = Web3(Web3.HTTPProvider(RPC_URL))
        except ImportError:
            return None
    return _w3


async def _call_contract_async(address: str, abi: list, function: str, *args) -> any:
    """Make an async contract call."""
    w3 = _get_w3()
    if w3 is None:
        return None
    try:
        checksum_addr = w3.to_checksum_address(address)
        contract = w3.eth.contract(address=checksum_addr, abi=abi)
        func = getattr(contract.functions, function)
        # Run in thread pool to not block
        result = await asyncio.get_event_loop().run_in_executor(
            None, func(*args).call
        )
        return result
    except Exception:
        return None


async def fetch_block_height() -> int:
    """Fetch current block height."""
    w3 = _get_w3()
    if w3 is None:
        return 0
    try:
        return await asyncio.get_event_loop().run_in_executor(
            None, w3.eth.get_block_number
        )
    except Exception:
        return 0


async def fetch_gas_price() -> float:
    """Fetch current gas price in gwei."""
    w3 = _get_w3()
    if w3 is None:
        return 0.0
    try:
        gas = await asyncio.get_event_loop().run_in_executor(
            None, w3.eth.gas_price
        )
        return gas / 1e9  # Convert to gwei
    except Exception:
        return 0.0


async def fetch_au_supply() -> int:
    """Fetch Au total supply."""
    return await _call_contract_async(AU_TOKEN, AU_TOKEN_ABI, "totalSupply")


async def fetch_ag_supply() -> int:
    """Fetch Ag total supply."""
    return await _call_contract_async(AG_TOKEN, AG_TOKEN_ABI, "totalSupply")


async def fetch_au_balance(address: str) -> int:
    """Fetch Au balance of address."""
    w3 = _get_w3()
    if w3 is None:
        return 0
    return await _call_contract_async(AU_TOKEN, AU_TOKEN_ABI, "balanceOf", w3.to_checksum_address(address))


async def fetch_ag_balance(address: str) -> int:
    """Fetch Ag balance of address."""
    w3 = _get_w3()
    if w3 is None:
        return 0
    return await _call_contract_async(AG_TOKEN, AG_TOKEN_ABI, "balanceOf", w3.to_checksum_address(address))


async def fetch_eth_balance(address: str) -> int:
    """Fetch ETH balance of address."""
    w3 = _get_w3()
    if w3 is None:
        return 0
    try:
        return await asyncio.get_event_loop().run_in_executor(
            None, w3.eth.get_balance, w3.to_checksum_address(address)
        )
    except Exception:
        return 0


async def fetch_au_holders() -> int:
    """Fetch Au holder count."""
    return await _call_contract_async(AU_TOKEN, AU_TOKEN_ABI, "getHolderCount")


async def fetch_au_transfer_fee() -> int:
    """Fetch Au transfer fee in basis points."""
    return await _call_contract_async(AU_TOKEN, AU_TOKEN_ABI, "getTransferFee")


async def fetch_au_max_wallet() -> int:
    """Fetch Au max wallet amount."""
    return await _call_contract_async(AU_TOKEN, AU_TOKEN_ABI, "getMaxWallet")


async def fetch_reserve_ratio() -> int:
    """Fetch reserve ratio from TreasuryAMO (in basis points, 10000 = 100%)."""
    if TREASURY_AMO in NOT_DEPLOYED:
        return None
    return await _call_contract_async(TREASURY_AMO, TREASURY_AMO_ABI, "getReserveRatio")


async def fetch_nav_per_token() -> int:
    """Fetch NAV per Au token."""
    if TREASURY_AMO in NOT_DEPLOYED:
        return None
    return await _call_contract_async(TREASURY_AMO, TREASURY_AMO_ABI, "getNavPerToken")


async def fetch_total_reserve_value() -> int:
    """Fetch total reserve value."""
    if TREASURY_AMO in NOT_DEPLOYED:
        return None
    return await _call_contract_async(TREASURY_AMO, TREASURY_AMO_ABI, "totalReserveValue")


async def fetch_pid_emission() -> int:
    """Fetch current PID emission rate."""
    if PID_CONTROLLER in NOT_DEPLOYED:
        return None
    return await _call_contract_async(PID_CONTROLLER, PID_CONTROLLER_ABI, "getCurrentEmission")


async def fetch_pid_next_epoch() -> int:
    """Fetch next PID epoch timestamp."""
    if PID_CONTROLLER in NOT_DEPLOYED:
        return None
    return await _call_contract_async(PID_CONTROLLER, PID_CONTROLLER_ABI, "getNextEpochTime")


async def fetch_pid_active() -> bool:
    """Fetch PID controller active status."""
    if PID_CONTROLLER in NOT_DEPLOYED:
        return None
    return await _call_contract_async(PID_CONTROLLER, PID_CONTROLLER_ABI, "getActive")


async def fetch_flashbuy_last_trigger() -> int:
    """Fetch FlashBuy last trigger timestamp."""
    return await _call_contract_async(FLASHBUY_V2, FLASHBUY_ABI, "getLastTriggerTime")


async def fetch_flashbuy_cooldown() -> int:
    """Fetch FlashBuy cooldown remaining in seconds."""
    return await _call_contract_async(FLASHBUY_V2, FLASHBUY_ABI, "getCooldownRemaining")


async def fetch_flashbuy_active() -> bool:
    """Fetch FlashBuy active status."""
    return await _call_contract_async(FLASHBUY_V2, FLASHBUY_ABI, "isActive")


async def fetch_avoracle_price() -> float:
    """Fetch Au price from AvOracle v5."""
    result = await _call_contract_async(AVORACLE_V5, AVORACLE_ABI, "getPrice", AU_TOKEN)
    if result and isinstance(result, tuple):
        return result[0] / 1e18
    return None


async def fetch_avoracle_twap() -> float:
    """Fetch Au TWAP from AvOracle v5."""
    result = await _call_contract_async(AVORACLE_V5, AVORACLE_ABI, "getTWAP", AU_TOKEN)
    if result is not None:
        return result / 1e18
    return None


async def fetch_governor_proposal_count() -> int:
    """Fetch total proposal count."""
    if GOVERNOR in NOT_DEPLOYED:
        return None
    return await _call_contract_async(GOVERNOR, GOVERNOR_ABI, "proposalCount")


async def fetch_governor_quorum() -> int:
    """Fetch quorum requirement."""
    if GOVERNOR in NOT_DEPLOYED:
        return None
    return await _call_contract_async(GOVERNOR, GOVERNOR_ABI, "quorum")


async def fetch_nft_positions(owner: str) -> list:
    """Fetch NFT positions for an owner."""
    w3 = _get_w3()
    if w3 is None:
        return []
    try:
        balance = await _call_contract_async(QUASICYSTAL_LP_NFT, QUASICYSTAL_ABI, "balanceOf", w3.to_checksum_address(owner))
        if not balance:
            return []
        positions = []
        for i in range(min(balance, 50)):  # Cap at 50
            token_id = await _call_contract_async(
                QUASICYSTAL_LP_NFT, QUASICYSTAL_ABI, "tokenOfOwnerByIndex",
                w3.to_checksum_address(owner), i
            )
            if token_id is not None:
                pos = await _call_contract_async(
                    QUASICYSTAL_LP_NFT, QUASICYSTAL_ABI, "getPosition", token_id
                )
                if pos and isinstance(pos, tuple):
                    positions.append({
                        "token_id": token_id,
                        "lp_amount": pos[0],
                        "lock_end": pos[1],
                        "multiplier": pos[2],
                        "pending_rewards": pos[3],
                    })
        return positions
    except Exception:
        return []


async def fetch_treasury_safe_txs(limit: int = 10) -> list:
    """Fetch recent Treasury Safe transactions."""
    url = f"{GNOSIS_SAFE_API}safes/{TREASURY_SAFE}/transactions/?limit={limit}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("results", [])
                return []
    except Exception:
        return []


# ─── Aggregated Data Fetchers ───────────────────────────────────────────────
async def fetch_dashboard_data() -> dict:
    """Fetch all dashboard data."""
    prices, block, gas = await asyncio.gather(
        fetch_all_prices(),
        fetch_block_height(),
        fetch_gas_price(),
        return_exceptions=True,
    )
    result = {
        "prices": prices if not isinstance(prices, Exception) else {},
        "block": block if not isinstance(block, Exception) else 0,
        "gas": gas if not isinstance(gas, Exception) else 0.0,
    }
    return result


async def fetch_onchain_data() -> dict:
    """Fetch on-chain data (3-second tick)."""
    tasks = {
        "au_supply": fetch_au_supply(),
        "ag_supply": fetch_ag_supply(),
        "au_holders": fetch_au_holders(),
        "reserve_ratio": fetch_reserve_ratio(),
        "nav_per_token": fetch_nav_per_token(),
        "total_reserve": fetch_total_reserve_value(),
        "pid_emission": fetch_pid_emission(),
        "pid_next_epoch": fetch_pid_next_epoch(),
        "pid_active": fetch_pid_active(),
        "flashbuy_last": fetch_flashbuy_last_trigger(),
        "flashbuy_cooldown": fetch_flashbuy_cooldown(),
        "flashbuy_active": fetch_flashbuy_active(),
        "avoracle_price": fetch_avoracle_price(),
        "avoracle_twap": fetch_avoracle_twap(),
    }
    keys = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    data = {}
    for key, val in zip(keys, results):
        if isinstance(val, Exception):
            data[key] = None
        else:
            data[key] = val
    return data


async def fetch_heavy_data() -> dict:
    """Fetch heavy data (12-second tick)."""
    tasks = {
        "proposal_count": fetch_governor_proposal_count(),
        "quorum": fetch_governor_quorum(),
        "safe_txs": fetch_treasury_safe_txs(10),
    }
    keys = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    data = {}
    for key, val in zip(keys, results):
        if isinstance(val, Exception):
            data[key] = None
        else:
            data[key] = val
    return data
