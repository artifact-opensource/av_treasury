"""
Oracle Keeper — Keeps the AvOracle price feed updated.

Flow:
1. Check isStale() on AvOracle
2. If stale → call updatePrice()
3. Also monitors TWAP health
"""

import asyncio
import time
from typing import Optional

from web3 import Web3

from .config import (
    RPC_URL, KEEPER_PRIVATE_KEY, CHAIN_ID,
    ORACLE_UPDATE_INTERVAL, GAS_PRICE_MULTIPLIER, MAX_GAS_PRICE_GWEI,
    ORACLE_ABI, CONTRACTS,
)
from .logger import setup_logger, log_event

logger = setup_logger("keeper.oracle")


class OracleKeeper:
    """Keeps the AvOracle price feed fresh."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(KEEPER_PRIVATE_KEY)
        self.oracle = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["oracle"]),
            abi=ORACLE_ABI,
        )
        self.running = False
        self.last_update_tx: Optional[str] = None
        self.last_update_time: float = 0
        self.error_count: int = 0
        self.total_updates: int = 0

    @property
    def keeper_address(self) -> str:
        return self.account.address

    def _build_tx(self) -> dict:
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

    def check_and_update(self) -> Optional[str]:
        """Check if oracle is stale and update if needed."""
        try:
            is_stale = self.oracle.functions.isStale().call()
            if not is_stale:
                logger.debug("Oracle is fresh, skipping update")
                return None

            logger.info("Oracle is stale — updating price")

            tx = self.oracle.functions.updatePrice().build_transaction(self._build_tx())
            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)

            receipt = self.w3.eth.wait_for_transaction_receipt(
                tx_hash, timeout=30, poll_latency=1
            )

            if receipt["status"] == 1:
                self.last_update_tx = tx_hash.hex()
                self.last_update_time = time.time()
                self.total_updates += 1
                self.error_count = 0

                log_event(
                    event_type="oracle_updated",
                    data={},
                    tx_hash=tx_hash.hex(),
                    block_number=receipt["blockNumber"],
                )
                logger.info(f"Oracle updated (tx={tx_hash.hex()[:10]}...)")
                return tx_hash.hex()
            else:
                self.error_count += 1
                log_event(
                    event_type="oracle_update_failed",
                    data={},
                    tx_hash=tx_hash.hex(),
                    status="reverted",
                )
                return None

        except Exception as e:
            self.error_count += 1
            log_event(
                event_type="oracle_error",
                data={"error": str(e)},
                status="error",
                error=str(e),
            )
            logger.error(f"Oracle update error: {e}")
            return None

    def get_latest_data(self) -> dict:
        """Return latest price data for Warden/Strategy consumption."""
        data: dict = {"price": 0.0, "twap_price": 0.0, "timestamp": 0.0}
        try:
            price = self.oracle.functions.getAuPrice().call()
            data["price"] = float(price) / 1e18
            data["timestamp"] = time.time()
        except Exception as e:
            logger.debug(f"get_latest_data read failed: {e}")
        return data

    async def run(self):
        """Main loop — update oracle periodically."""
        self.running = True
        logger.info(f"Oracle keeper started (address={self.keeper_address})")

        while self.running:
            try:
                self.check_and_update()
            except Exception as e:
                logger.error(f"Oracle loop error: {e}")

            await asyncio.sleep(ORACLE_UPDATE_INTERVAL)

    def stop(self):
        self.running = False
        logger.info("Oracle keeper stopped")
