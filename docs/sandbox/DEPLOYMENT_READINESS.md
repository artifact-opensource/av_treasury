# AV TREASURY — Deployment Readiness

**Date:** 2026-06-24  
**Scope:** Full deployment pipeline — Testnet → Mainnet  
**Current State:** 90/100 — Testnet Ready, Mainnet Needs LP NFT + Formal Verification  

---

## 1. Readiness Score: 90/100

### 1.1 Score Breakdown

| Category | Score | Max | Notes |
|----------|-------|-----|-------|
| Contract Completeness | 18 | 20 | All layers present; MockLPNFT placeholder |
| Security (Pentest) | 18 | 20 | All medium issues fixed; no formal verification |
| Economic Design | 16 | 20 | Au stability below threshold; mitigated |
| Sandbox Coverage | 15 | 20 | Full flywheel tested; minor signature mismatches |
| Simulation Confidence | 13 | 20 | 10K runs; needs 100K+ for tighter intervals |
| Operational Readiness | 10 | 10 | Compilation, deployment scripts, governance present |
| **TOTAL** | **90** | **100** | |

### 1.2 Readiness Levels

| Level | Score | Status |
|-------|-------|--------|
| Testnet Ready | 85+ | ✅ Achieved |
| Mainnet Ready | 95+ | ⬜ Needs: LP NFT, formal verification, 100K runs |
| Production Live | 98+ | ⬜ Needs: Professional audit, multi-sig, monitoring |

---

## 2. Pre-Deployment Checklist

### 2.1 Compilation & Build

| Step | Status | Command | Notes |
|------|--------|---------|-------|
| Hardhat compile | ✅ | `npx hardhat compile` | 0 errors, 87 Solidity files |
| Foundry build (sandbox) | ✅ | `forge build` | Sandbox contracts compile |
| Size check | ✅ | `npx hardhat size-contracts` | All within 24KB limit |
| License check | ✅ | All files have AGPL-3.0 or MIT | — |

### 2.2 Testing

| Step | Status | Command | Coverage |
|------|--------|---------|----------|
| Unit tests | ⬜ | `npx hardhat test` | Not reviewed |
| Integration tests | ⬜ | `npx hardhat test test/integration/` | Not reviewed |
| Sandbox deploy test | ✅ | `node sandbox/scripts/deploy-sandbox.js` | Deploys to Anvil |
| Stress tests | ✅ | `node sandbox/scripts/stress-test.js` | 100 bots, 10K blocks |
| Fuzz tests | ⬜ | `forge test --fuzz` | Not run |
| Invariant tests | ⬜ | Contender / Foundry | Not run |

### 2.3 Security

| Step | Status | Tool | Notes |
|------|--------|------|-------|
| Pentest (medium+) | ✅ | Specter, Nanobot | All fixed |
| Static analysis | ⬜ | Slither | Not run |
| Symbolic execution | ⬜ | Mythril / Halmos | Not run |
| Formal verification | ⬜ | Certora | Not obtained |
| Access control audit | ✅ | Manual review | All roles verified |
| Reentrancy check | ✅ | Manual review | All protected |

### 2.4 Deployment Scripts

| Script | Network | Status | Notes |
|--------|---------|--------|-------|
| scripts/deploy.js | Base / Base Seppolia | ✅ | 8-step, verified |
| sandbox/deploy-sandbox.js | Anvil (local) | ✅ | 11-step, 100 bots |
| sandbox/DeploySandbox.s.sol | Foundry | ✅ | Foundry version |

### 2.5 Documentation

| Document | Status | Location |
|----------|--------|----------|
| README | ✅ | README.md |
| DEPLOYMENT_ROADMAP | ✅ | DEPLOYMENT_ROADMAP.md |
| DEPLOYMENT_READINESS | ✅ | DEPLOYMENT_READINESS.md |
| ANALYST_REPORT | ✅ | ANALYST_REPORT.md |
| CONTRACT_INVENTORY | ✅ | docs/sandbox/CONTRACT_INVENTORY.md |
| DEPENDENCY_GRAPH | ✅ | docs/sandbox/DEPENDENCY_GRAPH.md |
| ECONOMIC_MODEL | ✅ | docs/sandbox/ECONOMIC_MODEL.md |
| SECURITY_POSTURE | ✅ | docs/sandbox/SECURITY_POSTURE.md |
| SIMULATION_RESULTS | ✅ | docs/sandbox/SIMULATION_RESULTS.md |
| FLYWHEEL_TRACE | ✅ | docs/sandbox/FLYWHEEL_TRACE.md |
| Emergency playbook | ⬜ | Not created | Needs creation |

---

## 3. Deployment Phases

### 3.1 Phase 0 — Tooling Setup (1-2 days)

| Step | Task | Status | Evidence |
|------|------|--------|----------|
| 0.1 | Enable Solidity SMTChecker in Hardhat config | ⬜ | hardhat.config.js updated |
| 0.2 | Install Halmos (a16z/halmos) | ⬜ | pip install halmos |
| 0.3 | Install Contender (flashbots/contender) | ⬜ | npm install contender |
| 0.4 | Install Mythril (ConsenSys/mythril) | ⬜ | pip install mythril |
| 0.5 | Write invariant tests for PID controller | ⬜ | test/pid-invariants.t.sol |
| 0.6 | Write invariant tests for AgToken | ⬜ | test/agtoken-invariants.t.sol |
| 0.7 | Write invariant tests for AuToken | ⬜ | test/autoken-invariants.t.sol |
| 0.8 | Write invariant tests for TreasuryAMO | ⬜ | test/treasuryamo-invariants.t.sol |

### 3.2 Phase 1 — Free Verification (3-5 days, parallel with Phase 2)

| Step | Task | Status | Tool | Evidence |
|------|------|--------|------|----------|
| 1.1 | Run SMTChecker on all 8 contracts | ⬜ | solc built-in | smtchecker-report/ |
| 1.2 | Run Halmos on AgToken | ⬜ | Halmos | halmos-report-agtoken.md |
| 1.3 | Run Halmos on AuToken | ⬜ | Halmos | halmos-report-autoken.md |
| 1.4 | Run Halmos on TreasuryAMO | ⬜ | Halmos | halmos-report-treasuryamo.md |
| 1.5 | Run Halmos on PID_Emission_Controller | ⬜ | Halmos | halmos-report-pid.md |
| 1.6 | Run Contender invariant tests | ⬜ | Contender | contender-report.md |
| 1.7 | Run Mythril security scan on all contracts | ⬜ | Mythril | mythril-report.md |
| 1.8 | Fix all CRITICAL and HIGH findings | ⬜ | — | git commits |
| 1.9 | Re-run verification after fixes | ⬜ | All tools | Updated reports |

### 3.3 Phase 2 — Testnet Deployment (2-4 weeks)

| Step | Task | Status | Evidence |
|------|------|--------|----------|
| 2.1 | Deploy RealLPNFT replacement | ⬜ | contracts/RealLPNFT.sol |
| 2.2 | Deploy all contracts to Arbitrum Sepolia | ⬜ | deploy script, verified contracts |
| 2.3 | Initialize contracts (roles, thresholds, targets) | ⬜ | init script, tx hashes |
| 2.4 | Fund treasury with test USDC | ⬜ | tx hashes |
| 2.5 | Run 30-day simulation on testnet (bots) | ⬜ | simulation report |
| 2.6 | Test buyback execution (keeper bot) | ⬜ | tx hashes |
| 2.7 | Test PID controller (emission distribution) | ⬜ | tx hashes |
| 2.8 | Test staking/unstaking flow (Ag + Au) | ⬜ | tx hashes |
| 2.9 | Test governance proposals through timelock | ⬜ | tx hashes |
| 2.10 | Test emergency pause/unpause | ⬜ | tx hashes |
| 2.11 | Fix any testnet issues | ⬜ | git commits |
| 2.12 | Re-deploy fixed contracts | ⬜ | verified contracts |

### 3.4 Phase 3 — Professional Audit (4-8 weeks)

| Step | Task | Status | Evidence |
|------|------|--------|----------|
| 3.1 | Engage Certora for formal verification | ⬜ | Contract signed |
| 3.2 | Write CVL specifications for all contracts | ⬜ | .spec files |
| 3.3 | Run Certora verification | ⬜ | Certora report |
| 3.4 | Fix any Certora findings | ⬜ | git commits |
| 3.5 | Re-run Certora until all pass | ⬜ | Clean report |
| 3.6 | Engage external audit firm (optional) | ⬜ | Audit report |
| 3.7 | Fix any audit findings | ⬜ | git commits |

### 3.5 Phase 4 — Mainnet Preparation (1-2 weeks)

| Step | Task | Status | Evidence |
|------|------|--------|----------|
| 4.1 | Deploy RealLPNFT to mainnet | ⬜ | Verified contract |
| 4.2 | Deploy all contracts to mainnet | ⬜ | Verified contracts |
| 4.3 | Initialize contracts (production roles, thresholds) | ⬜ | Init tx hashes |
| 4.4 | Transfer ownership to governance (GovernorContract) | ⬜ | tx hash |
| 4.4.1 | Revoke deployer permissions | ⬜ | tx hash |
| 4.5 | Set up keeper bot infrastructure | ⬜ | Bot deployment |
| 4.6 | Set up monitoring (Grafana/Dune dashboards) | ⬜ | Dashboard URLs |
| 4.7 | Set up alerts (Discord/PagerDuty) | ⬜ | Alert configs |
| 4.8 | Set up multisig for treasury management | ⬜ | Safe multisig |
| 4.9 | Prepare emergency response playbook | ⬜ | docs/emergency.md |
| 4.10 | Prepare token listing strategy (CEX/DEX) | ⬜ | Listing plan |

### 3.6 Phase 5 — Mainnet Launch

| Step | Task | Status | Evidence |
|------|------|--------|----------|
| 5.1 | Fund initial treasury | ⬜ | tx hash |
| 5.2 | Enable PID controller (start emissions) | ⬜ | tx hash |
| 5.3 | Enable TreasuryAMO buybacks | ⬜ | tx hash |
| 5.4 | Enable staking (open NFT staking) | ⬜ | tx hash |
| 5.5 | Verify all systems operational | ⬜ | Health check |
| 5.6 | Announce launch (community, socials) | ⬜ | Launch comms |
| 5.7 | Monitor first 24 hours intensively | ⬜ | Monitoring logs |
| 5.8 | Monitor first 7 days actively | ⬜ | Monitoring logs |
| 5.9 | Monitor first 30 days | ⬜ | Monitoring logs |
| 5.10 | Handover to operations team | ⬜ | Handover doc |

### 3.7 Phase 6 — Post-Launch

| Step | Task | Frequency | Evidence |
|------|------|-----------|----------|
| 6.1 | Weekly health reports | First 3 months | Reports |
| 6.2 | Monthly parameter review | Monthly | Governance proposals |
| 6.3 | Quarterly security review | Quarterly | Review reports |
| 6.4 | Continuous monitoring | Continuous | Monitoring |
| 6.5 | Community governance transition | Ongoing | Governance activity |
| 6.6 | Protocol upgrades via governance | As needed | UUPS upgrades |

---

## 4. Network Configuration

### 4.1 Base Mainnet

| Parameter | Value |
|-----------|-------|
| Chain ID | 8453 |
| RPC URL | https://mainnet.base.org |
| Block time | ~2 seconds |
| DEX | Aerodrome (primary), Uniswap V3 (backup) |
| USDC | 0x833589cCDB0a6e3bc84827a6bD4c6b4a7a2eb3e |
| Au Token (v2 deployed) | 0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f |
| Staking (v2 deployed) | 0x3e26b061eC20392b32dE712132c41bbE43f52556 |

### 4.2 Base Sepolia (Testnet)

| Parameter | Value |
|-----------|-------|
| Chain ID | 84532 |
| RPC URL | https://sepolia.base.org |
| Block time | ~2 seconds |
| DEX | Aerodrome Sepolia |
| USDC | Testnet faucet required |

### 4.3 Local (Anvil/Ganache)

| Parameter | Value |
|-----------|-------|
| Chain ID | 1337 |
| RPC URL | http://127.0.0.1:8545 |
| Block time | Instant (Anvil) or configurable (Ganache) |
| Mnemonic | test test test test test test test test test test test junk |

---

## 5. Environment Variables

### 5.1 Required for Deployment

| Variable | Purpose | Example |
|----------|---------|---------|
| DEPLOYER_PRIVATE_KEY | Deployer wallet | 0x... |
| BASE_RPC_URL | Base mainnet RPC | https://mainnet.base.org |
| BASE_SEPOLIA_RPC_URL | Base Sepolia RPC | https://sepolia.base.org |
| DEVELOPER_WALLET_ADDRESS | Admin/timelock proposer | 0x... |
| MULTISIG_1_ADDRESS | First multisig signer | 0x... |
| MULTISIG_2_ADDRESS | Second multisig signer | 0x... |
| SAFE_TREASURY_ADDRESS | Gnosis Safe treasury | 0x... |
| ETHERSCAN_API_KEY | Basescan verification | ... |
| USDC_BASE_ADDRESS | USDC on Base | 0x833589cCDB0a6e3bc84827a6bD4c6b4a7a2eb3e |
| AERODROME_ROUTER_ADDRESS | Aerodrome router | 0x4752bA5Db23f44F6821471A762f7D6f2d65F10B9 |

### 5.2 Deployment Configuration

```javascript
// scripts/deploy.js CONFIG
const CONFIG = {
  TIMELOCK_DELAY: 2 * 24 * 3600,  // 48 hours
  PID_TVL_TARGET: parseEther("10000000"),  // $10M
  PID_KP: parseEther("0.0001"),
  PID_KI: parseEther("0.00001"),
  PID_KD: parseEther("0.00005"),
  AG_THRESHOLD: parseEther("1000"),
  RESERVE_TOKEN_ADDRESS: USDC,
  BUYBACK_PCT: 12,
  MIN_BUYBACK_USD: 500,
  MAX_BUYBACK_EPOCH_BPS: 500,  // 5%
};
```

---

## 6. Known Deployment Issues

### 6.1 Pre-Deployment Issues

| Issue | Severity | Fix |
|-------|----------|-----|
| MockLPNFT is placeholder | HIGH | Replace with RealLPNFT before mainnet |
| No formal verification | LOW | Run Certora after testnet |
| Sandbox buyback model differs | MEDIUM | Add mock USDC to sandbox |
| MockStaking missing min stake | MEDIUM | Add to MockStaking for accurate testing |
| DexSimulator missing `to` param | MEDIUM | Add `to` parameter to swap functions |

### 6.2 Deployment Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gas price spike | Medium | Medium | Use gas price oracle, wait for low gas |
| Front-run attack | Low | High | Use private mempool (Flashbots) |
| Constructor arg error | Low | Critical | Verify all args before deploy |
| Insufficient ETH for gas | Low | High | Fund deployer with 10+ ETH |
| RPC failure | Low | Medium | Use multiple RPC providers |

---

## 7. Post-Deployment Verification

### 7.1 Immediate Checks (Within 1 hour)

| Check | Method | Expected |
|-------|--------|----------|
| All contracts deployed | Basescan | 8 contracts visible |
| Contract verified | Basescan | All source code verified |
| Roles configured | cast call | DEFAULT_ADMIN = Timelock |
| Au totalSupply | cast call | 1,000,000,000 * 1e18 |
| Ag totalSupply | cast call | 0 (no emissions yet) |
| PID target | cast call | 500,000 (bootstrap start) |
| TreasuryAMO balance | cast call | Funded amount |
| Staking rates | cast call | Configured rates |

### 7.2 24-Hour Checks

| Check | Method | Expected |
|-------|--------|----------|
| First PID emission | Event logs | AgEmitted event emitted |
| First staking entry | Event logs | StakedNFT event emitted |
| First buyback | Event logs | BuybackExecuted event emitted |
| Governance proposal | Event logs | ProposalCreated event emitted |
| No unexpected reverts | Error monitoring | Zero unexpected reverts |
| Gas costs | Gas tracker | Within expected range |

### 7.3 7-Day Checks

| Check | Method | Expected |
|-------|--------|----------|
| TVL growth | Dashboard | Positive trend |
| Au price stability | DEX monitoring | Within expected range |
| Ag supply growth | Cast call | Matches PID emission model |
| Treasury health | Cast call | Above 6-month runway |
| Bot activity (sandbox) | Logs | 100 bots active |
| Governance activity | Event logs | At least 1 proposal |

---

## 8. Rollback Plan

### 8.1 Rollback Triggers

| Trigger | Action | Decision Maker |
|---------|--------|---------------|
| Critical vulnerability found | Emergency pause all contracts | Multisig / DEFAULT_ADMIN |
| TVL drops > 50% in 24h | Pause PID, assess | Multisig |
| Au price drops > 30% in 24h | Pause buybacks, assess | Multisig |
| Governance attack detected | Pause Governor, cancel proposals | Multisig |
| Unexplained emission spike | Emergency stop PID | Multisig |

### 8.2 Rollback Procedure

```
1. PAUSE: Call pause() on all pausable contracts
2. ASSESS: Determine root cause (logs, events, state)
3. FIX: Deploy fix if code issue, or configure if parameter issue
4. UNPAUSE: Call unpause() after fix verified
5. MONITOR: 24-hour intensive monitoring
6. DOCUMENT: Post-mortem report
```

---

## 9. Deployment Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 0: Tooling | 1-2 days | None |
| Phase 1: Verification | 3-5 days | Phase 0 |
| Phase 2: Testnet | 2-4 weeks | Phase 1 |
| Phase 3: Audit | 4-8 weeks | Phase 2 |
| Phase 4: Mainnet Prep | 1-2 weeks | Phase 3 |
| Phase 5: Launch | 1 day | Phase 4 |
| Phase 6: Post-Launch | Ongoing | Phase 5 |
| **TOTAL** | **2-4 months** | — |

---

*Document: DEPLOYMENT_READINESS.md*  
*Date: 2026-06-24*  
*Repository: av_treasury (commit: 297370f)*
