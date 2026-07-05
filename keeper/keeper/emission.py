"""
Emission Keeper — Executes PID emissions when epoch is due.

Flow:
1. Check getNextEpochTime() — is it <= block.timestamp?
2. Check getEmissionRate() — is it > 0?
3. Call executeEmission() on PID Controller
4. Log result with tx_hash and amount minted
"""

import asyncio
import time
from typing import Optional

from web3 import Web3

from .config import (
    RPC_URL, KEEPER_PRIVATE_KEY, CHAIN_ID,
    EMISSION_CHECK_INTERVAL, GAS_PRICE_MULTIPLIER, MAX_GAS_PRICE_GWEI,
    TX_CONFIRMATION_BLOCKS, PID_ABI, CONTRACTS,
)
from .logger import setup_logger, log_event

logger = setup_logger("keeper.emission")


class EmissionKeeper:
    """Monitors and executes PID emissions on Base Mainnet."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(KEEPER_PRIVATE_KEY)
        self.pid = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACTS["pid"]),
            abi=PID_ABI,
        )
        self.running = False
        self.last_emission_tx: Optional[str] = None
        self.last_emission_amount: int = 0
        self.last_emission_time: float = 0
        self.error_count: int = 0
        self.total_emissions_executed: int = 0

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

    def check_emission_due(self) -> tuple[bool, int]:
        """Check if an emission is due and what the rate is."""
        next_epoch = self.pid.functions.getNextEpochTime().call()
        current_time = self.w3.eth.get_block("latest")["timestamp"]
        emission_rate = self.pid.functions.getEmissionRate().call()

        is_due = (next_epoch <= current_time) and (emission_rate > 0)
        return is_due, emission_rate

    def execute_emission(self) -> Optional[str]:
        """Execute the emission. Returns tx_hash or None."""
        try:
            is_due, emission_rate = self.check_emission_due()
            if not is_due:
                logger.debug(f"Emission not due (rate={emission_rate})")
                return None

            logger.info(f"Executing emission (rate={emission_rate / 1e18:.4f} Ag)")

            tx = self.pid.functions.executeEmission().build_transaction(self._build_tx())
            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)

            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(
                tx_hash, timeout=30, poll_latency=1
            )

            if receipt["status"] == 1:
                self.last_emission_tx = tx_hash.hex()
                self.last_emission_amount = emission_rate
                self.last_emission_time = time.time()
                self.total_emissions_executed += 1
                self.error_count = 0

                log_event(
                    event_type="emission_executed",
                    data={
                        "amount_wei": emission_rate,
                        "amount_ag": emission_rate / 1e18,
                    },
                    tx_hash=tx_hash.hex(),
                    block_number=receipt["blockNumber"],
                )
                logger.info(
                    f"Emission executed: {emission_rate / 1e18:.4f} Ag "
                    f"(tx={tx_hash.hex()[:10]}... block={receipt['blockNumber']})"
                )
                return tx_hash.hex()
            else:
                self.error_count += 1
                log_event(
                    event_type="emission_failed",
                    data={"amount_wei": emission_rate},
                    tx_hash=tx_hash.hex(),
                    status="reverted",
                )
                logger.error(f"Emission reverted: tx={tx_hash.hex()[:10]}...")
                return None

        except Exception as e:
            self.error_count += 1
            log_event(
                event_type="emission_error",
                data={"error": str(e)},
                status="error",
                error=str(e),
            )
            logger.error(f"Emission error: {e}")
            return None

    async def run(self):
        """Main loop — check and execute emissions periodically."""
        self.running = True
        logger.info(f"Emission keeper started (address={self.keeper_address})")

        while self.running:
            try:
                self.execute_emission()
            except Exception as e:
                logger.error(f"Emission loop error: {e}")

            await asyncio.sleep(EMISSION_CHECK_INTERVAL)

    def stop(self):
        self.running = False
        logger.info("Emission keeper stopped")
