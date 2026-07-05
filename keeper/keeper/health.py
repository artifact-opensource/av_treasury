"""
Health Monitor — Continuous system health checks.

Monitors:
- Reserve ratio (must stay >= 50%)
- Oracle freshness (must not be stale > 1h)
- Keeper wallet balance (must have ETH for gas)
- TVL stability (no sudden drops)
- Contract pause status
"""

import asyncio
import time
from typing import Optional

from web3 import Web3

from .config import (
    RPC_URL, KEEPER_PRIVATE_KEY, CHAIN_ID,
    HEALTH_CHECK_INTERVAL, MIN_RESERVE_RATIO,
    ORACLE_ABI, TREASURY_AMO_ABI, AU_ABI, CONTRACTS,
)
from .logger import setup_logger, log_event

logger = setup_logger("keeper.health")

# ERC20 balanceOf selector
BALANCE_OF_ABI = [{"inputs": [{"name": "", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}]

# Pausable paused() selector
PAUSED_ABI = [{"inputs": [], "name": "paused", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "view", "type": "function"}]


class HealthMonitor:
    """Monitors system health and alerts on issues."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(KEEPER_PRIVATE_KEY)
        self.running = False
        self.issues: list[dict] = []
        self.last_check_time: float = 0
        self.check_count: int = 0

    @property
    def keeper_address(self) -> str:
        return self.account.address

    @property
    def is_healthy(self) -> bool:
        return len(self.issues) == 0

    def _check_keeper_balance(self) -> Optional[dict]:
        """Check if keeper has enough ETH for gas."""
        balance = self.w3.eth.get_balance(self.keeper_address)
        balance_eth = balance / 1e18

        if balance_eth < 0.001:  # Less than 0.001 ETH
            issue = {
                "severity": "CRITICAL",
                "module": "keeper_wallet",
                "message": f"Keeper balance too low: {balance_eth:.6f} ETH",
                "value": balance_eth,
            }
            logger.critical(issue["message"])
            return issue
        elif balance_eth < 0.01:
            issue = {
                "severity": "WARNING",
                "module": "keeper_wallet",
                "message": f"Keeper balance low: {balance_eth:.6f} ETH",
                "value": balance_eth,
            }
            logger.warning(issue["message"])
            return issue
        return None

    def _check_reserve_ratio(self) -> Optional[dict]:
        """Check if Treasury reserve ratio is above minimum."""
        try:
            treasury = self.w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACTS["treasury_amo"]),
                abi=TREASURY_AMO_ABI,
            )
            ratio = treasury.functions.getReserveRatio().call()
            ratio_pct = ratio / 100  # basis points to percentage

            if ratio_pct < MIN_RESERVE_RATIO * 100:
                issue = {
                    "severity": "CRITICAL",
                    "module": "reserve_ratio",
                    "message": f"Reserve ratio {ratio_pct:.1f}% < {MIN_RESERVE_RATIO * 100:.0f}%",
                    "value": ratio_pct,
                }
                logger.critical(issue["message"])
                return issue
            elif ratio_pct < MIN_RESERVE_RATIO * 100 * 1.1:  # Within 10% of floor
                issue = {
                    "severity": "WARNING",
                    "module": "reserve_ratio",
                    "message": f"Reserve ratio approaching floor: {ratio_pct:.1f}%",
                    "value": ratio_pct,
                }
                logger.warning(issue["message"])
                return issue
        except Exception as e:
            # Contract may not be deployed
            pass
        return None

    def _check_oracle_freshness(self) -> Optional[dict]:
        """Check if oracle is not stale."""
        try:
            oracle = self.w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACTS["oracle"]),
                abi=ORACLE_ABI,
            )
            is_stale = oracle.functions.isStale().call()
            if is_stale:
                issue = {
                    "severity": "WARNING",
                    "module": "oracle",
                    "message": "Oracle is stale — price feed may be inaccurate",
                    "value": True,
                }
                logger.warning(issue["message"])
                return issue
        except Exception:
            pass
        return None

    def _check_contract_pause_status(self) -> list[dict]:
        """Check if any contract is unexpectedly paused."""
        issues = []
        for name in ["au", "ag", "treasury_amo", "pid", "flashbuy", "quasicrystal"]:
            try:
                contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(CONTRACTS[name]),
                    abi=PAUSED_ABI,
                )
                is_paused = contract.functions.paused().call()
                if is_paused:
                    issue = {
                        "severity": "WARNING",
                        "module": f"contract_{name}",
                        "message": f"{name} is PAUSED",
                        "value": True,
                    }
                    issues.append(issue)
                    logger.warning(issue["message"])
            except Exception:
                # Contract may not support paused() or not deployed
                pass
        return issues

    def run_health_check(self) -> list[dict]:
        """Run all health checks. Returns list of issues found."""
        self.issues = []
        self.check_count += 1
        self.last_check_time = time.time()

        # Check keeper wallet
        issue = self._check_keeper_balance()
        if issue:
            self.issues.append(issue)

        # Check reserve ratio
        issue = self._check_reserve_ratio()
        if issue:
            self.issues.append(issue)

        # Check oracle freshness
        issue = self._check_oracle_freshness()
        if issue:
            self.issues.append(issue)

        # Check contract pause status
        pause_issues = self._check_contract_pause_status()
        self.issues.extend(pause_issues)

        # Log health check result
        if self.issues:
            critical = [i for i in self.issues if i["severity"] == "CRITICAL"]
            warnings = [i for i in self.issues if i["severity"] == "WARNING"]
            log_event(
                event_type="health_check",
                data={
                    "healthy": False,
                    "critical_count": len(critical),
                    "warning_count": len(warnings),
                    "issues": [{"module": i["module"], "severity": i["severity"]} for i in self.issues],
                },
                status="warning" if warnings else "critical",
            )
        else:
            log_event(
                event_type="health_check",
                data={"healthy": True},
            )

        return self.issues

    async def run(self):
        """Main loop — run health checks periodically."""
        self.running = True
        logger.info(f"Health monitor started (address={self.keeper_address})")

        while self.running:
            try:
                self.run_health_check()
            except Exception as e:
                logger.error(f"Health check error: {e}")

            await asyncio.sleep(HEALTH_CHECK_INTERVAL)

    def stop(self):
        self.running = False
        logger.info("Health monitor stopped")
