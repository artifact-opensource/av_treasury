"""
AV Treasury — Phase 4 Deployment Script
========================================
Deploys new contracts and configures governance on Base Mainnet.

Contracts to deploy:
  1. OracleWrapper (bridges AvOracle → TreasuryAMO/FlashBuy)
  2. OracleFlashBuy (oracle-triggered buyback)
  3. OracleGuardian (oracle health monitoring + auto-recovery)
  4. GovernorContract (new, with TimelockControl)
  5. ArtifactTimelock (new, 48h minimum delay)

Post-deployment:
  - Transfer admin roles to Governor/Timelock
  - Configure OracleWrapper thresholds
  - Grant keeper roles
  - Verify on Basescan

Usage:
    python scripts/deploy_phase4.py --dry-run    # Simulate only
    python scripts/deploy_phase4.py --execute    # Actually deploy
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path
from typing import Optional

from web3 import Web3
from eth_account import Account

# ── Paths ─────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
OUT_DIR = ROOT / "out"

# ── Load .env ─────────────────────────────────────────────────
def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip("'\"")
    return env

# ── Contract Addresses ────────────────────────────────────────
ADDRESSES = {
    "au":           Web3.to_checksum_address("0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08"),
    "ag":           Web3.to_checksum_address("0x1D31719389Bd8b17277Ba367c26b830aE34D3674"),
    "treasury_amo": Web3.to_checksum_address("0x56653245f4718fe105b95C8424947B31b84b5188"),
    "pid":          Web3.to_checksum_address("0x99114F594Ff218028309d3E7F47C5873B9917f70"),
    "oracle":       Web3.to_checksum_address("0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB"),
    "flashbuy":     Web3.to_checksum_address("0xf6383860837E6cb983F9Af8Def92fc08F15Be65b"),
    "treasury_safe":Web3.to_checksum_address("0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e"),
    "usdc":         Web3.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    "aerodrome":    Web3.to_checksum_address("0xcF77a3Ba9A5CA399B7c97c74d5e8A7C736508e0B"),
}

# ── Deployment ─────────────────────────────────────────────────
class Phase4Deployer:
    def __init__(self, env: dict, dry_run: bool = True):
        self.env = env
        self.dry_run = dry_run
        self.w3 = Web3(Web3.HTTPProvider(env.get("RPC_URL_BASE", "https://mainnet.base.org")))

        if not self.w3.is_connected():
            raise ConnectionError("Cannot connect to Base mainnet")

        self.chain_id = self.w3.eth.chain_id
        self.deployer = Account.from_key(env["PRIVATE_KEY_BASE"])
        self.nonce = self.w3.eth.get_transaction_count(self.deployer.address)

        self.deployed = {}
        self.gas_price = self.w3.eth.gas_price

        print(f"Connected: chain={self.chain_id}, block={self.w3.eth.block_number}")
        print(f"Deployer: {self.deployer.address}")
        print(f"Balance: {self.w3.eth.get_balance(self.deployer.address) / 1e18:.4f} ETH")
        print(f"Gas: {self.gas_price / 1e9:.2f} gwei")
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE DEPLOY'}")
        print()

    def _get_compiled(self, contract_name: str) -> dict:
        """Load compiled contract artifact."""
        # Try different naming patterns
        patterns = [
            OUT_DIR / f"{contract_name}.sol" / f"{contract_name}.json",
            OUT_DIR / f"{contract_name}" / f"{contract_name}.json",
        ]
        for path in patterns:
            if path.exists():
                with open(path) as f:
                    return json.load(f)
        raise FileNotFoundError(f"Compiled artifact not found for {contract_name}")

    def _deploy(self, contract_name: str, *constructor_args, value: int = 0) -> str:
        """Deploy a contract. Returns the deployed address."""
        artifact = self._get_compiled(contract_name)
        abi = artifact["abi"]
        bytecode = artifact["bytecode"]["object"] if isinstance(artifact["bytecode"], dict) else artifact["bytecode"]

        contract = self.w3.eth.contract(abi=abi, bytecode=bytecode)

        # Build constructor tx with explicit gas to avoid estimation failure
        base_tx = {
            "from": self.deployer.address,
            "nonce": self.nonce,
            "value": value,
            "chainId": self.chain_id,
            "gas": 5_000_000,  # Will be refined below
            "maxFeePerGas": self.gas_price,
            "maxPriorityFeePerGas": self.w3.to_wei(0.1, "gwei"),
        }

        if constructor_args:
            tx = contract.constructor(*constructor_args).build_transaction(base_tx)
        else:
            tx = contract.constructor().build_transaction(base_tx)

        # Estimate gas with 30% buffer (if possible)
        try:
            estimated = self.w3.eth.estimate_gas({
                "from": self.deployer.address,
                "data": tx["data"],
                "value": value,
            })
            tx["gas"] = int(estimated * 1.3)
        except Exception as e:
            print(f"  ⚠️  Gas estimation failed (using fallback): {e}")
            tx["gas"] = 5_000_000  # Fallback

        cost_eth = tx["gas"] * self.gas_price / 1e18
        print(f"  📊 Gas: {tx['gas']:,}, Cost: {cost_eth:.4f} ETH")

        if self.dry_run:
            print(f"  📋 DRY RUN: Would deploy {contract_name}")
            print(f"     Gas: {tx['gas']:,}, Cost: {tx['gas'] * self.gas_price / 1e18:.4f} ETH")
            self.nonce += 1
            # Use a non-zero dummy address for dry-run
            dummy = "0x" + "1" * 40
            self.deployed[contract_name] = dummy
            return dummy

        # Sign and send
        signed = self.deployer.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"  ⛽ TX sent: {tx_hash.hex()}")

        # Wait for receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
        if receipt.status == 1:
            address = receipt.contractAddress
            print(f"  ✅ {contract_name} deployed at {address} (block {receipt.blockNumber}, gas {receipt.gasUsed:,})")
            self.deployed[contract_name] = address
            self.nonce += 1
            return address
        else:
            raise Exception(f"Deployment FAILED for {contract_name}: {receipt}")

    def deploy_all(self):
        """Deploy all Phase 4 contracts."""
        print("=" * 60)
        print("  AV TREASURY — PHASE 4 DEPLOYMENT")
        print("=" * 60)

        # ── Step 1: Deploy Timelock ───────────────────────────
        print("\n[1/5] Deploying TimelockController...")
        min_delay = 48 * 3600  # 48 hours
        # TimelockController: min_delay, proposers[], executors[], admin
        # We set admin to deployer temporarily, then transfer to Governor
        timelock_addr = self._deploy(
            "TimelockController",
            min_delay,
            [],  # proposers: none yet (will add Governor)
            [],  # executors: none yet (will add Governor)
            self.deployer.address,  # temporary admin
        )
        print(f"  Timelock: {timelock_addr}")

        # ── Step 2: Deploy Governor ───────────────────────────
        print("\n[2/5] Deploying GovernorContractV5...")
        # OZ v5 compatible Governor with manual timelock integration.
        # Compiled with --via-ir to fit under 24KB EIP-170 limit (20,523 bytes).
        governor_addr = self._deploy(
            "GovernorContractV5",
            ADDRESSES["ag"],  # IVotes token (Ag)
            timelock_addr,    # TimelockController
        )
        print(f"  Governor: {governor_addr}")

        # ── Step 3: Deploy OracleWrapper ───────────────────────
        print("\n[3/5] Deploying OracleWrapper...")
        oracle_wrapper_addr = self._deploy(
            "OracleWrapper",
            ADDRESSES["oracle"],       # _avOracle
            ADDRESSES["treasury_amo"], # _treasuryAMO
            ADDRESSES["flashbuy"],     # _treasuryFlashBuy
            200,                       # _deviationThreshold (2% in bps)
            3600,                      # _maxStaleness (1 hour)
        )
        print(f"  OracleWrapper: {oracle_wrapper_addr}")

        # ── Step 4: Deploy OracleFlashBuy ──────────────────────
        print("\n[4/5] Deploying OracleFlashBuy...")
        oracle_flashbuy_addr = self._deploy(
            "OracleFlashBuy",
            ADDRESSES["treasury_amo"],  # _treasury
            ADDRESSES["au"],            # _auToken
            ADDRESSES["usdc"],          # _usdcToken
            ADDRESSES["aerodrome"],     # _dex
            oracle_wrapper_addr,        # _oracleWrapper
            self.w3.to_wei(10000, "ether"),  # _maxBuybackPerExecution (10000 USDC)
            6 * 3600,                   # _cooldown (6 hours)
        )
        print(f"  OracleFlashBuy: {oracle_flashbuy_addr}")

        # ── Step 5: Deploy OracleGuardian ──────────────────────
        print("\n[5/5] Deploying OracleGuardian...")
        oracle_guardian_addr = self._deploy(
            "OracleGuardian",
            ADDRESSES["oracle"],         # _oracle
            ADDRESSES["au"],             # _auToken
            ADDRESSES["usdc"],                  # _usdcToken
            ADDRESSES["treasury_amo"],   # _treasuryAMO
            self.deployer.address,       # _admin (temporary, transfer to Governor)
            self.w3.to_wei(1, "ether"), # _auPeg ($1.00)
            200,                         # _buybackTriggerBps (2%)
        )
        print(f"  OracleGuardian: {oracle_guardian_addr}")

        # ── Summary ────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("  DEPLOYMENT SUMMARY")
        print("=" * 60)
        for name, addr in self.deployed.items():
            print(f"  {name:30s} {addr}")
        print()

        if not self.dry_run:
            self._save_deployment()
            self._print_post_deploy_steps()

    def _save_deployment(self):
        """Save deployed addresses to deployment record."""
        record = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%Z"),
            "chain_id": self.chain_id,
            "deployer": self.deployer.address,
            "contracts": self.deployed,
        }
        path = ROOT / "deployments" / f"phase4_{self.chain_id}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(record, f, indent=2)
        print(f"📄 Deployment record saved to {path}")

    def _print_post_deploy_steps(self):
        """Print manual steps needed after deployment."""
        print("""
╔══════════════════════════════════════════════════════════════╗
║  POST-DEPLOYMENT CHECKLIST                                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Verify all contracts on Basescan                         ║
║     → Use ETHERSCAN_API_V2 key                              ║
║                                                              ║
║  2. Grant Timelock roles to Governor                        ║
║     → PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE          ║
║                                                              ║
║  3. Transfer Timelock admin to Governor                      ║
║     → timelock.grantRole(DEFAULT_ADMIN, governor)            ║
║     → timelock.revokeRole(DEFAULT_ADMIN, deployer)           ║
║                                                              ║
║  4. Configure OracleWrapper thresholds                      ║
║     → setDeviationThreshold(200)  // 2%                     ║
║     → setBelowPegThreshold(100)   // 1%                     ║
║                                                              ║
║  5. Grant keeper roles                                      ║
║     → OracleGuardian: KEEPER_ROLE → keeper hot wallet        ║
║     → OracleFlashBuy: KEEPER_ROLE → keeper hot wallet        ║
║                                                              ║
║  6. Fund keeper wallet with ETH for gas                     ║
║     → Send 0.1 ETH to 0x11bCA90bE8c939723b55eD54a96a4721... ║
║                                                              ║
║  7. Update Treasury Safe threshold: 1/2 → 2/2               ║
║     → Use Gnosis Safe UI or API                             ║
║                                                              ║
║  8. Start keeper bot                                        ║
║     → python keeper/run_keeper.py                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")


# ── CLI ───────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="AV Treasury Phase 4 Deployment")
    parser.add_argument("--dry-run", action="store_true", help="Simulate deployment (no transactions)")
    parser.add_argument("--execute", action="store_true", help="Actually deploy to mainnet")
    args = parser.parse_args()

    if not args.execute and not args.dry_run:
        print("Specify --dry-run or --execute")
        sys.exit(1)

    env = load_env()
    deployer = Phase4Deployer(env, dry_run=args.dry_run)
    deployer.deploy_all()


if __name__ == "__main__":
    main()
