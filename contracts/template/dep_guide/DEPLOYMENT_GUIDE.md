# AV Token — Complete Deployment Guide & Lessons Learned

> **Version:** 2.0.0
> **Date:** 2026-06-23
> **Network:** Base Mainnet (chainId 8453)
> **Status:** All 8 Contracts Live and Verified

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Deployment Timeline](#2-complete-deployment-timeline)
3. [All Deployment Attempts — What Went Wrong](#3-all-deployment-attempts--what-went-wrong)
4. [Final Successful Deployment — What Was Different](#4-final-successful-deployment--what-was-different)
5. [Deploy Scripts — Evolution & Comparison](#5-deploy-scripts--evolution--comparison)
6. [Configuration Pitfalls](#6-configuration-pitfalls)
7. [Constructor Arguments & Wiring](#7-constructor-arguments--wiring)
8. [Verification Issues & Solutions](#8-issues--solutions)
9. [Gas Costs & Optimization Lessons](#9-gas-costs--optimization-lessons)
10. [Security Issues Discovered](#10-security-issues-discovered)
11. [The V1 Security Breach — Full Post-Mortem](#11-the-v1-security-breach--full-post-mortem)
12. [OPSEC Lessons for V2](#2-opsec-lessons-for-v2)
13. [Environment Variables Template](#13-environment-variables-template)
14. [Pre-Deployment Checklist](#14-pre-deployment-checklist)
15. [Post-Deployment Checklist](#15-post-deployment-checklist)
16. [Contract Addresses (V2 Production)](#16-contract-addresses-v2-production)

---

## 1. Executive Summary

The AV Token system has undergone two major deployment phases:

- **V1 (June 17, 2026):** Single-contract `AVToken_Final.sol` deployed to Base Mainnet. **Compromised within hours** via private key theft → EIP-7702 drain contract attack. 55M AV tokens permanently trapped, LP NFT stolen, contract ownership hijacked.

- **V2 (June 22, 2026):** Complete redeployment with 8-contract suite (AuToken, AgToken, MockLPNFT, TimelockController, AVLPStaking_v2, PID_Emission_Controller_v2, TreasuryAMO, GovernorContract). **All contracts deployed, verified, and wired successfully.** 17/17 post-deploy checks passed.

This guide captures every lesson from both attempts to ensure future deployments avoid all known pitfalls.

---

## 2. Complete Deployment Timeline

### V1 — The Compromised Deployment

| Time (UTC) | Event |
|---|---|
| ~2026-06-16 | `AVToken_Final.sol` compiled and deployed to Base Mainnet from `0x21E9...147B` |
| 2026-06-17 05:00:11 | **ATTACK:** Private key compromised. Attacker transfers LP NFT, calls `transferOwnership()`, sets EIP-7702 delegation to drain contract |
| 2026-06-17 ~05:00+ | Attacker returns ~999M AV to Binance wallet (motivation unclear) |
| 2026-06-17 ~18:00 | Compromise discovered |
| 2026-06-17 ~19:00 | EIP-7702 delegation discovered via `eth_getCode` |
| 2026-06-17 ~23:00 | All recovery attempts exhausted — 55M AV permanently trapped |
| 2026-06-18 | Redeployment planning begins |

### V2 — The Successful Redeployment

| Time (UTC) | Event |
|---|---|
| 2026-06-18 to 2026-06-21 | New 8-contract architecture designed and implemented |
| 2026-06-22 | Full test suite passed locally |
| 2026-06-22 ~17:08 | **V2 DEPLOYMENT:** All 8 contracts deployed to Base Mainnet from `0xEc2b...Fa7E` |
| 2026-06-22 ~17:08+ | All 8 contracts verified on Etherscan V2 / BaseScan |
| 2026-06-22 ~17:08+ | Wiring complete: Timelock roles, MINTER_ROLE grants, reward rates set |
| 2026-06-22 ~17:08+ | Minting complete: 1B Au distributed (999M deployer, 300K staking, 700K treasury) |
| 2026-06-22 ~17:08+ | 17/17 post-deploy checks passed |
| 2026-06-22 | Commit pushed to master |

---

## 3. All Deployment Attempts — What Went Wrong

### Attempt 1: V1 Single-Contract Deployment (COMPROMISED)

**What was deployed:** `AVToken_Final.sol` — a single ERC-20 contract with flash loan and staking built in.

**What went wrong:**

1. **Single private key as sole admin:** The deployer wallet `0x21E9...147B` had full ownership with no multisig, no timelock, no role separation. One key compromise = total loss.

2. **No monitoring:** The compromise wasn't discovered for ~13 hours. Real-time alerting for ownership transfers, EIP-7702 delegations, or large asset movements would have enabled faster response.

3. **EIP-7702 attack surface unknown:** The team was unaware that EIP-7702 (activated in Pectra hardfork, May 2025) could be weaponized to permanently delegate a wallet to a drain contract. No detection or prevention was in place.

4. **No contract verification of the threat:** The drain contract's bytecode (9,973 bytes) contained function selectors for ERC-20, ERC-721, and ERC-1155 transfers, plus an embedded collection wallet. This was a sophisticated, premeditated attack.

5. **Recovery impossible:** The EIP-7702 delegation created a perfect deadlock:
   - Need ETH for gas → ETH drained by contract
   - Need to send TX from wallet → Drain contract code executes
   - Flashbots doesn't support Base
   - All RPCs route to same sequencer
   - Bot can always outbid with higher gas

6. **Architecture too monolithic:** Single contract meant single point of failure. No upgrade path, no role separation, no governance.

### Attempt 2: V1 Recovery Attempts (ALL FAILED)

| Approach | Why It Failed |
|---|---|
| Send ETH for gas | EIP-7702 drain contract intercepts at protocol level |
| Flashbots/MEV bundle | Flashbots doesn't support Base chain |
| Blocknative private TX | Service shut down by Deloitte |
| Alternative RPC endpoints | All route to Base's single sequencer |
| Multi-RPC broadcast | Bot monitors sequencer, not specific RPC |
| Higher gas price | Bot has private key, can always outbid |
| Race condition (ETH + transfer) | Drain executes at protocol level, before user code |
| Meta-transactions | AVToken doesn't support EIP-2771 |

---

## 4. Final Successful Deployment — What Was Different

The V2 deployment succeeded because of fundamental architectural and operational changes:

### Architectural Changes

1. **8-contract modular suite** instead of single monolithic contract:
   - `AuToken` — Utility token with fee mechanism
   - `AgToken` — Governance token with voting
   - `MockLPNFT` — LP position NFT
   - `ArtifactTimelock` — 48h governance timelock
   - `AVLPStaking_v2` — LP staking with dual rewards
   - `PID_Emission_Controller_v2` — Algorithmic Ag emission
   - `TreasuryAMO` — Automated market operations
   - `GovernorContract` — DAO governance

2. **UUPS proxy pattern** for upgradeability with role-based access control

3. **Role separation:** MINTER_ROLE, ANTI_BOT_ROLE, DEFAULT_ADMIN_ROLE, UPGRADER_ROLE — no single role can do everything

4. **TimelockController** with 48h delay for governance operations

5. **Two-step admin transfer** on PID controller (transferAdmin/acceptAdmin)

### Operational Changes

1. **New deployer wallet** (`0xEc2b...Fa7E`) — clean key, never used before

2. **Treasury multisig** (`0x1082...9F9e`) as fee recipient and admin

3. **Fee-disabled initial distribution:** Transfer fees set to 0 during minting/distribution, then enabled to 9 bps after. This prevents fee-on-transfer from reducing balances below targets during the critical distribution phase.

4. **Comprehensive post-deploy checks:** 17 automated checks covering supply, balances, roles, and contract wiring

5. **All contracts verified immediately** on Etherscan V2 before considering deployment complete

### Key Code Difference: Fee Handling

```solidity
// V2: Fees disabled during initial distribution
await au.setTransferFeeBps(0);  // Disable fees
await au.mint(deployer.address, AU_SUPPLY);
await au.transfer(A.stk, STAKING_FUND);
await au.transfer(treasury, OPS_TREASURY);
await au.setTransferFeeBps(9);  // Enable: 9 bps (0.09%)
```

This was critical because V1's fee-on-transfer would have burned tokens during distribution, making it impossible to achieve exact target balances.

---

## 5. Deploy Scripts — Evolution & Comparison

### V1 Scripts (av_token_sync/)

| File | Purpose | Status |
|---|---|---|
| `deploy_av.cjs` | Deploy AV contract via Hardhat | ⚠️ Compromised |
| `deploy.cjs` | Deploy AVToken_Final via ethers.js | ⚠️ Compromised |
| `deploy_final_v2.cjs` | Same as deploy.cjs (duplicate) | ⚠️ Compromised |
| `check_rpc.js` | Verify RPC connectivity | ✅ Useful |
| `check.js` | Local Hardhat test deploy + verify | ✅ Useful |
| `run_tests.js` | Local test suite | ✅ Useful |
| `transfer_tokens.js` | Post-deploy token transfer | ⚠️ Requires AV_ADDRESS env |
| `hardhat.config.js` | Network config (Infura RPC) | ⚠️ Contains Infura key |

**V1 Problems:**
- Used `PRIVATE_KEY_BASE` env var name (inconsistent with V2)
- No env validation beyond existence check
- No deployer/key mismatch detection
- No post-deploy verification
- No wiring step
- No gas tracking

### V2 Script (deploy_mainnet.js)

**V2 Improvements:**
- Validates `DEVELOPER_WALLET_PRIVATE_KEY` derives to `DEVELOPER_WALLET_ADDRESS`
- Checks deployer has minimum 0.0005 ETH balance
- 8-step deploy with progress indicators
- Automatic wiring (Timelock roles, MINTER_ROLE grants, reward rates)
- Fee-disabled distribution pattern
- 17 post-deploy automated checks
- Gas tracking (total gas used + ETH cost)
- Saves deployment JSON with all addresses and check results
- Built-in Etherscan verification for all 8 contracts
- 3-second delay between verifications to avoid rate limits

---

## 6. Configuration Pitfalls

### Environment Variables

**V1 used inconsistent naming:**
```bash
# V1 (av_token_sync)
RPC_URL_BASE=...
PRIVATE_KEY_BASE=...
```

**V2 uses clear, validated naming:**
```bash
# V2 (artifact-virtual/token)
DEVELOPER_WALLET_PRIVATE_KEY=...  # No 0x prefix (script adds it)
DEVELOPER_WALLET_ADDRESS=...      # Validated against key derivation
SAFE_TREASURY_ADDRESS=...         # Treasury multisig
RPC_URL_BASE=...                  # Base mainnet RPC
```

**Critical:** V2 script validates that the private key actually derives to the declared address. This prevents the catastrophic mistake of deploying with the wrong key.

### Hardhat Config

**V1 hardhat.config.js:**
```javascript
solidity: "0.8.26",
networks: {
  base: {
    url: "https://base-mainnet.infura.io/v3/0a85c39f1eef437cb0bfa7c172e871c8",
    chainId: 8453,
  },
}
```

**Pitfalls:**
- Infura project ID committed to repo (security risk)
- No gas price configuration
- No optimizer settings specified in config (must be in hardhat.config or foundry.toml)

**V2 uses Solidity 0.8.20** (not 0.8.26) for broader compatibility and optimizer stability.

### Common Env Pitfalls

1. **Private key with/without 0x prefix:** V2 script handles both (`devKey.startsWith("0x") ? devKey : "0x" + devKey`). V1 scripts did not — would fail silently or produce wrong address.

2. **Missing SAFE_TREASURY_ADDRESS:** V2 requires this. V1 had no treasury concept.

3. **Infura/Alchemy rate limits:** Free tier can be insufficient for 8-contract deployment + verification. Use paid tier or multiple RPC endpoints as fallback.

4. **BaseScan API key:** Required for verification. Get from https://basescan.org/myapikey. V1 hardhat config had placeholder.

---

## 7. Constructor Arguments & Wiring

### Deployment Order (CRITICAL — dependencies must be respected)

```
1. AuToken              → no deps
2. AgToken              → no deps
3. MockLPNFT            → no deps
4. TimelockController   → no deps (but needs deployer/canceler/executor)
5. AVLPStaking_v2       → needs Au, Ag, NFT
6. PID Controller       → needs admin (setAu/setAg/setStaking after)
7. TreasuryAMO          → needs Au, USDC, Router, admin
8. GovernorContract     → needs Ag, Timelock
```

### Constructor Arguments Per Contract

| Contract | Constructor Args | Notes |
|---|---|---|
| AuToken | None (proxy pattern) | Initialize with `initialize(treasury)` |
| AgToken | None (proxy pattern) | Initialize with `initialize(deployer)` |
| MockLPNFT | `"AV LP"`, `"AVLP"` | Name and symbol |
| ArtifactTimelock | `deployer`, `deployer`, `deployer` | proposer, canceler, executor |
| AVLPStaking_v2 | None (proxy pattern) | Initialize with `initialize(au, ag, nft)` |
| PID_Emission_Controller_v2 | `deployer` | Admin address |
| TreasuryAMO | `au`, `USDC`, `router`, `deployer` | Au token, USDC, Aerodrome router, admin |
| GovernorContract | `ag`, `timelock` | Ag token, Timelock controller |

### Wiring Steps (Post-Deploy, BEFORE minting)

```javascript
// 1. Timelock: Grant Governor PROPOSER + EXECUTOR roles
tl.grantRole(PROPOSER, governor);
tl.grantRole(EXECUTOR, governor);

// 2. AgToken: Grant MINTER_ROLE to Staking + PID
ag.grantRole(MINTER_ROLE, staking);
ag.grantRole(MINTER_ROLE, pid);

// 3. Staking: Set reward rates (48h delay before active)
staking.setRewardRates(AU_PER_BLOCK, AG_PER_BLOCK);

// 4. PID: Configure tokens and staking reference
pid.setAuToken(au);
pid.setAgToken(ag);
pid.setStaking(staking);
pid.setTargetTVL(10_000_000e18);
```

### Common Wiring Mistakes

1. **Forgetting to grant MINTER_ROLE:** Without this, Staking and PID cannot mint Ag tokens. Staking rewards will fail.

2. **Setting reward rates before wiring:** Reward rates have a 48h timelock. Set them immediately after wiring so the delay starts as early as possible.

3. **Wrong constructor argument order:** TreasuryAMO takes `(auToken, reserveToken, primaryRouter, backupRouter)`. Swapping reserveToken and router would brick the contract.

4. **Not initializing proxy contracts:** AuToken, AgToken, AVLPStaking_v2 use proxy patterns. Calling functions on uninitialized proxies will fail or behave unexpectedly.

---

## 8. Verification Issues & Solutions

### Etherscan V2 Verification

V2 uses the new Etherscan V2 API: `https://api.etherscan.io/v2/api?chainid=8453`

**Verification parameters per contract:**

| Contract | Contract Path | Constructor Args |
|---|---|---|
| AuToken | `contracts/av_suite/AuToken.sol:AuToken` | `[]` (proxy — no constructor args) |
| AgToken | `contracts/av_suite/AgToken.sol:AgToken` | `[]` |
| MockLPNFT | `contracts/av_suite/MockLPNFT.sol:MockLPNFT` | `["AV LP", "AVLP"]` |
| ArtifactTimelock | `contracts/av_suite/TimelockController.sol:ArtifactTimelock` | `[deployer, deployer, deployer]` |
| AVLPStaking_v2 | `contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2` | `[]` |
| PID Controller | `contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2` | `[deployer]` |
| TreasuryAMO | `contracts/av_suite/TreasuryAMO.sol:TreasuryAMO` | `[au, USDC, router, deployer]` |
| GovernorContract | `contracts/av_suite/GovernorContract.sol:GovernorContract` | `[ag, timelock]` |

### Common Verification Failures

1. **"Already Verified"** — Not an error. The script handles this case and counts it as success.

2. **Compiler mismatch** — Ensure the compiler version in Hardhat config matches what was used to compile. V2 uses `0.8.20+commit.a1b79de6`.

3. **Optimizer mismatch** — V2 uses optimizer enabled with 200 runs. Must match exactly.

4. **Constructor args encoding** — ABI-encoded constructor args must be exact. Even one wrong byte causes verification failure.

5. **Rate limiting** — Etherscan allows ~5 verifications per second. The V2 script adds 3-second delays between verifications.

6. **EVM version** — V2 targets `paris` EVM version. Must match in verification settings.

### Verification GUIDs

The file `verification_guids.json` contains unique identifiers for each verified contract. These are used by the deployment system to track verification status across sessions.

---

## 9. Gas Costs & Optimization Lessons

### V2 Deployment Gas Costs

| Metric | Value |
|---|---|
| Total gas used | ~412,201,233,890,381,588,607,202,378,429,857,732,066,203,250,833,444,349,66 (raw) |
| Total ETH cost | **0.000152225331908087 ETH** |
| Deployer balance after | 0.001940419894758365 ETH |
| Gas price context | Base L2 — extremely low gas costs |

### Key Gas Lessons

1. **Base L2 is extremely cheap:** The entire 8-contract deployment + wiring + minting cost less than 0.0002 ETH. This is because Base is an optimistic rollup with minimal L1 data costs for contract deployments.

2. **Proxy patterns save gas:** Using UUPS proxies means only the proxy deployment is expensive. Logic contract upgrades don't require redeploying storage.

3. **Optimizer settings matter:** 200 runs is the sweet spot for V2. Higher values increase compilation time without meaningful gas savings for these contract sizes.

4. **Contract size limits:** All V2 contracts are under the 24,576-byte EVM limit. The largest contract is ~24,255 bytes.

5. **Batch operations:** The deploy script batches all operations in a single run. This minimizes the number of transactions and total gas.

6. **Gas limit overrides:** The V2 script sets explicit gas limits for each transaction type:
   - Deploy: default (auto-estimated)
   - Initialize: 500,000 gas
   - Grant role: 100,000 gas
   - Transfer: 300,000 gas
   - Mint: 500,000 gas

---

## 10. Security Issues Discovered

### From V1 Breach

1. **EIP-7702 Wallet Delegation Attack** (CRITICAL)
   - First known real-world EIP-7702 attack
   - Attacker delegated compromised wallet to a drain contract
   - Creates permanent, protocol-level deadlock
   - Cannot be detected by traditional security tools
   - Cannot be reversed without sending TX from compromised wallet
   - **Mitigation:** Monitor all wallets for EIP-7702 delegation via `eth_getCode`. Use hardware wallets. Use multisig.

2. **Single Private Key as Single Point of Failure** (CRITICAL)
   - One key controlled everything
   - No multisig, no timelock, no role separation
   - **Mitigation:** V2 uses role-based access control, timelock, and multisig treasury

3. **No Real-Time Monitoring** (HIGH)
   - 13+ hour gap between compromise and detection
   - **Mitigation:** Implement automated alerts for ownership transfers, EIP-7702 delegations, and large asset movements

### From V2 Audit (Specter Findings)

4. **AuToken MAX_SUPPLY Cap** (LOW)
   - AuToken has no explicit `MAX_SUPPLY` constant
   - Initial mint is 1B but UUPS upgrade could add minting
   - **Mitigation:** Add explicit `MAX_SUPPLY` constant and enforce in any future mint functions

5. **No TWAP Oracle for Initial Price** (MEDIUM)
   - TreasuryAMO references TWAP for buyback validation
   - At deployment, no TWAP history exists
   - **Mitigation:** Ensure sufficient TWAP history before enabling buybacks

### General Security Lessons

6. **Blind Signing Risk** — Always verify transaction details on hardware wallet screen, not computer screen

7. **Phishing via EIP-7702 Authorization** — Users can be tricked into signing EIP-7702 authorizations that delegate their wallet to malicious contracts

8. **Supply Discrepancy** — V1 reported ~1.054B tokens (999M returned + 55M trapped) exceeding 1B max supply. Possible causes: thief minted additional tokens, approximate figures, or supply tracking bug.

---

## 11. The V1 Security Breach — Full Post-Mortem

### Attack Vector

1. Attacker obtained private key of `0x21E9...147B` (vector unknown — possibly malware, phishing, or seed phrase leak)
2. Attacker deployed drain contract `0xd7d2...a915` (9,973 bytes) with embedded collection wallet `0x14F9...acaD`
3. Attacker sent EIP-7702 authorization (type 0x04 TX) to delegate compromised wallet to drain contract
4. Wallet code became: `0xef0100d7d20e03c9793bd1b63291eea0021c8cc096a915`

### Assets Lost

| Asset | Amount | Status |
|---|---|---|
| AV Tokens (recovered) | ~999,000,000 | ✅ Returned to Binance |
| AV Tokens (trapped) | ~55,000,000 | ❌ Permanently inaccessible |
| Uniswap V4 LP NFT | TokenID 2594277 | ❌ In attacker's wallet |
| AVToken Ownership | Full control | ❌ Attacker-controlled |
| EIP-7702 Delegation | Active | ❌ Permanent drain mechanism |

### Attacker Wallets

| Label | Address | Chain | Holdings |
|---|---|---|---|
| Compromised Wallet | `0x21E9...147B` | Base | 55M AV (trapped) |
| Thief LP-NFT Wallet | `0x0953...659c` | Base | LP NFT + 0.005 ETH |
| Thief Collection Wallet | `0x14F9...acaD` | Multi-chain | ~$108 across chains |
| Drain Contract | `0xd7d2...a915` | Base | 0 ETH (forwards immediately) |

### Why Recovery Failed (All 7 Attempts Documented)

1. **Send ETH for gas** → Drained by EIP-7702 at protocol level
2. **Flashbots bundle** → Doesn't support Base
3. **Blocknative private TX** → Service shut down
4. **Alternative RPCs** → All route to same sequencer
5. **Multi-RPC broadcast** → Bot monitors sequencer level
6. **Higher gas price** → Bot has key, can always outbid
7. **Race condition** → Drain executes at protocol level

---

## 12. OPSEC Lessons for V2

Based on the comprehensive `opsec.policy` and breach analysis:

### Key Management

1. **Never reuse compromised keys** — V2 uses entirely new deployer wallet
2. **Hardware wallets mandatory** for any key with admin roles
3. **Shamir's Secret Sharing** (3-of-5) for seed phrase backup
4. **No digital copies** of seed phrases — steel plates only
5. **Dedicated signing devices** — no shared hardware wallets

### Operational Security

1. **4-of-7 multisig** for treasury operations (from opsec.policy)
2. **Geographic distribution** — signers on 3+ continents
3. **48h timelock** on all governance operations
4. **Transaction review** — minimum 4 signers review before execution
5. **No discussion of keys/seeds** in any digital channel
6. **Dedicated signing computers** — clean OS, no general browsing

### Monitoring

1. **Real-time EIP-7702 detection** — `eth_getCode` should return `0x` for all EOAs
2. **Ownership transfer alerts** — immediate notification
3. **Large asset movement alerts** — threshold-based
4. **Weekly transaction reports** published to governance

### Incident Response

1. **Key compromise:** Immediate notification → key rotation → investigation
2. **Multisig compromise:** Emergency pause → migration to new multisig
3. **Social engineering:** Containment → credential rotation → community notification

---

## 13. Environment Variables Template

```bash
# ============================================
# AV Token V2 — Deployment Environment
# ============================================
# COPY TO .env AND FILL IN VALUES
# NEVER COMMIT .env TO GIT

# Network
RPC_URL_BASE=https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY
# Alternative: https://mainnet.base.org (public, rate-limited)

# Deployer Wallet (NEW — never used before)
# Private key WITHOUT 0x prefix (script adds it)
DEVELOPER_WALLET_PRIVATE_KEY=<64_CHAR_HEX_NO_0x>
DEVELOPER_WALLET_ADDRESS=0x<DERIVED_FROM_KEY>

# Treasury Multisig (Gnosis Safe)
SAFE_TREASURY_ADDRESS=0x<MULTISIG_ADDRESS>

# Verification
BASESCAN_API_KEY=<YOUR_BASESCAN_API_KEY>

# Optional: Gas Configuration
# GAS_PRICE_GWEI=0.1
# MAX_FEE_PER_GAS=2
# MAX_PRIORITY_FEE_PER_GAS=1
```

**Security notes:**
- Generate a NEW private key for each major deployment
- Use `openssl rand -hex 32` to generate a cryptographically secure key
- Verify the derived address matches before deploying
- Store the key in a hardware wallet after deployment
- Add `.env` to `.gitignore`

---

## 14. Pre-Deployment Checklist

### Code
- [ ] All contracts compile without warnings
- [ ] Test suite passes (transfer, flash loan, staking, governance)
- [ ] Slither/Mythril security scan clean
- [ ] Contract sizes under 24,576 bytes
- [ ] Optimizer settings: enabled, 200 runs
- [ ] Solidity version: 0.8.20
- [ ] EVM version: paris

### Environment
- [ ] `.env` file created with all required variables
- [ ] Private key derives to declared address (script validates)
- [ ] Deployer has ≥ 0.0005 ETH for gas
- [ ] RPC endpoint reachable (`curl -X POST <RPC> -d '{"method":"eth_blockNumber"}'`)
- [ ] BaseScan API key valid
- [ ] `.env` is in `.gitignore`

### Operational
- [ ] Deployer wallet is NEW (never used before)
- [ ] Treasury multisig configured and tested
- [ ] Hardware wallet ready for key storage post-deploy
- [ ] Team notified of deployment window
- [ ] Monitoring alerts configured for post-deploy

---

## 15. Post-Deployment Checklist

### Immediate (same session)
- [ ] 8/8 contracts deployed
- [ ] 8/8 contracts verified on Etherscan V2
- [ ] All constructor arguments correct
- [ ] All proxy contracts initialized

### Wiring
- [ ] Timelock: Governor has PROPOSER_ROLE
- [ ] Timelock: Governor has EXECUTOR_ROLE
- [ ] AgToken: Staking has MINTER_ROLE
- [ ] AgToken: PID has MINTER_ROLE
- [ ] Staking: Reward rates set (48h delay starts)
- [ ] PID: Au token set
- [ ] PID: Ag token set
- [ ] PID: Staking contract set
- [ ] PID: Target TVL set

### Minting & Distribution
- [ ] Fees disabled before distribution
- [ ] 1B Au minted to deployer
- [ ] 300K Au transferred to staking
- [ ] 700K Au transferred to treasury
- [ ] Fees re-enabled (9 bps)
- [ ] Total supply = 1B
- [ ] Deployer balance = 999M
- [ ] Staking balance = 300K
- [ ] Treasury balance = 700K

### Verification
- [ ] All contracts visible on BaseScan
- [ ] Source code verified
- [ ] Constructor args match deployment
- [ ] `deployment_mainnet.json` saved
- [ ] `address_book.md` updated
- [ ] Commit pushed to master

---

## 16. Contract Addresses (V2 Production)

**Network:** Base Mainnet (chainId 8453)
**Deployer:** `0xEc2b8EE9266E0C4540aa9ba2F6637640b019Fa7E`
**Treasury:** `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e`
**Timestamp:** 2026-06-22T17:08:00.676Z

| Contract | Address | Status |
|---|---|---|
| AuToken | `0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f` | ✅ Verified |
| AgToken | `0xC4553019F739Aea58BD5A9d8ea2820951AC6380F` | ✅ Verified |
| MockLPNFT | `0xA2B445169B660a0EB29b8Cd760062351F0B10277` | ✅ Verified |
| TimelockController | `0xB51542d460DBb4336F011CFF3Cbf80faeB3453f7` | ✅ Verified |
| AVLPStaking_v2 | `0x3e26b061eC20392b32dE712132c41bbE43f52556` | ✅ Verified |
| PID_Emission_Controller_v2 | `0x70D3e11aD8274C07ca7D1ABa2e88376c355ed3df` | ✅ Verified |
| TreasuryAMO | `0x4eB2eb2904E8CAEd16eDf0b134bA9Df5170BE23F` | ✅ Verified |
| GovernorContract | `0xaB8b57022309834fcB056B434bb5BbF976351C66` | ✅ Verified |

### External Addresses

| Contract | Address |
|---|---|
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aerodrome Router | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |

---

## Appendix A: Key Differences Between V1 and V2

| Aspect | V1 (Compromised) | V2 (Production) |
|---|---|---|
| Architecture | Single contract | 8-contract modular suite |
| Upgradeability | None | UUPS proxy pattern |
| Access Control | Ownable (single key) | Role-based (RBAC) |
| Governance | None | Governor + Timelock (48h) |
| Token Model | Single token (AV) | Dual token (Au + Ag) |
| Fee Mechanism | Fixed | Configurable (0-500 bps cap) |
| Anti-Bot | None | Blocklist + cooldown + max tx/wallet |
| Flash Loan | Built-in | Separate ERC3156 implementation |
| Staking | Built-in | Separate contract with Ag multiplier |
| Emission | Fixed | PID controller (algorithmic) |
| Treasury | None | TreasuryAMO with automated buybacks |
| Deployer Key | Reused/compromised | New key, never used before |
| Treasury | None | Multisig (4-of-7) |
| Post-Deploy Checks | None | 17 automated checks |
| Verification | Delayed | Immediate (all 8 contracts) |

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| Au | Artifact Utility — the primary utility token (1B supply, deflationary) |
| Ag | Artifact Governance — the governance token (100M max, PID-emitted) |
| UUPS | Universal Upgradeable Proxy Standard — upgradeable contract pattern |
| PID | Proportional-Integral-Derivative — control algorithm for emission rates |
| AMO | Automated Market Operations — treasury buyback mechanism |
| EIP-7702 | Ethereum upgrade allowing EOAs to delegate execution to contracts |
| EIP-2612 | Permit — gasless token approvals via signed messages |
| ERC3156 | Flash loan standard interface |
| TWAP | Time-Weighted Average Price — oracle price validation |
| bps | Basis points — 1 bps = 0.01% |

---

*This document is the definitive reference for AV Token deployment. All lessons learned from both the V1 security breach and V2 successful deployment are captured here. Future deployments should reference this guide as the primary source of truth.*
