# AV Treasury — Clean Redeploy Plan & Preflight Checklist

**Date:** 2026-06-27  
**Reason:** Deployer private key compromised. Attacker actively attempting approval exploits from old address.  
**Decision:** Full clean redeploy. Old deployer address is permanently toxic.

---

## PREFLIGHT CHECKLIST

### ❌ Security
- [ ] Old deployer key (`0x21E914...`) confirmed compromised — DO NOT USE
- [ ] Attacker observed sending txs from compromised address — attempting approval exploits
- [ ] No pending malicious multisig txs on either Safe (confirmed clear)
- [ ] Old deployer balance: 0 ETH (no funds at risk from that wallet directly)

### ❌ Current On-Chain State (to be abandoned)
| Contract | Address | Owner | Status |
|----------|---------|-------|--------|
| CLPoolLauncher | `0xb9A1094D614c70B94C2CD7b4efc3A6adC6e6F4d3` | Safe `0xE6A41f...` | Active |
| CLPoolLauncher Safe | `0xE6A41fE61E7a1996B59d508661e3F524d6A32075` | 3-of-7 multisig | ~0.019 ETH |
| Treasury Safe | `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e` | 1-of-2 (dev + Binance) | 0 ETH |
| Compromised Deployer | `0x21E914dFBB137F7fEC896F11bC8BAd6BCCDB147B` | — | 0 ETH |

### ❌ What Needs Protection
- [ ] CLPoolLauncher Safe holds ~0.019 ETH — drain before abandon
- [ ] Any ERC20 tokens held by CLPoolLauncher or its Safe
- [ ] Any protocol-owned liquidity positions
- [ ] Any staking rewards or accumulated fees in contracts

### ❌ New Infrastructure Required
- [ ] Fresh deployer wallet (new private key, never shared/derived from old)
- [ ] New Gnosis Safe for CLPoolLauncher ownership
- [ ] New Gnosis Safe for Treasury (or reconfigure existing)
- [ ] New Safe API key (generate from Safe UI after new Safe creation)

### ❌ Contract Suite to Redeploy (from DeployProduction.s.sol)
1. CLPoolLauncher (core: pool creation + pairable token management)
2. AgToken (token contract)
3. AVTreasury (treasury management)
4. Staking contracts (if any)
5. Governance contracts (Governor, Timelock)
6. Periphery contracts (Router, etc.)

### ❌ Dependencies & Configuration
- [ ] Foundry installed and working
- [ ] Base mainnet RPC endpoint (current: `https://mainnet.base.org`)
- [ ] Basescan API key for verification
- [ ] Gnosis Safe Transaction Service API access (new key)
- [ ] All contract source code compiles cleanly

### ❌ Post-Deploy Verification
- [ ] All contracts verified on Basescan
- [ ] Ownership set to new Safe (NOT deployer directly)
- [ ] CLPoolLauncher `paused()` is true initially
- [ ] All expected functions work via Safe multisig
- [ ] Old contracts marked as deprecated/migrated

---

## REDEPLOY EXECUTION PLAN

### Phase 1: Secure & Drain
1. Drain all ETH/tokens from CLPoolLauncher Safe (`0xE6A41f...`) — it has ~0.019 ETH
2. Check for and drain any ERC20 token balances
3. Verify no pending multisig transactions (✅ confirmed clear)

### Phase 2: New Infrastructure
1. Generate fresh deployer key: `cast wallet new`
2. Fund new deployer with ETH for gas (from dev wallet or exchange)
3. Create new Gnosis Safe via Safe UI (https://app.safe.global)
   - Set appropriate threshold (recommend 2-of-3 minimum)
   - Add owners: dev wallet, new deployer, Binance multisig
4. Generate new Safe API key from Safe Auth Service
5. Update `.env` with ALL new values

### Phase 3: Deploy New Contracts
1. Run `DeployProduction.s.sol` with new deployer key on Base mainnet (8453)
2. Record all deployed contract addresses
3. Verify all contracts on Basescan
4. Transfer ownership of each contract to new Safe

### Phase 4: Migrate State
1. Replicate pairable tokens from old CLPoolLauncher to new
2. Migrate any staking positions
3. Migrate any governance proposals (if active)
4. Update any external integrations (oracles, routers, etc.)

### Phase 5: Lock Down
1. Verify new CLPoolLauncher owner = new Safe
2. Set `paused = false` on new CLPoolLauncher via Safe multisig
3. Renounce old deployer's roles on old contracts (if possible)
4. Mark old contract addresses as deprecated in off-chain systems
5. Test end-to-end: create pool, add pairable token, etc.

### Phase 6: Clean Up
1. Destroy/abandon old deployer key (delete from all systems)
2. Update all documentation with new addresses
3. Store new deployment artifacts in repo
4. Stage new `.env` (never commit private keys)
5. Notify any third-party integrators of address changes

---

## CRITICAL WARNINGS

⚠️ **DO NOT** send any transactions from the compromised deployer key  
⚠️ **DO NOT** approve any pending multisig transactions from unknown sources  
⚠️ **DO NOT** reuse any key material derived from the compromised key  
⚠️ The attacker is actively watching — execute Phase 1 (drain) before announcing redeploy  
⚠️ New deployer key must be generated on a clean machine/air-gapped environment if possible

---

## ADDRESSES TO ABANDON (NEVER USE AGAIN)

```
Compromised Deployer: 0x21E914dFBB137F7fEC896F11bC8BAd6BCCDB147B
Old CLPoolLauncher:   0xb9A1094D614c70B94C2CD7b4efc3A6adC6e6F4d3
Old CLPoolLauncher Safe: 0xE6A41fE61E7a1996B59d508661e3F524d6A32075
```

## ADDRESSES TO KEEP (not compromised)

```
Dev Wallet:           0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E
Binance Multisig:     0x88dB13685836D44964Ce0595E75cA045CF931312
Treasury Safe:        0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e (0 ETH, can reuse or replace)
```
