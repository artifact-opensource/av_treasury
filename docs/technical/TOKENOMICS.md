# Treasury Tokenomics

This document details the economic design of the AV Treasury system, focusing on the dual-token model (Au and Ag) and the systemic incentives that drive value accumulation.

## 1. Au (Artifact Utility) — The Fuel

Au is the primary utility token of the ecosystem, designed to be a deflationary asset whose value is derived from real usage.

### Properties
- **Symbol:** Au
- **Name:** Artifact Utility
- **Standard:** ERC20 with EIP-2612 Permit
- **Total Supply:** 1,000,000,000 (Fixed)
- **Decimals:** 18
- **Nature:** Deflationary

### Distribution (Genesis)
| Allocation | Amount | Recipient |
|---|---|---|
| Deployer (for LP) | 999,000,000 Au | Deployer wallet |
| Staking Fund | 300,000 Au | AVLPStaking_v2 |
| Treasury/Ops | 700,000 Au | Treasury multisig |
| **Total** | **1,000,000,000 Au** | |

### Fee Mechanism
Every Au transfer triggers a fee designed to create systemic scarcity and treasury growth:
- **Transfer Fee:** 9 bps (0.09%)
  - **50% Burned:** Directly removes Au from circulation (deflation).
  - **50% Treasury:** Accrues to the treasury for system operations and buybacks.
- **Flash Mint Fee:** 9 bps (Same as transfer fee).
- **Flash Mint Cap:** 1,000,000 Au.
- **Hard Fee Cap:** 500 bps (5%), adjustable via governance.

---

## 2. Ag (Artifact Governance) — The Power

Ag is the programmatic governance token, distributed algorithmically to prevent concentration and reward long-term alignment.

### Properties
- **Symbol:** Ag
- **Name:** Artifact Governance
- **Standard:** ERC20 with ERC20Votes (Checkpoints, Delegation)
- **Max Supply:** 100,000,000
- **Decimals:** 18
- **Nature:** Programmatically Emitted

### Emission Model
Ag is not minted at genesis; it is earned through system interaction.
- **Minter Roles:** Only `AVLPStaking_v2` and `PID_Emission_Controller_v2` can mint Ag.
- **PID Control:** Emissions are dynamically adjusted based on Total Value Locked (TVL).
  - **TVL < Target:** Higher emissions to attract liquidity.
  - **TVL > Target:** Lower emissions to reduce inflation.
- **Caps:**
  - Daily Emission Cap: 100,000 Ag
  - Single Emission Cap: 10,000 Ag

### Staking Rewards
Stakers provide liquidity via LP NFTs to earn both tokens:
- **Au Reward:** 0.001 Au per block.
- **Ag Reward:** 0.0001 Ag per block.

---

## 3. The Ag-Based Multiplier

The system employs a cross-token incentive where Ag holdings amplify Au earnings, creating a symbiotic demand loop.

### The Multiplier Formula
The staking yield is multiplied by a factor between **1x and 2.5x** based on the staker's Ag balance:
`multiplier = 10000 + (15000 * agBalance) / threshold`

- **Threshold:** 5,000 Ag.
- **At 0 Ag:** Multiplier = 1x.
- **At 5,000 Ag:** Multiplier = 2.5x.

**Systemic Impact:** Demand for high yields $\rightarrow$ Demand for Ag $\rightarrow$ Ag scarcity $\rightarrow$ Increased Ag value $\rightarrow$ Systemic stability.

---

## 4. Economic Cycle Summary

1. **Utility Usage:** Ecosystem services require Au $\rightarrow$ Au is spent/transferred.
2. **Fee Capture:** Transfers trigger burns (reducing supply) and treasury accrual.
3. **Treasury Buybacks:** TreasuryAMO uses reserves to buy Au from DEXs $\rightarrow$ Price support.
4. **Staking Incentives:** LP NFTs earn Au and Ag $\rightarrow$ Locks liquidity.
5. **Governance Power:** Ag holders control parameters $\rightarrow$ Optimize the cycle.


**Author:** ARTIFACT RESEARCH DIVISION - BLOCKCHAIN
**Date:** 23 June, 2026
**Status:** Ready
