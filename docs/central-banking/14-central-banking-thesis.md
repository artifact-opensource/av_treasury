---
title: 14 — Central Banking Thesis
date: 2026-06-29
status: draft
description: The core argument that AV Treasury constitutes a decentralized central banking protocol. Covers the three functions of a central bank, how each is implemented on-chain, and the philosophical foundations.
category: central-banking
related: [15-comparison-traditional.md, 01-dual-token-architecture.md, 02-monetary-policy-engine.md, 04-treasury-amo.md, INDEX.md]
---

# 14 — Central Banking Thesis

## 14.1 Thesis Statement

**AV Treasury is a decentralized central banking protocol.** It performs the
three canonical functions of a central bank — currency issuance, monetary
policy, and lender of last resort — through autonomous on-chain contracts
that operate without human discretion, political interference, or institutional
capture.

## 14.2 The Three Functions of a Central Bank

### 14.2.1 Currency Issuance

**Traditional:** Central banks mint fiat currency and manage its distribution
through commercial banking systems.

**AV Treasury:** TreasuryAMO mints Au (Artifact Utility) against deposited
collateral. Every Au is backed by on-chain reserves (ETH, stablecoins,
yield-bearing assets). Minting is algorithmic — no human discretion.

**Key difference:** Traditional central banks can print without limit. AV
Treasury can only mint against collateral. This is a **hard constraint**,
not a policy choice.

### 14.2.2 Monetary Policy

**Traditional:** Central banks set interest rates and manage money supply
through open market operations, reserve requirements, and discount windows.

**AV Treasury:** The PID Controller adjusts Ag emission rates based on the
gap between target TVL and actual TVL. This is equivalent to adjusting
the "interest rate" (staking APY) to manage economic activity (TVL).

**Key difference:** Traditional monetary policy is discretionary — boards
debate and vote. AV Treasury monetary policy is algorithmic — the PID
computes the optimal response. Governance can tune parameters but cannot
override individual decisions.

### 14.2.3 Lender of Last Resort

**Traditional:** Central banks provide emergency liquidity to solvent but
illiquid institutions during crises.

**AV Treasury:** FlashBuy purchases Au from the open market when price
falls below NAV, using treasury reserves. This provides a **soft price
floor** and exit liquidity during market stress.

**Key difference:** Traditional LOLR requires judgment (is this institution
solvent?). FlashBuy is purely algorithmic (is price < NAV?). No discretion,
no moral hazard from subjective judgment.

## 14.3 Additional Central Banking Functions

### 14.3.1 Foreign Exchange Reserve Management

**Traditional:** Central banks manage FX reserves to stabilize currency.

**AV Treasury:** TreasuryAMO manages a diversified reserve portfolio
(ETH, stablecoins, yield-bearing assets) to back Au. The reserve ratio
(60%) ensures over-collateralization.

### 14.3.2 Financial Stability

**Traditional:** Central banks monitor and mitigate systemic risk.

**AV Treasury:** The PID's derivative term provides automatic dampening
of oscillations. The emission floor prevents reward collapse. FlashBuy
provides price support. Together, these form an **automatic stabilizer**
system.

### 14.3.3 Payment System Oversight

**Traditional:** Central banks operate and oversee payment systems.

**AV Treasury:** Au operates on Base (an Ethereum L2), inheriting the
security of the Ethereum consensus layer. Transactions are settled in
~2 seconds with negligible fees.

## 14.4 Philosophical Foundations

### 14.4.1 Rules Over Discretion

The AV Treasury follows a **rules-based approach** to monetary policy with Milton Friedman's k-percent rule and modern inflation
targeting frameworks. The PID controller IS the rule — it cannot be
overridden by governance in individual cases.

Governance can change the rule (PID parameters), but only through a
transparent, timelocked process with exit rights for participants.

### 14.4.2 Transparency by Default

Traditional central banks publish minutes with a lag. Their balance
sheets are quarterly. Their deliberations are secret.

AV Treasury operates with **real-time transparency**:
- Every mint, burn, and transfer is on-chain
- Every PID computation is verifiable
- Every governance proposal is public before voting
- Reserves are auditable in real-time

### 14.4.3 Exit Rights

A fundamental principle: **no one is forced to participate.** Users can:
- Withdraw deposits at any time (subject to cooldown)
- Redeem Au for underlying collateral
- Sell Ag on the open market
- Cancel participation in governance

This distinguishes AV Treasury from traditional central banking, where
capital controls and legal tender laws can trap participants.

### 14.4.4 Credible Commitment

The protocol's constraints are **credible** because they are enforced by
code, not by promise:
- Au supply cap: enforced in smart contract
- Reserve ratio: enforced in minting logic
- PID parameters: changeable only through timelocked governance
- FlashBuy triggers: purely algorithmic

No "temporary" emergency measures. No "one-time" bailouts. The rules
apply equally in all conditions.

## 14.5 The Case for On-Chain Central Banking

### 14.5.1 Speed

Traditional monetary policy operates on quarterly cycles. AV Treasury
updates every 5 days. In a 24/7 global market, faster policy response
means better stability.

### 14.5.2 Global Access

Traditional central banking is jurisdiction-bound. AV Treasury is
permissionless — anyone with an internet connection can participate.

### 14.5.3 Composability

AV Treasury's components (Au, Ag, PID, TreasuryAMO) are composable
building blocks. Other protocols can integrate with Au as a
stable-value asset, or with Ag as a governance signal.

### 14.5.4 Reduced Counterparty Risk

Traditional central banking involves layers of intermediaries
(commercial banks, clearing houses, correspondent banks). AV Treasury
is peer-to-contract — no intermediary risk.

## 14.6 Limitations and Honest Disclosures

1. **Scale:** AV Treasury is small compared to national central banks.
   It cannot set macroeconomic policy for a nation-state.

2. **Legal status:** Au is not legal tender. It has no government backing.
   Its value is purely market-determined.

3. **Oracle dependence:** The system depends on oracle infrastructure.
   Oracle failure would impair monetary policy.

4. **Smart contract risk:** Code bugs could cause catastrophic failure.
   Formal verification mitigates but does not eliminate this risk.

5. **Governance capture:** If a single entity accumulates majority Ag,
   they could change parameters maliciously. Economic incentives make
   this expensive but not impossible.

6. **No fiscal policy:** AV Treasury cannot tax or spend. It is a
   monetary authority only, not a full government.

## 14.7 Conclusion

AV Treasury is not a metaphor for central banking. It is a functional
implementation of central banking primitives — currency, policy, and
lender-of-last-resort — in decentralized form. It is smaller, faster,
more transparent, and more accessible than traditional central banking.
It is also more limited in scope and untested at scale.

The question is not whether it is "as good as" the Federal Reserve.
The question is whether it provides **useful central banking functions**
for a decentralized economy. The answer, we believe, is yes.
