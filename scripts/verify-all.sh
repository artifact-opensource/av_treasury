#!/usr/bin/env bash
# ===============================================================================
# verify-all.sh - Etherscan V2 Verification for AV Treasury (Base)
# ===============================================================================
#
# Etherscan V2 API: https://api.etherscan.io/v2/api?chainid=8453
# 
# Key V2 differences from V1:
#   - Unified API key works across all chains
#   - URL format: api.etherscan.io/v2/api?chainid=<chainId>
#   - Constructor args must be ABI-encoded (use cast abi-encode)
#   - Compiler version must match exactly (including commit hash)
#   - Optimization settings must match exactly
#
# Usage:
#   chmod +x scripts/verify-all.sh
#   ETHERSCAN_API_V2=your_key bash scripts/verify-all.sh [deployed_json_path]
#
# Optional env vars:
#   DEPLOYER_ADDRESS - deployer address (for constructor args)
#   AERODROME_ROUTER - Aerodrome router address (Base mainnet)
#   UNISWAP_ROUTER   - Uniswap V2 router address (Base mainnet)
#
# Default JSON: deployed_8453.json
# ===============================================================================

set -euo pipefail

# --- Configuration ------------------------------------------------------------
ETHERSCAN_API_KEY="${ETHERSCAN_API_V2:?ERROR: ETHERSCAN_API_V2 env var required}"
DEPLOYED_JSON="${1:-deployed_8453.json}"
CHAIN_ID="8453"
VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}"

# Well-known Base mainnet addresses (update if different)
AERODROME_ROUTER="${AERODROME_ROUTER:-0xBE489A2f3C30dcDa27a4Be1191761ac34014ec2E}"
UNISWAP_ROUTER="${UNISWAP_ROUTER:-0x4752ba5DBc23f44D87826276BF6F6b21E055A758}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

# --- Pre-flight checks -------------------------------------------------------
if [ ! -f "$DEPLOYED_JSON" ]; then
    log_error "Deployed addresses file not found: $DEPLOYED_JSON"
    echo "  Run DeployProduction.s.sol first to generate deployed JSON"
    exit 1
fi

if ! command -v forge &> /dev/null; then
    log_error "forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

if ! command -v cast &> /dev/null; then
    log_error "cast not found. Install Foundry toolchain."
    exit 1
fi

# --- Read deployed addresses -------------------------------------------------
read_address() {
    python3 -c "
import json, sys
with open('$DEPLOYED_JSON') as f:
    data = json.load(f)
if 'contracts' in data:
    addr = data['contracts'].get('$1', '')
else:
    addr = data.get('$1', '')
if not addr:
    print('MISSING', file=sys.stderr)
    sys.exit(1)
print(addr)
"
}

AG_TOKEN=$(read_address "AgToken") || { log_error "AgToken address missing"; exit 1; }
AU_TOKEN=$(read_address "AuToken") || { log_error "AuToken address missing"; exit 1; }
AV_ORACLE=$(read_address "AvOracle") || { log_error "AvOracle address missing"; exit 1; }
PID_CONTROLLER=$(read_address "PID_Controller") || { log_error "PID_Controller address missing"; exit 1; }
LP_STAKING=$(read_address "LP_Staking") || { log_error "LP_Staking address missing"; exit 1; }
LP_NFT=$(read_address "LP_NFT" 2>/dev/null) || { log_warn "LP_NFT address missing (external)"; LP_NFT=""; }
TREASURY_AMO=$(read_address "Treasury_AMO") || { log_error "Treasury_AMO address missing"; exit 1; }
TIMELOCK=$(read_address "Timelock") || { log_error "Timelock address missing"; exit 1; }
GOVERNOR=$(read_address "Governor") || { log_error "Governor address missing"; exit 1; }

# Read Aerodrome router from deployed JSON (must match what was used during deploy)
AERODROME_ROUTER_DEPLOYED=$(read_address "Aerodrome_Router" 2>/dev/null) || \
    log_warn "Aerodrome_Router not in JSON, using env var or default"
if [ -n "$AERODROME_ROUTER_DEPLOYED" ] && [ "$AERODROME_ROUTER_DEPLOYED" != "MISSING" ]; then
    AERODROME_ROUTER="$AERODROME_ROUTER_DEPLOYED"
    log_info "Using Aerodrome router from deployed JSON: $AERODROME_ROUTER"
fi

# Get deployer address
DEPLOYER="${DEPLOYER_ADDRESS:-$(python3 -c "
import json
with open('$DEPLOYED_JSON') as f:
    data = json.load(f)
print(data.get('deployer', '0x0000000000000000000000000000000000000001'))
")}"

echo ""
echo "==============================================================="
echo "  ETHERSCAN V2 VERIFICATION - BASE MAINNET"
echo "==============================================================="
echo "  Chain ID:    $CHAIN_ID"
echo "  API:         $VERIFIER_URL"
echo "  Deployer:    $DEPLOYER"
echo "  Aero Router: $AERODROME_ROUTER"
echo "==============================================================="
echo ""

# --- Helper: verify a contract ----------------------------------------------
# Usage: verify_contract <name> <address> <source_path> [constructor_args_hex]
verify_contract() {
    local name="$1"
    local address="$2"
    local source_path="$3"
    local constructor_args="${4:-}"
    
    log_step "Verifying $name..."
    log_info "  Address: $address"
    log_info "  Source:  $source_path"
    
    local cmd=(
        forge verify-contract
        --chain-id "$CHAIN_ID"
        --verifier etherscan
        --verifier-url "$VERIFIER_URL"
        --etherscan-api-key "$ETHERSCAN_API_KEY"
        --watch
    )
    
    if [ -n "$constructor_args" ]; then
        log_info "  Constructor args: $constructor_args"
        cmd+=(--constructor-args "$constructor_args")
    fi
    
    cmd+=("$address" "$source_path")
    
    if "${cmd[@]}"; then
        log_ok "  PASS $name VERIFIED"
        echo ""
        return 0
    else
        log_error "  FAIL $name VERIFICATION FAILED"
        echo ""
        return 1
    fi
}

FAILED=0

# ===============================================================================
# PHASE 1: AgToken
# Constructor: () - no args
# Has initialize(address admin) called post-deploy
# ===============================================================================
verify_contract "AgToken" "$AG_TOKEN" "contracts/AgToken.sol:AgToken" "" || ((FAILED++))

# ===============================================================================
# PHASE 2: AuToken
# Constructor: () - no args
# Has initialize(address admin) called post-deploy
# ===============================================================================
verify_contract "AuToken" "$AU_TOKEN" "contracts/AuToken.sol:AuToken" "" || ((FAILED++))

# ===============================================================================
# PHASE 3: AvOracle
# Constructor: (address auToken, address agToken, address admin, address governor)
# ===============================================================================
ORACLE_ARGS=$(cast abi-encode "constructor(address,address,address,address)" \
    "$AU_TOKEN" "$AG_TOKEN" "$DEPLOYER" "$DEPLOYER" 2>/dev/null || \
    echo "0x000000000000000000000000$(echo $AU_TOKEN | sed 's/0x//')000000000000000000000000$(echo $AG_TOKEN | sed 's/0x//')000000000000000000000000$(echo $DEPLOYER | sed 's/0x//')000000000000000000000000$(echo $DEPLOYER | sed 's/0x//')")
verify_contract "AvOracle" "$AV_ORACLE" "contracts/AvOracle.sol:AvOracle" "$ORACLE_ARGS" || ((FAILED++))

# ===============================================================================
# PHASE 4: PID_Emission_Controller_v2
# Constructor: (admin, staking, agToken, targetTVL, kp, ki, kd)
# Default: admin=deployer, staking=lpStaking, agToken=agToken
#          targetTVL=5e16, kp=1e15, ki=1e14, kd=1e14
# ===============================================================================
PID_ARGS=$(cast abi-encode "constructor(address,address,address,uint256,uint256,uint256,uint256)" \
    "$DEPLOYER" "$LP_STAKING" "$AG_TOKEN" \
    "50000000000000000" "1000000000000000" "100000000000000" "100000000000000")
verify_contract "PID_Emission_Controller_v2" "$PID_CONTROLLER" \
    "contracts/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2" "$PID_ARGS" || ((FAILED++))

# ===============================================================================
# PHASE 5: AVLPStaking_v2
# Constructor: () - no args
# Has initialize(auToken, agToken, lpNFT) called post-deploy
# ===============================================================================
verify_contract "AVLPStaking_v2" "$LP_STAKING" "contracts/AVLPStaking_v2.sol:AVLPStaking_v2" "" || ((FAILED++))

# ===============================================================================
# PHASE 6: TreasuryAMO
# Constructor: (auToken, reserveToken, aerodromeRouter, admin)
# NOTE: aerodromeRouter must match the address used during deployment
# ===============================================================================
log_info "  Using Aerodrome router: $AERODROME_ROUTER"
TREASURY_ARGS=$(cast abi-encode "constructor(address,address,address,address)" \
    "$AU_TOKEN" "$AG_TOKEN" "$AERODROME_ROUTER" "$DEPLOYER")
verify_contract "TreasuryAMO" "$TREASURY_AMO" "contracts/TreasuryAMO.sol:TreasuryAMO" "$TREASURY_ARGS" || ((FAILED++))

# ===============================================================================
# PHASE 7: ArtifactTimelock
# Constructor: (proposer, executor, canceler)
# ===============================================================================
TIMELOCK_ARGS=$(cast abi-encode "constructor(address,address,address)" \
    "$GOVERNOR" "0x0000000000000000000000000000000000000000" "$DEPLOYER")
verify_contract "ArtifactTimelock" "$TIMELOCK" "contracts/ArtifactTimelock.sol:ArtifactTimelock" "$TIMELOCK_ARGS" || ((FAILED++))

# ===============================================================================
# PHASE 8: GovernorContract
# Constructor: (IVotes _token, address _executor)
# ===============================================================================
GOVERNOR_ARGS=$(cast abi-encode "constructor(address,address)" \
    "$AG_TOKEN" "$TIMELOCK")
verify_contract "GovernorContract" "$GOVERNOR" "contracts/GovernorContract.sol:GovernorContract" "$GOVERNOR_ARGS" || ((FAILED++))

# ===============================================================================
# PHASE 9: LP NFT (external - skip)
# ===============================================================================
if [ -n "$LP_NFT" ] && [ "$LP_NFT" != "0x0000000000000000000000000000000000000000" ]; then
    log_info "LP NFT at $LP_NFT - external contract, skipping verification"
else
    log_info "LP NFT - external contract or not provided, skipping verification"
fi

# ===============================================================================
# SUMMARY
# ===============================================================================
echo ""
echo "==============================================================="
if [ "$FAILED" -eq 0 ]; then
    log_ok "  ALL CONTRACTS VERIFIED SUCCESSFULLY"
else
    log_error "  $FAILED CONTRACT(S) FAILED VERIFICATION"
fi
echo "==============================================================="
echo ""
log_info "Check status at: https://basescan.org/address/<contract_address>#code"
echo ""

exit "$FAILED"
