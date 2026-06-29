---
title: AV Treasury DApp — Technical Brief
date: 2026-06-29
status: complete
description: Technical overview of the AV Treasury decentralized application, covering architecture, contract interactions, and frontend integration patterns.
category: technical
related: [WORKSPACE.md, README.md, whitepaper/whitepaper.md, ETHERSCAN_V2_VERIFICATION.md]
---

# AV Treasury DApp — Technical Brief

## Overview

The AV Treasury decentralized application (DApp) provides a web interface for interacting with the AV Treasury protocol. This document covers the technical architecture, contract integration, and key implementation patterns.

## Architecture

### Frontend Stack

- **Framework:** React 18+ with TypeScript
- **State Management:** Zustand for global state, React Query for server state
- **Web3 Provider:** Wagmi + Viem for wallet connection and contract interaction
- **UI Library:** Tailwind CSS + Radix UI primitives
- **Charts:** Recharts for data visualization

### Backend/Indexing

- **Subgraph:** The Graph protocol for indexing on-chain events
- **RPC Provider:** Infura/Alchemy for JSON-RPC access
- **Price Feeds:** Chainlink for USD-denominated data

## Key Contract Interactions

### 1. Token Operations

```typescript
// Approve AuToken for staking
await writeContract({
  address: AU_TOKEN_ADDRESS,
  abi: AuTokenABI,
  functionName: 'approve',
  args: [AVLP_STAKING_ADDRESS, amount],
});

// Stake Au LP tokens
await writeContract({
  address: AVLP_STAKING_ADDRESS,
  abi: AVLPStakingABI,
  functionName: 'stake',
  args: [lpAmount],
});
```

### 2. Governance

```typescript
// Create proposal
await writeContract({
  address: GOVERNOR_ADDRESS,
  abi: GovernorABI,
  functionName: 'propose',
  args: [targets, values, calldatas, description],
});

// Cast vote
await writeContract({
  address: GOVERNOR_ADDRESS,
  abi: GovernorABI,
  functionName: 'castVote',
  args: [proposalId, support], // support: 0=against, 1=for, 2=abstain
});
```

### 3. Treasury Data

```typescript
// Read TVL from AvOracle
const tvl = await readContract({
  address: AVORACLE_ADDRESS,
  abi: AvOracleABI,
  functionName: 'getTvl',
});

// Read Ag emission rate
const emissionRate = await readContract({
  address: PID_CONTROLLER_ADDRESS,
  abi: PIDControllerABI,
  functionName: 'getCurrentEmissionRate',
});
```

## Data Flow

```
User Action → Wagmi Hook → Contract Call → Transaction Sent
                                               ↓
                                         Event Emitted
                                               ↓
                                         Subgraph Indexes
                                               ↓
                                         React Query Fetches
                                               ↓
                                         UI Updates
```

## Key Features

### Dashboard
- Real-time TVL display
- Ag emission rate and history
- Au circulating supply and burn metrics
- Treasury reserve composition

### Staking Interface
- LP token deposit/withdrawal
- Pending rewards display
- Ag multiplier calculator
- Historical yield data

### Governance Portal
- Active proposals list
- Voting interface with reason
- Proposal creation wizard
- Delegation management

### Analytics
- PID controller performance charts
- Buyback history and TWAP validation
- Bot activity heatmap (sandbox)
- Fee revenue breakdown

## Security Considerations

1. **Transaction Simulation:** All transactions are simulated before submission using Tenderly API
2. **Slippage Protection:** User-configurable slippage tolerance (default 0.5%)
3. **Approval Safety:** Uses ERC-20 `increaseAllowance`/`decreaseAllowance` pattern
4. **Rate Limiting:** Frontend rate-limits contract reads to prevent RPC throttling
5. **Error Handling:** All contract reverts are decoded and displayed in user-friendly format

## Deployment

```bash
# Build frontend
npm run build

# Deploy to IPFS
ipfs add -r dist/

# Or deploy to Vercel
vercel --prod
```

## Environment Variables

```env
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/...
NEXT_PUBLIC_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/...
NEXT_PUBLIC_CHAIN_ID=1
```

## Testing

```bash
# Unit tests
npm test

# Integration tests (mainnet fork)
npm run test:integration

# E2E tests
npm run test:e2e
```

## Related Documentation

- [WORKSPACE.md](../WORKSPACE.md) — Full system architecture and contract specs
- [whitepaper/whitepaper.md](whitepaper/whitepaper.md) — Protocol whitepaper
- [ETHERSCAN_V2_VERIFICATION.md](ETHERSCAN_V2_VERIFICATION.md) — Contract verification guide
