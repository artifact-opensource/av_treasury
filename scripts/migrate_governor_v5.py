#!/usr/bin/env python3
"""
AV Treasury — Governor V5 Migration Script
===========================================
Deploys new Governor V5 + new ArtifactTimelock, then generates
the migration transactions to transfer all roles from old → new.

Migration Plan:
1. Deploy new ArtifactTimelock (48h delay)
2. Deploy new GovernorContractV5 (connected to new timelock)
3. Generate calldata to:
   a. Old Governor: propose transferring timelock admin to new timelock
   b. Old Timelock: schedule admin transfer
   c. Treasury Safe: update governor reference

Usage:
    python3 scripts/migrate_governor_v5.py --dry-run
    python3 scripts/migrate_governor_v5.py --execute
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from decimal import Decimal

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from keeper.chain import ChainClient, CHAIN_CONFIG
from keeper.logger import get_logger

log = get_logger("migrate_governor")

# ─── Current Live Addresses ───────────────────────────────────────────
OLD_GOVERNOR = "0x259c1C23488Ce8e4d8C2b1b5f8D2c1e0e5B5F3A4"  # placeholder — read from ADDRESS_BOOK
OLD_TIMELOCK = "0x8d6864E38847B1e3E34e04749A2De5A7cD3F3C3B"  # placeholder

# ─── Constructor Parameters ───────────────────────────────────────────
VOTING_DELAY_BLOCKS = 1  # ~2 seconds on Base
VOTING_PERIOD_BLOCKS = 15960  # ~8.8 hours at 2s blocks
QUORUM_NUMERATOR = 4  # 4%
PROPOSER_THRESHOLD = 1  # 1 token
EXECUTOR_THRESHOLD = 1  # 1 token
TIMELOCK_DELAY = 172800  # 48 hours in seconds


def load_addresses():
    """Load current addresses from ADDRESS_BOOK.md."""
    book_path = Path(__file__).parent.parent / "docs" / "ADDRESS_BOOK.md"
    addresses = {}
    if book_path.exists():
        content = book_path.read_text()
        for line in content.split("\n"):
            if "0x" in line and "|" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 3:
                    name = parts[1]
                    addr = parts[2].strip("`")
                    if addr.startswith("0x") and len(addr) == 42:
                        addresses[name] = addr
    return addresses


def deploy_timelock(chain: ChainClient, admin: str) -> str:
    """Deploy new ArtifactTimelock with 48h delay."""
    log.info("Deploying new ArtifactTimelock...")

    # Constructor: (uint256 minDelay, address[] proposers, address[] executors, address admin, address canceler)
    min_delay = TIMELOCK_DELAY
    proposers = []  # Will add governor after it's deployed
    executors = []  # Will add governor + safe
    canceler = admin  # Treasury Safe as emergency canceler

    # For now, admin = deployer (will transfer to new governor later)
    # We'll use the deployer as initial admin, then propose transfer
    deployer = chain.account.address

    bytecode = chain.get_bytecode("ArtifactTimelock")
    if not bytecode:
        log.error("ArtifactTimelock bytecode not found. Run hardhat compile first.")
        return ""

    tx_hash = chain.deploy(
        bytecode=bytecode,
        constructor_args=[min_delay, proposers, executors, deployer, canceler],
    )

    if tx_hash:
        receipt = chain.wait_for_receipt(tx_hash)
        if receipt and receipt.get("contractAddress"):
            addr = receipt["contractAddress"]
            log.info(f"✅ New Timelock deployed: {addr}")
            return addr

    log.error("Timelock deployment failed")
    return ""


def deploy_governor_v5(chain: ChainClient, timelock: str) -> str:
    """Deploy new GovernorContractV5."""
    log.info("Deploying new GovernorContractV5...")

    # Constructor from GovernorContractV5.sol
    # (IVotes _token, TimelockController _timelock, string _name, uint48 _votingDelay, uint32 _votingPeriod, uint256 _quorumNumerator, uint256 _proposalThreshold, uint256 _executorThreshold)
    token_addr = os.environ.get("AU_TOKEN_ADDRESS", "")
    if not token_addr:
        log.error("AU_TOKEN_ADDRESS not set in .env")
        return ""

    bytecode = chain.get_bytecode("GovernorContractV5")
    if not bytecode:
        log.error("GovernorContractV5 bytecode not found. Run hardhat compile first.")
        return ""

    tx_hash = chain.deploy(
        bytecode=bytecode,
        constructor_args=[
            token_addr,
            timelock,
            "AV Treasury Governor V5",
            VOTING_DELAY_BLOCKS,
            VOTING_PERIOD_BLOCKS,
            QUORUM_NUMERATOR,
            PROPOSER_THRESHOLD,
            EXECUTOR_THRESHOLD,
        ],
    )

    if tx_hash:
        receipt = chain.wait_for_receipt(tx_hash)
        if receipt and receipt.get("contractAddress"):
            addr = receipt["contractAddress"]
            log.info(f"✅ New Governor V5 deployed: {addr}")
            return addr

    log.error("Governor V5 deployment failed")
    return ""


def generate_migration_calldata(
    old_governor: str,
    old_timelock: str,
    new_governor: str,
    new_timelock: str,
    treasury_safe: str,
) -> list[dict]:
    """
    Generate the migration transaction calldata.
    
    Steps:
    1. New Timelock: grant PROPOSER role to new Governor
    2. New Timelock: grant EXECUTOR role to new Governor + Treasury Safe
    3. New Timelock: renounce deployer admin (make it governance-controlled)
    4. Old Governor: propose migrating all admin roles to new Timelock
    5. Treasury Safe: accept new Governor as admin
    """
    migrations = []

    # Step 1: Grant PROPOSER role to new Governor on new Timelock
    migrations.append({
        "step": 1,
        "description": "Grant PROPOSER role to new Governor on new Timelock",
        "to": new_timelock,
        "method": "grantRole",
        "args": ["PROPOSER_ROLE", new_governor],
        "executor": "deployer",  # deployer is initial admin
    })

    # Step 2: Grant EXECUTOR role to new Governor + Treasury Safe
    migrations.append({
        "step": 2,
        "description": "Grant EXECUTOR role to new Governor on new Timelock",
        "to": new_timelock,
        "method": "grantRole",
        "args": ["EXECUTOR_ROLE", new_governor],
        "executor": "deployer",
    })

    migrations.append({
        "step": 3,
        "description": "Grant EXECUTOR role to Treasury Safe on new Timelock",
        "to": new_timelock,
        "method": "grantRole",
        "args": ["EXECUTOR_ROLE", treasury_safe],
        "executor": "deployer",
    })

    # Step 4: Grant CANCELER role to Treasury Safe (emergency)
    migrations.append({
        "step": 4,
        "description": "Grant CANCELER role to Treasury Safe on new Timelock",
        "to": new_timelock,
        "method": "grantRole",
        "args": ["CANCELER_ROLE", treasury_safe],
        "executor": "deployer",
    })

    # Step 5: Transfer old timelock admin to new timelock (via old governor proposal)
    # This is the critical migration step — old governor proposes to make new timelock the admin
    migrations.append({
        "step": 5,
        "description": "Old Governor: propose transferring all admin roles to new Timelock",
        "to": old_governor,
        "method": "propose",
        "args": {
            "targets": [old_timelock],
            "values": [0],
            "calldatas": ["setAdmin(address)"],
            "description": "Migrate governance to Governor V5 + new Timelock",
        },
        "executor": "governance",  # requires proposal + voting
    })

    # Step 6: Renounce deployer admin on new timelock
    migrations.append({
        "step": 6,
        "description": "Renounce deployer admin on new timelock (full decentralization)",
        "to": new_timelock,
        "method": "renounceRole",
        "args": ["DEFAULT_ADMIN_ROLE", "deployer_address"],
        "executor": "deployer",
    })

    return migrations


def run_dry_run(addresses: dict):
    """Print migration plan without executing."""
    log.info("=" * 60)
    log.info("GOVERNOR V5 MIGRATION — DRY RUN")
    log.info("=" * 60)

    old_governor = addresses.get("Governor", OLD_GOVERNOR)
    old_timelock = addresses.get("ArtifactTimelock", OLD_TIMELOCK)
    treasury_safe = addresses.get("Treasury Safe", "")

    log.info(f"Old Governor:  {old_governor}")
    log.info(f"Old Timelock:  {old_timelock}")
    log.info(f"Treasury Safe: {treasury_safe}")
    log.info("")

    log.info("Migration Steps:")
    log.info("1. Deploy new ArtifactTimelock (48h delay)")
    log.info("2. Deploy new GovernorContractV5")
    log.info("3. Grant PROPOSER role → new Governor")
    log.info("4. Grant EXECUTOR role → new Governor + Treasury Safe")
    log.info("5. Grant CANCELER role → Treasury Safe")
    log.info("6. Old Governor: propose admin transfer to new Timelock")
    log.info("7. Renounce deployer admin on new timelock")
    log.info("")
    log.info("⚠️  Step 6 requires a full governance proposal + voting period + timelock delay")
    log.info("⚠️  Until step 6 completes, old Governor remains active")
    log.info("")

    # Generate calldata
    migrations = generate_migration_calldata(
        old_governor, old_timelock,
        "NEW_GOVERNOR_ADDRESS", "NEW_TIMELOCK_ADDRESS",
        treasury_safe,
    )

    for m in migrations:
        log.info(f"  Step {m['step']}: {m['description']}")
        log.info(f"    To: {m['to']}")
        log.info(f"    Method: {m['method']}")
        log.info(f"    Executor: {m['executor']}")
        log.info("")

    log.info("✅ Dry run complete. No transactions sent.")


def run_execute(addresses: dict):
    """Execute the migration."""
    chain = ChainClient()
    if not chain.connect():
        log.error("Failed to connect to Base network")
        return

    treasury_safe = addresses.get("Treasury Safe", "")
    if not treasury_safe:
        log.error("Treasury Safe address not found")
        return

    # Step 1: Deploy new Timelock
    new_timelock = deploy_timelock(chain, treasury_safe)
    if not new_timelock:
        return

    # Step 2: Deploy new Governor V5
    new_governor = deploy_governor_v5(chain, new_timelock)
    if not new_governor:
        return

    # Step 3-4: Configure roles
    log.info("Configuring roles on new Timelock...")

    # Grant PROPOSER to new Governor
    chain.send_transaction(
        to=new_timelock,
        data=chain.encode_function("grantRole", ["bytes32", "address"], [
            chain.keccak("PROPOSER_ROLE"), new_governor
        ]),
    )

    # Grant EXECUTOR to new Governor
    chain.send_transaction(
        to=new_timelock,
        data=chain.encode_function("grantRole", ["bytes32", "address"], [
            chain.keccak("EXECUTOR_ROLE"), new_governor
        ]),
    )

    # Grant EXECUTOR to Treasury Safe
    chain.send_transaction(
        to=new_timelock,
        data=chain.encode_function("grantRole", ["bytes32", "address"], [
            chain.keccak("EXECUTOR_ROLE"), treasury_safe
        ]),
    )

    # Grant CANCELER to Treasury Safe
    chain.send_transaction(
        to=new_timelock,
        data=chain.encode_function("grantRole", ["bytes32", "address"], [
            chain.keccak("CANCELER_ROLE"), treasury_safe
        ]),
    )

    log.info("=" * 60)
    log.info("MIGRATION PHASE 1 COMPLETE")
    log.info("=" * 60)
    log.info(f"New Timelock:  {new_timelock}")
    log.info(f"New Governor:  {new_governor}")
    log.info("")
    log.info("NEXT: Create governance proposal on OLD governor to:")
    log.info(f"  - Transfer admin roles from old timelock to new timelock")
    log.info(f"  - Update contract references to new Governor")
    log.info("")
    log.info("Then: Renounce deployer admin on new timelock")


def main():
    parser = argparse.ArgumentParser(description="AV Treasury Governor V5 Migration")
    parser.add_argument("--dry-run", action="store_true", help="Print migration plan")
    parser.add_argument("--execute", action="store_true", help="Execute migration")
    args = parser.parse_args()

    addresses = load_addresses()

    if args.execute:
        run_execute(addresses)
    else:
        run_dry_run(addresses)


if __name__ == "__main__":
    main()
