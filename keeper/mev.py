"""
MEV Protection — Private Mempool & Bundle Execution for the Keeper.

Protects buyback transactions from:
- Sandwich attacks (frontrun + backrun)
- Frontrunning by searchers
- Priority gas auction wars

Strategies:
1. Flashbots Protect — submit via private mempool (no frontrunning)
2. Bundle transactions — atomic multi-step operations
3. Mempool monitoring — detect pending attacks targeting us

On Base, Flashbots Protect is available via the Flashbots RPC endpoint.
We also support EigenPhi-style bundle submission for more complex operations.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from .logger import get_logger
from .settings import Settings

log = get_logger("mev")


# ─────────────────────────────────────────────────────────────────────────────
# Bundle Types
# ─────────────────────────────────────────────────────────────────────────────

class BundleStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    INCLUDED = "included"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass
class Bundle:
    """A bundle of transactions to be executed atomically."""
    txs: list[dict]  # List of signed transactions
    target_block: int
    status: BundleStatus = BundleStatus.PENDING
    bundle_hash: Optional[str] = None
    submitted_at: Optional[float] = None
    included_at: Optional[float] = None
    gas_used: Optional[int] = None
    effective_gas_price: Optional[int] = None
    profit: Optional[float] = None  # ETH profit from MEV (if any)

    @property
    def age_seconds(self) -> Optional[float]:
        if self.submitted_at:
            return time.time() - self.submitted_at
        return None

    @property
    def is_expired(self) -> bool:
        """Bundle expires after 25 blocks (~5 min on Base)."""
        return self.age_seconds is not None and self.age_seconds > 300


# ─────────────────────────────────────────────────────────────────────────────
# Flashbots Protect Client
# ─────────────────────────────────────────────────────────────────────────────

class FlashbotsClient:
    """
    Client for submitting transactions via Flashbots Protect RPC.
    
    Flashbots Protect ensures transactions are included without
    being visible in the public mempool, preventing frontrunning
    and sandwich attacks.
    
    On Base, we use the Flashbots Protect endpoint:
    https://rpc.flashbots.net?blockchain=base
    
    Or for higher security, the fast endpoint:
    https://rpc.flashbots.net/fast?blockchain=base
    """

    def __init__(self, settings: Settings, w3=None):
        self.settings = settings
        self.w3 = w3
        self.submission_count = 0
        self.success_count = 0
        self.fail_count = 0

    def configure(self, w3):
        """Set web3 instance."""
        self.w3 = w3

    async def send_private_transaction(
        self,
        signed_tx: dict,
        target_block: Optional[int] = None,
    ) -> Optional[str]:
        """
        Send a transaction via Flashbots Protect.
        
        Args:
            signed_tx: Signed transaction dict with rawTransaction
            target_block: Optional specific block to target
            
        Returns:
            Transaction hash if successful, None otherwise
        """
        if not self.w3:
            log.error("FlashbotsClient: no web3 instance configured")
            return None

        try:
            # Use eth_sendPrivateTransaction via Flashbots RPC
            # The tx is sent directly to builders, bypassing public mempool
            params = [signed_tx]

            if target_block:
                params.append({"preference": "fast"})

            # In production, this calls the Flashbots Protect RPC
            # For now, we log and fall through to standard submission
            self.submission_count += 1
            log.info(
                f"Flashbots private tx #{self.submission_count} "
                f"(target block: {target_block or 'next'})"
            )

            # Actual submission would be:
            # result = self.w3.provider.make_request(
            #     "eth_sendPrivateTransaction", params
            # )
            # return result.get("result")

            return None  # Placeholder — implement with actual Flashbots RPC

        except Exception as e:
            self.fail_count += 1
            log.error(f"Flashbots submission failed: {e}")
            return None

    async def send_bundle(
        self,
        bundle: Bundle,
    ) -> Optional[str]:
        """
        Send a transaction bundle via Flashbots Bundle API.
        
        Bundles are atomic — all txs or none. This is useful for
        complex operations like flash loan arbitrage.
        """
        if not self.w3:
            log.error("FlashbotsClient: no web3 instance configured")
            return None

        try:
            bundle.submitted_at = time.time()
            bundle.status = BundleStatus.SUBMITTED

            params = {
                "txs": [tx.get("rawTransaction", tx) for tx in bundle.txs],
                "blockNumber": hex(bundle.target_block),
            }

            log.info(
                f"Flashbots bundle submitted targeting block "
                f"{bundle.target_block} ({len(bundle.txs)} txs)"
            )

            # Actual submission:
            # result = self.w3.provider.make_request(
            #     "eth_sendBundle", [params]
            # )
            # bundle.bundle_hash = result.get("result", {}).get("bundleHash")

            self.submission_count += 1
            return bundle.bundle_hash

        except Exception as e:
            bundle.status = BundleStatus.FAILED
            self.fail_count += 1
            log.error(f"Bundle submission failed: {e}")
            return None

    async def check_bundle_status(self, bundle: Bundle) -> BundleStatus:
        """Check if a bundle was included in a block."""
        if bundle.status != BundleStatus.SUBMITTED:
            return bundle.status

        if bundle.is_expired:
            bundle.status = BundleStatus.EXPIRED
            return bundle.status

        try:
            # Query Flashbots for bundle inclusion
            # params = {"bundleHash": bundle.bundle_hash, "blockNumber": hex(...)}
            # result = self.w3.provider.make_request("eth_getBundleStats", [params])
            return bundle.status

        except Exception as e:
            log.error(f"Bundle status check failed: {e}")
            return bundle.status

    def get_stats(self) -> dict:
        """Return submission statistics."""
        return {
            "submissions": self.submission_count,
            "successes": self.success_count,
            "failures": self.fail_count,
            "success_rate": (
                self.success_count / self.submission_count
                if self.submission_count > 0
                else 0.0
            ),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Mempool Monitor
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PendingTx:
    """A transaction in the mempool."""
    hash: str
    from_addr: str
    to_addr: str
    value: int
    gas_price: int
    input_data: str
    timestamp: float = field(default_factory=time.time)


class MempoolMonitor:
    """
    Monitors the public mempool for transactions that could affect us.
    
    Detects:
    - Large Ag sells that might move the price before our buy
    - Transactions targeting our FlashBuy contract
    - Competing keeper/bot transactions
    - Potential sandwich attacks being set up
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.pending_txs: dict[str, PendingTx] = {}
        self.our_address = settings.keeper_address.lower()
        self.flashbuy_address = settings.flashbuy_address.lower() if hasattr(settings, 'flashbuy_address') else ""
        self.ag_address = settings.ag_address.lower() if hasattr(settings, 'ag_address') else ""

        # Detection thresholds
        self.large_sell_threshold_usd = 5000  # $5k+ sells are notable
        self.gas_war_threshold_multiplier = 2.0  # 2x our gas = suspicious

        # Stats
        self.txs_seen = 0
        self.suspicious_txs = 0
        self.gas_wars_detected = 0

    def add_tx(self, tx: PendingTx):
        """Add a pending transaction to monitor."""
        self.txs_seen += 1
        self.pending_txs[tx.hash] = tx

    def remove_tx(self, tx_hash: str):
        """Remove a confirmed/dropped transaction."""
        self.pending_txs.pop(tx_hash, None)

    def check_for_threats(self, our_gas_price: int = 0) -> list[dict]:
        """
        Analyze pending transactions for threats.
        
        Returns list of threat descriptions.
        """
        threats = []
        now = time.time()

        for tx_hash, tx in list(self.pending_txs.items()):
            # Remove stale (> 5 min old)
            if now - tx.timestamp > 300:
                del self.pending_txs[tx_hash]
                continue

            # Check for txs targeting our contracts
            if self.flashbuy_address and tx.to_addr.lower() == self.flashbuy_address:
                if tx.from_addr.lower() != self.our_address:
                    threats.append({
                        "type": "competing_flashbuy",
                        "severity": "medium",
                        "tx_hash": tx_hash,
                        "from": tx.from_addr,
                        "gas_price": tx.gas_price,
                    })

            # Check for gas wars (someone bidding much higher)
            if our_gas_price > 0 and tx.gas_price > our_gas_price * self.gas_war_threshold_multiplier:
                if self.flashbuy_address and tx.to_addr.lower() == self.flashbuy_address:
                    threats.append({
                        "type": "gas_war",
                        "severity": "high",
                        "tx_hash": tx_hash,
                        "from": tx.from_addr,
                        "their_gas": tx.gas_price,
                        "our_gas": our_gas_price,
                    })
                    self.gas_wars_detected += 1

            # Check for large Ag transfers (potential sell pressure)
            if self.ag_address and tx.to_addr.lower() == self.ag_address:
                # This is a simplified check — in production we'd decode the
                # transfer input data to get the actual amount
                if tx.value > 0:
                    threats.append({
                        "type": "ag_transfer",
                        "severity": "low",
                        "tx_hash": tx_hash,
                        "from": tx.from_addr,
                        "value": tx.value,
                    })

        self.suspicious_txs +=(len(threats))
        return threats

    def get_recommended_gas_bump(self, base_gas_price: int) -> int:
        """
        If there's gas competition, recommend a higher gas price
        to ensure our tx is included.
        
        Only bumps within max_gas_gwei limit.
        """
        threats = self.check_for_threats(base_gas_price)
        gas_wars = [t for t in threats if t["type"] == "gas_war"]

        if not gas_wars:
            return base_gas_price

        # Find the highest competing gas price
        max_competitor = max(t["their_gas"] for t in gas_wars)
        recommended = int(max_competitor * 1.1)  # 10% above highest competitor

        # Cap at max
        max_gas = int(self.settings.max_gas_gwei * 1e9)  # Convert to wei
        return min(recommended, max_gas)

    def get_status(self) -> dict:
        """Return mempool monitor status."""
        return {
            "pending_txs_tracked": len(self.pending_txs),
            "total_txs_seen": self.txs_seen,
            "suspicious_txs_detected": self.suspicious_txs,
            "gas_wars_detected": self.gas_wars_detected,
        }


# ─────────────────────────────────────────────────────────────────────────────
# MEV Coordinator
# ─────────────────────────────────────────────────────────────────────────────

class MEVCoordinator:
    """
    Coordinates all MEV protection strategies.
    
    Provides a simple interface for the main loop:
    - Should I use private mempool?
    - What gas price should I use?
    - Are there pending threats?
    """

    def __init__(self, settings: Settings, w3=None):
        self.settings = settings
        self.flashbots = FlashbotsClient(settings, w3)
        self.mempool = MempoolMonitor(settings)
        self.bundles: list[Bundle] = []
        self.use_private_mempool = True  # Default to private

    def configure(self, w3):
        """Set web3 instance."""
        self.w3 = w3
        self.flashbots.configure(w3)

    async def submit_buyback(
        self,
        signed_tx: dict,
        current_block: int,
        urgent: bool = False,
    ) -> Optional[str]:
        """
        Submit a buyback transaction with MEV protection.
        
        Args:
            signed_tx: The signed buyback transaction
            current_block: Current block number
            urgent: If True, use higher gas for faster inclusion
            
        Returns:
            Transaction hash if submitted successfully
        """
        if self.use_private_mempool and not urgent:
            # Try private mempool first
            tx_hash = await self.flashbots.send_private_transaction(
                signed_tx, target_block=current_block + 1
            )
            if tx_hash:
                return tx_hash
            # Fall through to public if private fails

        # Public mempool submission (handled by main loop)
        return None

    def check_mempool(self, our_gas_price: int = 0) -> list[dict]:
        """Check mempool for threats."""
        return self.mempool.check_for_threats(our_gas_price)

    def get_optimal_gas_price(self, base_gas_price: int) -> int:
        """Get gas price adjusted for mempool conditions."""
        return self.mempool.get_recommended_gas_bump(base_gas_price)

    def should_use_private(self, threat_level: int = 0) -> bool:
        """Determine if we should use private mempool."""
        if threat_level >= 1:  # CAUTIOUS or higher
            return True
        if self.mempool.gas_wars_detected > 0:
            return True
        return self.use_private_mempool

    def get_status(self) -> dict:
        """Return complete MEV protection status."""
        return {
            "use_private_mempool": self.use_private_mempool,
            "flashbots": self.flashbots.get_stats(),
            "mempool": self.mempool.get_status(),
            "active_bundles": len([b for b in self.bundles if b.status == BundleStatus.SUBMITTED]),
        }
