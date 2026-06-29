---
title: Etherscan V2 Contract Verification Guide
date: 2026-06-29
status: complete
description: Step-by-step guide for verifying AV Treasury smart contracts on Etherscan using the V2 block explorer API.
category: deployment
related: [WORKSPACE.md, README.md, dapp-technical-brief.md]
---

# Etherscan V2 Verification

This guide covers verifying AV Treasury contracts on Etherscan using the V2 block explorer API.

## Prerequisites

- Deployed contracts on Ethereum mainnet or testnet
- Etherscan API key (stored in `.env` as `ETHERSCAN_API_KEY`)
- Flattened contract source code
- Constructor arguments (ABI-encoded)

## Process

### 1. Flatten Contracts

```bash
forge flatten contracts/AgToken.sol > flattened/AgToken.sol
forge flatten contracts/AuToken.sol > flattened/AuToken.sol
forge flatten contracts/TreasuryAMO.sol > flattened/TreasuryAMO.sol
forge flatten contracts/PID_Emission_v2.sol > flattened/PID_Emission_v2.sol
forge flatten contracts/AvOracle.sol > flattened/AvOracle.sol
forge flatten contracts/AVLPStaking_v2.sol > flattened/AVLPStaking_v2.sol
forge flatten contracts/GovernorContract.sol > flattened/GovernorContract.sol
forge flatten contracts/ArtifactTimelock.sol > flattened/ArtifactTimelock.sol
```

### 2. Submit for Verification

For each contract, submit via the Etherscan V2 API:

```bash
curl -X POST "https://api.etherscan.io/api" \
  -F "apikey=$ETHERSCAN_API_KEY" \
  -F "module=contract" \
  -F "action=verify" \
  -F "sourceCode=@flattened/AgToken.sol" \
  -F "contractaddress=0x..." \
  -F "codeformat=solidity-standard-json-input" \
  -F "contractname=AgToken" \
  -F "compilerversion=v0.8.26+commit.8a97fa7a" \
  -F "optimizationUsed=1" \
  -F "runs=200" \
  -F "constructorArguements=..."
```

### 3. Check Verification Status

```bash
curl "https://api.etherscan.io/api?module=contract&action=checkverifystatus&guid=GUID&apikey=$ETHERSCAN_API_KEY"
```

### 4. Verify Proxy Contracts

For upgradeable proxies, use the `verifyproxycontract` action:

```bash
curl -X POST "https://api.etherscan.io/api" \
  -F "apikey=$ETHERSCAN_API_KEY" \
  -F "module=contract" \
  -F "action=verifyproxycontract" \
  -F "address=0x..."
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Bytecode mismatch" | Ensure compiler version and optimization settings match deployment |
| "Already verified" | Use `getsourcecode` to confirm existing verification |
| "Constructor args invalid" | Re-encode constructor arguments using `cast abi-encode` |
| "Source code too large" | Use standard JSON input format with import resolution |

## Verification Checklist

- [ ] AgToken verified
- [ ] AuToken verified
- [ ] TreasuryAMO verified
- [ ] PID_Emission_v2 verified
- [ ] AvOracle verified
- [ ] AVLPStaking_v2 verified
- [ ] GovernorContract verified
- [ ] ArtifactTimelock verified

## Notes

- The Etherscan V2 API supports multi-file verification without flattening (standard JSON input)
- Constructor arguments must be ABI-encoded without the `0x` prefix
- Verification may take 30-60 seconds per contract
