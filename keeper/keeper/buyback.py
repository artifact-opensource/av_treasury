"""
Buyback Keeper — Monitors Au price and triggers FlashBuy when below peg.

Flow:
1. Check canExecute() on FlashBuy
2. Check Au price vs NAV from Oracle
3. If NAV deviation > 2% AND canExecute → trigger executeBuyback()
4. Emergency: If TVL drops > 10% in 24h → trigger regardless
5. Log all actions
"""

import asyncio
import time
from typing import Optional

from web3 import Web3

from .config import (
    RPC_URL, KEEPER_PRIVATE_KEY, CHAIN_ID,
    BUYBACK_CHECK_INTERVAL, NAV_DEVIATION_THRESHOLD,
    TVL_DROP_THRESHOLD, MIN_RESERVE_RATIO,
    GAS_PRICE_MULTIPLIER, MAX_GAS_PRICE_GWEI,
    FLASHBUY_ABI, ORACLE_ABI, TREASURY_AMO_ABI, PID_ABI, CONTRACTS,
)
from .logger import setup_logger, log_event

logger = setup_logger("keeper.buyback")


class BuybackKeeper:
    """Monitors Au price and triggers FlashBuy when conditions are met."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(KEEPER_PRIVATE_KEY)
        self.flashbuy = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["flashbuy"]),
            abi=FLASHBUY_ABI,
        )
        self.oracle = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["oracle"]),
            abi=ORACLE_ABI,
        )
        self.treasury = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["treasury_amo"]),
            abi=TREASURY_AMO_ABI,
        )
        self.pid = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["pid"]),
            abi=PID_ABI,
        )
        self.running = False
        self.last_buyback_tx: Optional[str] = None
        self.last_buyback_time: float = 0
        self.error_count: int = 0
        self._warden_pause = False  # Warden pause gate
        self.total_buybacks_executed: int = 0
        self._tvl_24h_ago: Optional[int] = None
        self._last_tvl_check: float = 0

    @property
    def keeper_address(self) -> str:
        return self.account.address

    def _build_tx(self) -> dict:
        """Build a transaction dict with current gas params."""
        base_gas = self.w3.eth.gas_price
        gas_price = min(
            int(base_gas * GAS_PRICE_MULTIPLIER),
            MAX_GAS_PRICE_GWEI * 10**9,
        )
        return {
            "from": self.keeper_address,
            "gasPrice": gas_price,
            "chainId": CHAIN_ID,
            "nonce": self.w3.eth.get_transaction_count(self.keeper_address),
        }

    def check_buyback_conditions(self) -> tuple[bool, str]:
        """Check if buyback should execute. Returns (should_execute, reason)."""
        # 1. Can FlashBuy execute? (cooldown, daily cap)
        can_execute = self.flashbuy.functions.canExecute().call()
        if not can_execute:
            return False, "cooldown_or_cap"

        # 2. Get current Au price from oracle
        try:
            au_price = self.oracle.functions.getAuPrice().call()
        except Exception as e:
            logger.warning(f"Oracle read failed: {e}")
            return False, f"oracle_error: {e}"

        # 3. Get NAV from Treasury AMO
        try:
            nav = self.treasury.functions.getNAV().call()
        except Exception as e:
            logger.warning(f"Treasury NAV read failed: {e}")
            return False, f"nav_error: {e}"

        # 4. Check NAV deviation
        if nav > 0:
            deviation = abs(int(au_price) - int(nav)) / int(nav)
            if deviation >= NAV_DEVIATION_THRESHOLD:
                logger.info(
                    f"NAV deviation {deviation:.2%} >= {NAV_DEVIATION_THRESHOLD:.2%} "
                    f"(price={au_price / 1e18:.6f}, nav={nav / 1e18:.6f})"
                )
                return True, f"nav_deviation_{deviation:.4f}"

        # 5. Check reserve ratio
        try:
            reserve_ratio = self.treasury.functions.getReserveRatio().call()
            if reserve_ratio < MIN_RESERVE_RATIO * 10000:
                logger.warning(
                    f"Reserve ratio {reserve_ratio / 100:.1f}% < {MIN_RESERVE_RATIO * 100:.0f}%"
                )
                return True, f"low_reserve_{reserve_ratio}"
        except Exception:
            pass

        # 6. Emergency: TVL drop check
        current_tvl = self.pid.functions.getCurrentTVL().call()
        now = time.time()

        if self._tvl_24h_ago is not None:
            tvl_drop = (self._tvl_24h_ago - current_tvl) / self._tvl_24h_ago if self._tvl_24h_ago > 0 else 0
            if tvl_drop >= TVL_DROP_THRESHOLD:
                logger.warning(
                    f"TVL dropped {tvl_drop:.2%} in 24h — EMERGENCY BUYBACK"
                )
                return True, f"emergency_tvl_drop_{tvl_drop:.4f}"

        # Update TVL baseline every hour
        if (now - self._last_tvl_check) > 3600:
            self._tvl_24h_ago = current_tvl
            self._last_tvl_check = now

        return False, "no_trigger"

    def execute_buyback(self) -> Optional[str]:
        """Execute the buyback. Returns tx_hash or None."""
        try:
            should_execute, reason = self.check_buyback_conditions()
            if not should_execute:
                logger.debug(f"Buyback not triggered: {reason}")
                return None

            logger.info(f"Executing buyback (reason: {reason})")

            tx = self.flashbuy.functions.executeBuyback().build_transaction(self._build_tx())
            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)

            receipt = self.w3.eth.wait_for_transaction_receipt(
                tx_hash, timeout=30, poll_latency=1
            )

            if receipt["status"] == 1:
                self.last_buyback_tx = tx_hash.hex()
                self.last_buyback_time = time.time()
                self.total_buybacks_executed += 1
                self.error_count = 0

                log_event(
                    event_type="buyback_executed",
                    data={"reason": reason},
                    tx_hash=tx_hash.hex(),
                    block_number=receipt["blockNumber"],
                )
                logger.info(
                    f"Buyback executed (reason={reason}) "
                    f"(tx={tx_hash.hex()[:10]}... block={receipt['blockNumber']})"
                )
                return tx_hash.hex()
            else:
                self.error_count += 1
                log_event(
                    event_type="buyback_failed",
                    data={"reason": reason},
                    tx_hash=tx_hash.hex(),
                    status="reverted",
                )
                logger.error(f"Buyback reverted: tx={tx_hash.hex()[:10]}...")
                return None

        except Exception as e:
            self.error_count += 1
            log_event(
                event_type="buyback_error",
                data={"error": str(e)},
                status="error",
                error=str(e),
            )
            logger.error(f"Buyback error: {e}")
            return None

    async def run(self):
        """Main loop — check and execute buybacks periodically."""
        self.running = True
        logger.info(f"Buyback keeper started (address={self.keeper_address})")

        while self.running:
            # Warden pause gate — halt on threat
            if self._warden_pause:
                logger.warning("Buyback paused by Warden — threat detected")
                await asyncio.sleep(30)
                continue

            try:
                self.execute_buyback()
            except Exception as e:
                logger.error(f"Buyback loop error: {e}")

            await asyncio.sleep(BUYBACK_CHECK_INTERVAL)

    def set_pause(self, paused: bool):
        """Warden can pause/unpause buyback execution."""
        self._warden_pause = paused
        logger.info(f"Buyback pause set to {paused}")

    def stop(self):
        self.running = False
        logger.info("Buyback keeper stopped")
