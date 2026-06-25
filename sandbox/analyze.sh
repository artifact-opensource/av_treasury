#!/bin/bash
export PATH="$HOME/.foundry/bin:$PATH"
RPC="http://127.0.0.1:8545"

echo "=== FINAL SIMULATION STATE ==="
echo ""

echo "--- Token Supplies ---"
AG_SUPPLY=$(cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 "totalSupply()(uint256)" --rpc-url $RPC 2>/dev/null)
AU_SUPPLY=$(cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "totalSupply()(uint256)" --rpc-url $RPC 2>/dev/null)
echo "AgToken totalSupply: $AG_SUPPLY"
echo "AuToken totalSupply: $AU_SUPPLY"
echo ""

echo "--- Treasury Balances ---"
TREAS_AG=$(cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 "balanceOf(address)(uint256)" 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 --rpc-url $RPC 2>/dev/null)
TREAS_AU=$(cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "balanceOf(address)(uint256)" 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 --rpc-url $RPC 2>/dev/null)
echo "TreasuryAMO AgToken: $TREAS_AG"
echo "TreasuryAMO AuToken: $TREAS_AU"
echo ""

echo "--- DEX Reserves ---"
DEX_AG=$(cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "reserveA()(uint112)" --rpc-url $RPC 2>/dev/null)
DEX_AU=$(cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "reserveB()(uint112)" --rpc-url $RPC 2>/dev/null)
echo "DEX Ag reserve: $DEX_AG"
echo "DEX Au reserve: $DEX_AU"
echo ""

echo "--- PID Controller ---"
PID_TVL=$(cast storage 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 5 --rpc-url $RPC 2>/dev/null)
PID_TWATVL=$(cast storage 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 6 --rpc-url $RPC 2>/dev/null)
PID_EMISSIONS=$(cast storage 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 7 --rpc-url $RPC 2>/dev/null)
PID_ACTIVE=$(cast storage 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 8 --rpc-url $RPC 2>/dev/null)
echo "PID targetTVL: $PID_TVL"
echo "PID twatvl: $PID_TWATVL"
echo "PID totalEmissions: $PID_EMISSIONS"
echo "PID emissionActive: $PID_ACTIVE"
echo ""

echo "--- DEX LP Supply ---"
DEX_LP=$(cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "totalLPSupply()(uint256)" --rpc-url $RPC 2>/dev/null)
echo "DEX totalLPSupply: $DEX_LP"
echo ""

echo "--- DEX Fees ---"
DEX_FEES_AG=$(cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "accumulatedFeesA()(uint256)" --rpc-url $RPC 2>/dev/null)
DEX_FEES_AU=$(cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "accumulatedFeesB()(uint256)" --rpc-url $RPC 2>/dev/null)
echo "DEX accumulatedFeesA (Ag): $DEX_FEES_AG"
echo "DEX accumulatedFeesB (Au): $DEX_FEES_AU"
echo ""

echo "--- Anvil Block ---"
cast block-number --rpc-url $RPC 2>/dev/null
