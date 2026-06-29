---
title: AV Treasury — Vision & Thesis
date: 2026-06-29
status: final
description: Central banking vision and macroeconomic thesis for the AV Treasury protocol.
category: whitepaper
related: [whitepaper.md, ../technical/deployment-plan.md, ../sim/index.md]
---

# AV Treasury — Vision

> **HISTORICAL DOCUMENT:** This vision describes the original design
> including veAg lock-weighted governance and RSBT soulbound tokens. The
> deployed system uses AgToken (ERC20Votes) for governance and
> QuasiCrystalLPNFT (ERC-721) for LP positions. See
> [docs/central-banking/](../central-banking/index.md) for current specs.

> A decentralized central banking protocol for the on-chain economy.
> The why behind every contract, every mechanism, every line of code.

---

## I. The Problem

DeFi has a monetary policy problem.

Since the inception of on-chain finance, the ecosystem has been running on monetary primitives borrowed from an earlier era: fixed-supply tokens, inflationary rewards, algorithmic pegs that break under stress, and governance by multisig. These mechanisms were necessary first steps — the training wheels of a new financial system. But training wheels are not a drivetrain.

The current landscape reveals the cracks:

**Stablecoins are not sovereign currency.** USDC, DAI, and their descendants are remarkable innovations, but they are not autonomous monetary systems. They are liabilities of issuers, dependent on off-chain reserves, centralized attestation, and the continued goodwill of institutions. When the issuer freezes, the peg breaks. When the issuer bank fails, the stablecoin depegs. The user holds a promise, not a protocol.

**Governance is theater in most protocols.** Token-weighted voting with low quorum, whale-dominated outcomes, and executable code that can be bypassed by multisig is not governance — it is decoration. The "decentralized" label is applied to systems where a small team can rug, pause, or redirect at will. This is not a failure of intent; it is a failure of architecture.

**Emissions are blind.** Most protocols emit tokens on a fixed schedule regardless of whether the economy needs inflation or contraction. There is no feedback loop between the state of the system and the rate of issuance. It is as if the Federal Reserve printed dollars on a calendar schedule without looking at unemployment, GDP, or inflation. The result is predictable: mercenary capital, token dumping, and death spirals.

**There is no lender of last resort.** When a DeFi protocol faces a liquidity crisis, there is no backstop. There is no institution that can inject liquidity, stabilize markets, and prevent contagion. The system either finds a white knight or it dies. This fragility is unacceptable for any system that aspires to be financial infrastructure.

**Value capture is an afterthought.** Most protocols do not systematically capture the value they generate. Fees exist but are poorly directed. Treasury management is manual. Buybacks are announced as marketing and executed sporadically. There is no closed-loop system that recycles value from usage back into the health of the protocol.

The cumulative effect is an ecosystem that is sophisticated in its smart contracts but primitive in its monetary policy. We have built the equivalent of a high-frequency trading desk and handed it to a committee that meets once a month to set interest rates by hand.

DeFi does not need another stablecoin. DeFi does not need another DEX. DeFi needs a central bank — one that runs on code, not committees; one that operates 24/7, not during business hours; one that is governed by its participants, not by a foundation in Zug.

---

## II. The AV Treasury as Central Bank

The AV Treasury is that central bank.

Imagine a fully autonomous, fully decentralized monetary authority operating on-chain. No board of governors. No emergency meetings. No press conferences. Just code — executing monetary policy with the precision of a PID controller, the transparency of a public blockchain, and the resilience of a system with no single point of failure.

This is not a metaphor. The AV Treasury is not "like" a central bank. It *is* a central bank in every functional sense. To understand why, we must map the traditional architecture of monetary authority to its on-chain equivalent — component by component.

### The Central Banking Architecture

Every central bank in history has required six fundamental components:

```
+-------------------------------------------------------------------+
|                    AV TREASURY - CENTRAL BANK                     |
|                                                                    |
|  +----------+   +----------------+   +------------------------+   |
|  |Currency  |   |  Governance    |   |  Monetary Policy       |   |
|  |          |   |                |   |                        |   |
|  |   Au     |   |  Governor +    |   |  PID Emission          |   |
|  |  Token   |   |     Ag         |   |  + AMO Engine          |   |
|  +----+-----+   +-------+--------+   +-----------+------------+   |
|       |                 |                        |                  |
|       v                 v                        v                  |
|  +----------+   +----------------+   +------------------------+   |
|  | Treasury |   |   Oracle       |   |  Market Operations     |   |
|  |          |   |                |   |                        |   |
|  |Treasury  |   | OracleWrapper  |   |  FlashBuy              |   |
|  |  AMO     |   |                |   |  (Auto-Stabilizer)     |   |
|  +----------+   +----------------+   +------------------------+   |
|                                                                    |
|  +------------------------------------------------------------+   |
|  |              Economic Security Layer                        |   |
|  |   EIP-7702 Hardening | Role Access | Timelock | Pause      |   |
|  +------------------------------------------------------------+   |
+-------------------------------------------------------------------+
```

**The Currency (Au):** A sovereign monetary instrument with fixed supply, required for all economic activity within the ecosystem. Au is not pegged to any external asset — it derives its value from the system productive capacity and the treasury reserve management. Like the US dollar post-Nixon, Au is a fiat currency — but its fiat is enforced by protocol law, not government decree.

**The Governing Body (GovernorContract + Ag):** The legislative and executive authority of the central bank. The GovernorContract is the institutional framework; Ag holders are the stakeholders who exercise voting power. Together they set the parameters within which the system operates: emission rates, fee structures, deviation thresholds, and reserve targets.

**The Monetary Policy Engine (PID Emission + AMO):** The brain of the central bank. The PID controller continuously adjusts Ag emissions based on the system reserve ratio — expanding the governance money supply when reserves are lean, contracting it when reserves are abundant. The AMO (Automated Market Operations) executes open market operations — buying and selling assets to manage liquidity and maintain the Au peg.

**The Treasury (TreasuryAMO):** The vault. It holds the system reserves, manages diversification, and deploys capital through the AMO. The treasury is not a passive storage facility — it is an active instrument of monetary policy.

**The Oracle Layer (OracleWrapper):** The sensory system. The oracle provides real-time price data, reserve measurements, and market conditions. It is the central bank window into the economy — the data feed that drives every policy decision.

**The Automatic Stabilizer (FlashBuy):** The emergency response system. When the oracle detects significant price deviation, FlashBuy executes immediate stabilization purchases — injecting liquidity and defending the peg before human governance can convene.

### Why This Matters

Traditional central banks are opaque. Their balance sheets are published quarterly. Their decisions are announced in press conferences. Their internal deliberations are secret. The AV Treasury central bank is transparent by default — every balance, every decision, every operation is visible on-chain in real-time.

Traditional central banks are slow. The Federal Reserve meets eight times per year. The ECB meets every six weeks. Decisions take months to implement. The AV Treasury central bank operates at block speed — measuring, deciding, and acting within seconds.

Traditional central banks are political. Governors are appointed by presidents. Policy is influenced by elections. The AV Treasury central bank is governed by its stakeholders — and its policy is executed by math, not by appointees.

This is the vision: a self-sustaining, self-governing economic organism that serves as the monetary foundation for the on-chain economy.

---

## III. The Central Banking Thesis — Expanded

To understand what the AV Treasury is building, it helps to understand what central banks actually do — and how each function maps to an on-chain equivalent.

### 1. Monetary Policy

**Traditional:** Central banks set interest rates, reserve requirements, and money supply targets to manage inflation and employment. They meet periodically, debate, and announce decisions.

**On-chain:** The AV Treasury uses a PID controller to algorithmically adjust Ag emissions based on the reserve ratio. When reserves are low relative to the target, emissions increase to attract capital. When reserves exceed the target, emissions decrease to prevent inflation. This happens continuously, at every block, without human debate.

The PID controller is the on-chain equivalent of the Federal Open Market Committee — except it never takes a recess, never succumbs to political pressure, and never makes decisions based on electoral cycles.

### 2. Open Market Operations

**Traditional:** Central banks buy and sell government securities to manage liquidity in the financial system. When they want to stimulate, they buy assets and inject currency. When they want to tighten, they sell assets and withdraw currency.

**On-chain:** The TreasuryAMO contract performs buybacks using treasury reserves. When the system has excess reserves above its runway target, the AMO automatically purchases Au from the open market, creating buy pressure and reducing circulating supply. This is an autonomous open market desk that operates 24/7.

### 3. Lender of Last Resort

**Traditional:** Central banks provide emergency liquidity to solvent but illiquid institutions during crises. This prevents fire sales, contagion, and systemic collapse.

**On-chain:** The AV Treasury treasury contract holds diversified reserves. In a crisis, these reserves can be deployed — through governance decision or algorithmic trigger — to stabilize the system. The AMO can be directed to aggressive buyback modes. Emissions can be temporarily increased to attract emergency liquidity. FlashBuy can execute immediate stabilization purchases. The system has tools.

### 4. Currency Issuance

**Traditional:** Central banks issue currency — physical cash and digital reserves — that serves as the unit of account for the entire economy.

**On-chain:** Au is the currency of the AV ecosystem. It is required for all operations: AI compute, transaction fees, liquidity provision. Its supply is fixed, but its effective scarcity is managed through the fee-and-burn mechanism. Every usage event removes Au from circulation, creating organic deflationary pressure.

### 5. Price Stability Operations

**Traditional:** Central banks intervene in foreign exchange markets to maintain currency stability. They use reserves to buy their own currency when it weakens, or sell it when it strengthens excessively.

**On-chain:** The OracleWrapper monitors Au price in real-time. When deviation exceeds governance-set thresholds, FlashBuy executes automatic stabilization purchases. The AMO conducts ongoing buyback operations. Together, these mechanisms maintain price stability without human discretion.

### 6. Supervision and Regulation

**Traditional:** Central banks supervise financial institutions, set capital requirements, and enforce compliance to maintain systemic stability.

**On-chain:** The AV Treasury enforces economic security through smart contract logic: rate caps, transaction limits, cooldowns, blocklists, and emergency pauses. These are not discretionary — they are hard-coded constraints that prevent manipulation and exploitation regardless of who is involved.

The thesis is simple: every function of a central bank has an on-chain equivalent. The AV Treasury implements each one.

---

## IV. Why Base?

The AV Treasury is built on Base, Ethereum Layer 2. This is not an arbitrary choice — it is a strategic decision grounded in the requirements of a central banking system.

**Security inherits from Ethereum.** A central bank must be built on the most secure foundation available. Base inherits Ethereum consensus security, meaning every transaction, every state change, and every monetary policy decision is ultimately secured by Ethereum validator set. Building on a less secure chain would be like building a central bank on a fault line.

**Throughput enables monetary policy at the speed of blocks.** A central bank that operates once a day is not a central bank — it is a committee. The AV Treasury PID controller updates at every block. The AMO executes buybacks continuously. FlashBuy responds to deviations in real-time. Governance proposals are processed without delay. Base 2-second block time means the system can respond to economic conditions in near-real-time.

**Cost makes microeconomic activity viable.** On Ethereum mainnet, a simple transfer can cost dollars. On Base, it costs fractions of a cent. This matters because the AV Treasury value proposition depends on high-frequency, low-value economic activity: transfers, fees, burns, and buybacks. If each of these operations cost more than the value they create, the system cannot function.

**The ecosystem is there.** Base is home to Aerodrome, one of the most liquid DEXs on any L2. It has deep USDC liquidity, active developer tooling, and a growing ecosystem of DeFi protocols. A central bank needs a financial system to operate within. Base provides that.

**Coinbase alignment.** Base is incubated by Coinbase, the most regulated and institutionally connected entity in crypto. This provides a bridge between the on-chain economy and the traditional financial system — a bridge that a central bank will eventually need.

**The L2 is the sovereign territory.** A central bank needs monetary sovereignty — the ability to set policy without interference from another chain governance. Base provides the platform; the AV Treasury provides the policy. The L2 is the jurisdiction; the protocol is the institution.

---

## V. The Dual-Token Model

Why two tokens? Because a central bank needs two things that are fundamentally incompatible in a single asset: **utility** and **governance**.

### The Fundamental Tension

A currency that is used for transactions must be liquid, transferable, and spendable. A governance token that controls monetary policy must be held, committed, and illiquid. If the same token serves both purposes, the system faces an impossible choice:

- Make it liquid, and governance becomes dominated by short-term traders who dump after voting.
- Make it illiquid, and the utility token cannot function as a medium of exchange.

This is not a theoretical concern. It is the exact problem that has plagued every single-token DeFi protocol. UNI is a governance token that nobody uses as currency. ETH is a currency that has weak governance mechanics. The dual-token model resolves this tension by giving each function its own asset.

### Au — The Currency

Au (Artifact Utility) is the currency of the AV ecosystem. It is:

- **Required.** Every operation in the ecosystem — AI compute, fees, liquidity — requires Au. This creates organic demand derived from real economic activity, not speculation.
- **Fixed supply.** One billion tokens, no further minting. Scarcity is absolute.
- **Deflationary.** A 0.09% transfer fee is split between burn and treasury accumulation. Every transaction permanently removes Au from circulation. The more the system is used, the scarcer Au becomes.

Au is the on-chain equivalent of physical currency in a traditional economy. You spend it. You do not vote with it.

### Ag — The Governance

Ag (Artifact Governance) is the governance token of the AV Treasury. It is:

- **Earned, not purchased.** Ag is emitted to stakers who provide liquidity and commit to the system. This ensures that governance power flows to participants, not speculators.
- **Algorithmically controlled.** The PID controller adjusts Ag emissions based on the system reserve ratio. Governance power expands and contracts based on economic need.
- **Non-linear.** The staking multiplier means that larger Ag holdings yield disproportionately higher rewards, creating an incentive to accumulate and hold — which aligns governance with long-term thinking.

Ag is the on-chain equivalent of a central bank board seats. You earn them through contribution. You exercise them through voting.

### The Cross-Token Flywheel

The two tokens are connected through the staking multiplier: holding Ag boosts your Au staking yields by up to 2.5x. This creates a cross-token demand loop:

1. Users want Au yields — they stake LP tokens
2. Higher yields require Ag — users acquire and hold Ag
3. Ag demand increases — Ag becomes more valuable
4. Ag value incentivizes more staking — more LP tokens are locked
5. Locked LP tokens reduce circulating Au supply — Au becomes more scarce
6. Scarce Au + locked liquidity — system grows

This is not a token pair. It is a monetary system with two interlocking gears.

---

## VI. Automated Market Operations (AMO)

The AMO is the AV Treasury open market desk — and it never sleeps. This section provides a comprehensive treatment of the AMO as a central banking instrument.

### The AMO in Central Banking Context

In traditional finance, open market operations (OMOs) are the primary tool through which central banks implement monetary policy. The Federal Reserve trading desk at the New York Fed buys and sells government securities daily to manage the federal funds rate. The ECB conducts similar operations through its refinancing operations. These are not incidental activities — they are the mechanism through which monetary policy is transmitted to the real economy.

The TreasuryAMO performs the same function for the AV ecosystem. It is the mechanism through which the PID controller policy decisions are transmitted to the market.

### Architecture

```
+-----------------------------------------------------------+
|                    TreasuryAMO                             |
|                                                            |
|  +---------------+    +----------------+    +------------+ |
|  |  Reserve      |    |  Policy        |    |  Execution  | |
|  |  Manager      |--->|  Engine        |--->|  Engine     | |
|  |               |    |                |    |             | |
|  | - Balances    |    | - PID input    |    | - Swap      | |
|  | - Runway      |    | - Deviation    |    | - Route     | |
|  | - Diversify   |    | - Bounds       |    | - Validate  | |
|  +---------------+    +----------------+    +------------+ |
|          |                    |                    |         |
|          v                    v                    v         |
|  +---------------+    +----------------+    +------------+ |
|  |  Treasury     |    |  Oracle        |    |  DEX        | |
|  |  Vault        |    |  Wrapper       |    |  Router     | |
|  +---------------+    +----------------+    +------------+ |
+-----------------------------------------------------------+
```

### Reserve Management

The TreasuryAMO manages the system reserves according to principles drawn from traditional reserve management:

**Runway target.** The system maintains a minimum reserve target measured in months of operational runway. Reserves above this target are available for deployment; reserves below it trigger conservation modes. This is analogous to a central bank foreign exchange reserve adequacy metrics.

**Diversification.** Reserves are held across multiple asset classes to reduce concentration risk. The initial allocation prioritizes stablecoins (USDC) and blue-chip crypto assets (ETH), with governance-controlled parameters for rebalancing.

**Proportional deployment.** The AMO deploys 20% of reserves above the runway target in each execution. This means:
- When reserves are 2x the target, 50% of excess is available for buybacks
- When reserves are at target, no buybacks occur
- When reserves are below target, the AMO enters conservation mode

This proportional approach ensures that buyback intensity scales with system health — the system never over-commits.

### Peg Maintenance Mechanisms

The AMO maintains the Au peg through a tiered intervention system:

```
Peg Status          | Action
--------------------+---------------------------------
< 0.5% deviation    | Normal AMO operations
0.5% - 1.0%         | Accelerated AMO buybacks
1.0% - 2.0%         | FlashBuy activation
> 2.0%              | Emergency governance response
```

**Normal operations (< 0.5% deviation):** The AMO conducts regular buyback operations according to its proportional deployment schedule. This provides consistent baseline buy pressure.

**Accelerated buybacks (0.5% - 1.0% deviation):** The AMO increases buyback frequency and size, deploying up to 40% of excess reserves instead of the standard 20%. The cooldown period may be reduced by governance.

**FlashBuy activation (1.0% - 2.0% deviation):** The FlashBuy mechanism executes immediate, single-transaction stabilization purchases. This is the automatic stabilizer — it acts before governance can convene, before a proposal can be written, before humans can react.

**Emergency response (> 2.0% deviation):** The system enters emergency mode. Governance can activate emergency measures: temporary emission increases, emergency reserve deployment, or system pause if justified.

### PID-Controlled Ranges

The AMO operating parameters are not static — they are dynamically adjusted by the PID controller based on system conditions:

**Emission-responsive bounds.** When the PID controller indicates high emission rates (system under stress), the AMO widens its acceptable deviation range to conserve reserves. When emissions are low (system healthy), the AMO tightens its range and operates more aggressively.

**Reserve-ratio targets.** The PID controller continuously adjusts the target reserve ratio based on market conditions. In volatile markets, the target increases (more reserves needed). In stable markets, the target decreases (more reserves available for deployment).

**Dynamic cooldown.** The AMO cooldown period between buybacks is not fixed — it adjusts based on the PID output. High stress means longer cooldowns (conserve capital). Low stress means shorter cooldowns (more active management).

### Execution Safeguards

Every AMO execution is protected by multiple safeguards:

**TWAP validation.** Every buyback is validated against a Time-Weighted Average Price with a maximum 5% deviation. This prevents the AMO from buying into manipulated markets or during flash crashes. The TWAP serves as the "fair value" benchmark — the AMO will not pay more than 5% above the recent average price.

**Slippage protection.** Maximum 0.5% slippage on every execution. The AMO will not overpay for Au, even in thin markets. If slippage exceeds this threshold, the transaction reverts.

**Epoch caps.** No more than 5% of reserves can be deployed in a single epoch. This prevents the treasury from being drained by a single large buyback event, even if all other safeguards fail.

**Dual DEX support.** Aerodrome as the primary venue, Uniswap as a fallback. If one DEX becomes unavailable or illiquid, the AMO can route through the other. This prevents single-point-of-failure in execution venues.

**Cooldown periods.** 24-hour minimum cooldown between buyback executions. This prevents high-frequency manipulation and gives the market time to absorb each buyback. The cooldown is enforced at the smart contract level — no governance action can override it within the cooldown window.

**Cooldown bypass (emergency only).** In extreme deviation scenarios (>2%), the cooldown can be bypassed by a governance-approved emergency action. This is a deliberate design choice — the cooldown protects against routine manipulation but must not prevent emergency response.

### The AMO as Monetary Policy Transmission

In traditional finance, the transmission mechanism from central bank policy to the real economy works through interest rates, credit channels, and asset prices. The AMO serves as the AV Treasury transmission mechanism:

```
PID Controller decides emission rate
           |
           v
AMO adjusts buyback parameters
           |
           v
Buybacks create Au buy pressure
           |
           v
Au price stabilizes / increases
           |
           v
LP positions become more valuable
           |
           v
More staking -> more TVL
           |
           v
Treasury grows
           |
           v
PID Controller adjusts (lower emissions)
           |
           v
CYCLE COMPLETES
```

The AMO is not a peripheral feature. It is the mechanism through which monetary policy becomes market reality.

---

## VII. The Oracle Layer

The oracle layer is the AV Treasury sensory system — its window into the economic environment. Without accurate, timely data, the PID controller is blind, the AMO is reckless, and FlashBuy is imprecise. This section details the oracle architecture and its role in the central banking framework.

### Oracle as Price Feed

Traditional central banks rely on a network of price feeds: interbank rates, bond yields, commodity prices, foreign exchange rates, and inflation indicators. These feeds inform every policy decision. The AV Treasury OracleWrapper serves the same function — it is the authoritative source of price data for the entire system.

```
+----------------------------------------------------------------+
|                     Oracle Architecture                         |
|                                                                |
|  +----------+    +-----------------+    +------------------+  |
|  |  Price    |    |  Oracle         |    |  Consumer         |  |
|  |  Sources  |--->|  Wrapper        |--->|  Contracts       |  |
|  |          |    |                 |    |                  |  |
|  | - DEX    |    | - Aggregate     |    | - PID Controller |  |
|  | - CEX    |    | - Validate      |    | - AMO            |  |
|  | - Chain  |    | - Deviation     |    | - FlashBuy       |  |
|  |   link   |    | - Threshold     |    | - Staking        |  |
|  +----------+    +-----------------+    +------------------+  |
|                         |                                      |
|                         v                                      |
|                +------------------+                            |
|                |  Deviation       |                            |
|                |  Detection       |                            |
|                |  Engine          |                            |
|                +------------------+                            |
+----------------------------------------------------------------+
```

### OracleWrapper — The Central Bank Data Feed

The OracleWrapper is the aggregation and validation layer that sits between raw price data and the system decision-making contracts. Its responsibilities:

**Data aggregation.** The OracleWrapper pulls price data from multiple sources — DEX pools, external oracles (Chainlink), and TWAP calculations. It aggregates these into a single reference price, using median or weighted-average methods to resist manipulation of any single source.

**Deviation detection.** The OracleWrapper continuously compares the current price against the target peg and against recent TWAP values. When deviation exceeds governance-set thresholds, it emits events that trigger downstream responses:

```
Deviation Level    | Threshold    | Response
-------------------+--------------+---------------------------
Normal             | < 0.5%       | Standard operations
Watch              | 0.5% - 1.0%  | AMO acceleration
Alert              | 1.0% - 2.0%  | FlashBuy activation
Emergency          | > 2.0%       | Governance emergency
```

**Freshness validation.** The OracleWrapper enforces maximum staleness constraints — price data older than a governance-defined threshold is rejected. This prevents stale-price manipulation attacks.

**Integrity checks.** The OracleWrapper validates that price data falls within reasonable bounds. Sudden price spikes that deviate more than X% from the previous reading are flagged and may be rejected or require additional confirmation.

### Deviation Detection as Early Warning System

The deviation detection engine serves as the AV Treasury early warning system — analogous to the monitoring systems that central banks use to detect market stress before it becomes a crisis.

**Trend detection.** The engine tracks not just current deviation but the rate of change. A 0.3% deviation that is rapidly widening is more concerning than a 0.5% deviation that is stable. This derivative component mirrors the D term in the PID controller — it reacts to the direction and speed of change, not just the magnitude.

**Volatility-adjusted thresholds.** During periods of high market volatility, the system automatically widens its deviation thresholds to avoid false positives. During calm periods, thresholds tighten for more responsive stabilization. This prevents the system from overreacting to normal market noise while remaining responsive to genuine threats.

**Cross-reference validation.** The deviation engine cross-references price data across multiple DEXs and time windows. A deviation that appears on only one venue is likely local manipulation; a deviation that appears across all venues is a genuine market event. This distinction is critical for appropriate response calibration.

### FlashBuy — The Automatic Stabilizer

FlashBuy is the oracle layer most powerful feature: an automatic stabilization mechanism that executes without governance approval in response to significant price deviation.

**How FlashBuy works:**

```
OracleWrapper detects deviation > 1.0%
              |
              v
FlashBuy contract receives deviation event
              |
              +--> Validates deviation (not stale, not manipulated)
              |
              +--> Calculates stabilization amount
              |    (proportional to deviation size)
              |
              +--> Executes market buy from treasury reserves
              |
              +--> Validates execution (TWAP, slippage)
              |
              +--> Updates system state
```

**Why FlashBuy matters.** In traditional finance, central bank intervention requires human decision-making. The Fed FOMC must meet and agree. The ECB Governing Council must convene. Even "emergency" interventions take hours to organize. FlashBuy operates at block speed — detecting deviation, validating it, and executing stabilization within seconds.

**Proportional response.** FlashBuy response is proportional to the deviation:
- 1.0% - 1.5% deviation: Small stabilization purchase (governance-defined amount)
- 1.5% - 2.0% deviation: Medium stabilization purchase
- > 2.0% deviation: Maximum stabilization purchase + governance alert

This proportional approach prevents over-reaction to minor deviations while ensuring adequate response to significant ones.

**Treasury-backed.** Every FlashBuy purchase is backed by real treasury reserves. The system does not create new currency to defend the peg — it deploys existing reserves. This is analogous to a central bank using its foreign exchange reserves to defend its currency peg in traditional markets.

**Cooldown and caps.** FlashBuy has its own cooldown period (separate from the AMO cooldown) and per-epoch caps to prevent repeated triggering during sustained deviation events. These parameters are governance-controlled.

### Oracle Security Considerations

The oracle layer is a critical attack vector — compromising the oracle means compromising every system that depends on its data. The AV Treasury addresses this through:

**Multi-source aggregation.** No single price source can manipulate the oracle output. The median of multiple sources is used, requiring an attacker to compromise a majority of sources simultaneously.

**TWAP resistance.** Time-Weighted Average Prices make manipulation expensive — an attacker must sustain the manipulated price over the entire TWAP window to affect the oracle output.

**Staleness rejection.** Stale data is rejected, preventing attacks that rely on freezing oracle updates.

**Governance overrides.** In the event of a detected oracle compromise, governance can pause oracle-dependent systems and switch to manual operation.

---

## VIII. Governance as Monetary Policy

Governance in the AV Treasury is not a feature — it is the system legislative and executive authority. This section frames governance explicitly as the central bank policy-setting body.

### GovernorContract as Central Bank Council

In traditional central banking, the policy-setting body (the FOMC, the ECB Governing Council, the Bank of England Monetary Policy Committee) is responsible for setting the key parameters of monetary policy: interest rates, reserve requirements, and operational targets. The GovernorContract serves this function for the AV Treasury.

```
+--------------------------------------------------------------+
|              GOVERNANCE ARCHITECTURE                          |
|                                                               |
|  +--------------------------------------------------------+  |
|  |                GovernorContract                         |  |
|  |                                                        |  |
|  |  +-------------+  +--------------+  +----------------+  |  |
|  |  | Propose     |  |   Vote       |  |   Execute      |  |  |
|  |  |             |  |              |  |                |  |  |
|  |  | Min 100K    |  | 3-day        |  | Via Timelock   |  |  |
|  |  | Ag stake    |  | voting       |  | 48hr standard  |  |  |
|  |  |             |  | period       |  | 7dy critical   |  |  |
|  |  +-------------+  +--------------+  +----------------+  |  |
|  |                                                        |  |
|  |  Parameters controlled:                                |  |
|  |  - PID coefficients (kp, ki, kd)                       |  |
|  |  - Emission bounds (daily cap, single cap)             |  |
|  |  - Fee rates (transfer fee, staking fee)               |  |
|  |  - AMO parameters (deployment %, cooldown, slippage)   |  |
|  |  - Deviation thresholds (normal/alert/emergency)       |  |
|  |  - Reserve targets (runway months)                     |  |
|  |  - Oracle parameters (TWAP window, staleness)          |  |
|  |  - Staking multiplier curve                            |  |
|  +--------------------------------------------------------+  |
|                                                               |
|  +--------------------------------------------------------+  |
|  |                    Ag Holders                            |  |
|  |                                                        |  |
|  |  - Earned through staking (not purchased)              |  |
|  |  - Voting power proportional to holdings               |  |
|  |  - Delegation enabled (liquid governance)              |  |
|  |  - Quadratic voting option (anti-whale)                |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

### Ag Holders as Stakeholders

Ag holders are the AV Treasury equivalent of a central bank board of governors — but with a crucial difference: board seats are earned through participation, not appointed by political authority.

**Earned governance.** Ag is emitted to stakers who provide liquidity and commit to the system. This ensures that governance power flows to participants who have skin in the game — not to speculators who buy and dump.

**Delegation.** Ag holders who do not wish to vote directly can delegate their voting power to trusted delegates. This is analogous to representative democracy in traditional governance — and it enables liquid governance markets where governance power can be rented or delegated programmatically.

**Quadratic considerations.** The governance framework includes optional quadratic voting for sensitive parameters, where the cost of additional votes increases quadratically. This prevents whale dominance without excluding large stakeholders entirely.

### Parameter Control

The GovernorContract controls every parameter that affects the system monetary policy:

**PID coefficients (kp, ki, kd).** These determine how aggressively the system responds to reserve ratio deviations. Setting these too high causes oscillation; setting them too low causes sluggish response. Governance sets these based on observed system behavior.

**Emission bounds.** The daily cap (100,000 Ag) and single-emission cap (10,000 Ag) are governance-controlled. These bounds are the system "inflation target" — they determine the maximum rate at which new governance currency enters circulation.

**Fee rates.** The 0.09% transfer fee and its split between burn and treasury are governance-controlled. These rates determine the deflationary pressure on Au and the rate of treasury accumulation.

**AMO parameters.** Deployment percentage (20%), cooldown period (24 hours), slippage tolerance (0.5%), and epoch caps (5%) are all governance-controlled. These parameters determine how aggressively the AMO deploys reserves.

**Deviation thresholds.** The thresholds that trigger AMO acceleration, FlashBuy activation, and emergency response are governance-controlled. These are the system "circuit breakers."

**Reserve targets.** The minimum runway target (measured in months) is governance-controlled. This is the system "reserve requirement."

**Oracle parameters.** TWAP window duration, maximum staleness, and deviation validation parameters are governance-controlled.

**Staking multiplier curve.** The relationship between Ag holdings and Au yield boost is governance-controlled. This curve determines the incentive structure for governance participation.

### The Governance Lifecycle

Every governance action follows a strict lifecycle:

```
Propose (min 100K Ag stake)
    |
    v
Voting period (3 days)
    |
    v
Quorum check (minimum participation)
    |
    v
Timelock (48 hours standard, 7 days critical)
    |
    v
Execution (automatic via timelock contract)
```

**Proposal threshold.** A minimum of 100,000 Ag must be staked to submit a proposal. This prevents spam while remaining accessible to committed participants.

**Voting period.** 3 days for all proposals. This gives every Ag holder time to review, discuss, and vote. It is long enough for deliberation but short enough for responsiveness.

**Quorum requirement.** A minimum percentage of total Ag supply must participate for a proposal to pass. This prevents minority governance — decisions must have broad support.

**Timelock.** All executed proposals pass through a timelock contract. Standard proposals have a 48-hour timelock; critical proposals (parameter changes, security actions) have a 7-day timelock. During the timelock, the community can review the executed code and, if necessary, trigger emergency stops.

**Automatic execution.** After the timelock expires, the proposal executes automatically. No multisig. No manual intervention. The code executes because the governance process said it should.

---

## IX. The Economic Flywheel

The AV Treasury is not a collection of isolated mechanisms — it is an economic flywheel where each component reinforces the others. This section describes the complete flywheel with all four layers: LP fees, PID emission, RSBT staking, and the oracle layer.

### Flywheel Overview

```
                    +----------------+
                    |   LP Fees      |
                    |  (Revenue)     |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |   Treasury     |
                    |  (Reserves)    |
                    +-------+--------+
                            |
                            v
+------------+     +--------+--------+     +-------------+
|   Oracle   |<--->|   PID + AMO     |<--->|  PID        |
|   Layer    |     |  (Policy)       |     |  Emission   |
+------------+     +--------+--------+     +-------------+
        |                   |                     |
        v                   v                     v
+------------+     +--------+--------+     +-------------+
|  FlashBuy  |     |   Buybacks      |     |  Ag Rewards |
|  (Stabilize)|    |  (Buy pressure) |     |  (Incentive)|
+------------+     +--------+--------+     +-------------+
        |                   |                     |
        +-------------------+----------+----------+
                            |
                            v
                    +----------------+
                    |   Au Price     |
                    |  (Stability)   |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |   More Staking |
                    |  (TVL Growth)  |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |   More Fees    |
                    |  (Back to top) |
                    +----------------+
```

### Layer 1: LP Fee Revenue

The flywheel begins with economic activity. Users provide liquidity in Au trading pairs on Aerodrome and other DEXs. Every swap generates a fee — a portion of which flows to LP stakers. This fee revenue is the system primary income source.

**Why this matters:** Fee revenue is not speculative — it is derived from real economic activity. Every swap represents someone using the system. The more the system is used, the more fees are generated, and the more revenue flows to the treasury.

**The staking connection:** LP stakers receive Au-denominated rewards. But the reward rate is boosted by Ag holdings (up to 2.5x). This creates the first cross-token incentive: to maximize Au yields, you need Ag.

### Layer 2: PID Emission

The PID controller is the system monetary policy engine. It continuously measures the system reserve ratio and adjusts Ag emissions accordingly.

**When reserves are low:** The PID increases emissions. More Ag flows to stakers. More stakers are attracted. More LP tokens are locked. More fees are generated. Reserves grow.

**When reserves are high:** The PID decreases emissions. Fewer Ag flows to stakers. The system conserves its governance currency. Buybacks increase. Au price stabilizes.

**The feedback loop:** The PID does not operate on a schedule — it operates on data. Every block, it measures the reserve ratio and adjusts. This is the difference between a central bank that meets eight times a year and one that operates at block speed.

### Layer 3: RSBT Staking

RSBT (Rebasing Smart Bond Token) staking is the system savings mechanism. Users stake RSBT tokens and receive yield derived from system revenue. The rebase mechanism automatically compounds rewards, creating a "savings account" within the central bank.

**The staking multiplier:** Ag holdings boost RSBT staking yields by up to 2.5x. This creates the second cross-token incentive: to maximize RSBT yields, you need Ag.

**The lock-in effect:** Staked RSBT is illiquid during the staking period. This reduces circulating supply and creates commitment — stakers are invested in the system long-term, not just farming and dumping.

### Layer 4: Oracle Layer

The oracle layer is the newest addition to the flywheel — and it adds a critical stabilization dimension that the previous three layers lack.

**Price monitoring:** The OracleWrapper continuously monitors Au price. When deviation is detected, it triggers the appropriate response tier — from AMO acceleration to FlashBuy activation.

**Automatic stabilization:** FlashBuy executes immediate stabilization purchases when deviation exceeds 1%. This is the flywheel shock absorber — it prevents the flywheel from breaking during market stress.

**Data-driven policy:** The oracle provides the data that drives PID adjustments, AMO operations, and governance decisions. Without the oracle, the system is flying blind. With it, every decision is grounded in real-time market data.

### The Complete Flywheel — Step by Step

1. **Users swap Au on DEXs** — generating LP fees
2. **LP fees flow to stakers** — denominated in Au
3. **Stakers want higher yields** — they acquire Ag
4. **Ag demand increases** — Ag becomes more valuable
5. **Higher Ag value incentivizes staking** — more LP tokens locked
6. **Locked LP tokens reduce Au supply** — Au becomes more scarce
7. **Scarcity + demand** — Au price appreciates
8. **Oracle monitors price** — detects any deviation
9. **If deviation detected** — FlashBuy stabilizes immediately
10. **If price stable** — AMO conducts regular buybacks
11. **Buybacks create buy pressure** — further supporting price
12. **Higher price attracts more users** — more swaps, more fees
13. **More fees grow the treasury** — reserves increase
14. **Higher reserves trigger PID adjustment** — emissions decrease
15. **Lower emissions make Ag scarcer** — Ag value increases
16. **Higher Ag value** — back to step 5

The flywheel is self-reinforcing. Each turn generates the conditions for the next turn. And because the system is governed by code — not by committees — it operates continuously, without interruption, without fatigue, without political interference.

---

## X. System Evolution Roadmap

The AV Treasury is not a static system — it is designed to evolve through four distinct phases, each adding new capabilities and progressively decentralizing control.

### Phase 1 — Foundation (Current)

**Status:** Live on Base mainnet.

**What exists:**
- Au token (fixed supply, 0.09% transfer fee, burn + treasury split)
- Ag governance token (PID-controlled emissions, daily cap 100K, single cap 10K)
- Staking system (LP staking with Ag multiplier up to 2.5x)
- Treasury contract (accumulates fees, holds reserves)
- GovernorContract (governance framework, 100K Ag proposal threshold)
- Timelock contract (48hr standard, 7-day critical)
- Security layer (role-based access, emergency pause, EIP-7702 hardening)

**What the system can do:**
- Process transfers with automatic fee distribution
- Emit Ag to stakers based on PID-controlled rates
- Accept governance proposals and execute them through timelock
- Accumulate treasury reserves from transfer fees
- Pause/unpause in emergencies

**What the system cannot yet do:**
- Execute AMO buybacks (Phase 2)
- Monitor prices via oracle (Phase 2)
- Activate FlashBuy stabilization (Phase 2)
- Conduct binding governance votes (Phase 3)

**Phase 1 philosophy:** Establish the monetary base. Get the currency right. Build the treasury. Create the governance framework. Do not add complexity until the foundation is solid.

### Phase 2 — Oracle Integration

**Status:** In development.

**What is added:**
- OracleWrapper contract (price aggregation, deviation detection, freshness validation)
- FlashBuy contract (automatic stabilization purchases)
- TreasuryAMO contract (automated buyback execution)
- Integration with Chainlink price feeds
- TWAP calculation and validation
- Deviation-triggered response system

**What the system can do after Phase 2:**
- Monitor Au price in real-time across multiple sources
- Detect price deviations with configurable thresholds
- Execute automatic stabilization purchases (FlashBuy) when deviation > 1%
- Conduct regular AMO buybacks when reserves exceed runway target
- Validate all executions against TWAP and slippage constraints
- Adjust AMO parameters based on PID controller output

**Key milestones:**
- OracleWrapper deployed and tested on testnet
- FlashBuy successfully executes stabilization on simulated depeg
- AMO conducts first buyback using treasury reserves
- Deviation detection accurately distinguishes manipulation from genuine moves

**Phase 2 philosophy:** Give the central bank its sensory system. The PID controller can now see what it is controlling. The AMO can now act on policy decisions. FlashBuy can now respond to emergencies without human intervention.

### Phase 3 — Governance Activation

**Status:** Planned.

**What is added:**
- Binding governance voting (currently advisory)
- Parameter adjustment through governance execution
- Ag delegation and quadratic voting
- Treasury management proposals (rebalancing, diversification)
- Emergency governance procedures
- Cross-protocol governance (if applicable)

**What the system can do after Phase 3:**
- Ag holders vote on PID coefficients (kp, ki, kd)
- Ag holders adjust emission bounds (daily cap, single cap)
- Ag holders modify fee rates (transfer fee, burn/treasury split)
- Ag holders control AMO parameters (deployment %, cooldown, slippage)
- Ag holders set deviation thresholds (normal/alert/emergency)
- Ag holders manage treasury (rebalancing, new asset classes)
- Ag holders can trigger emergency measures

**Key milestones:**
- First binding governance vote executes successfully
- Parameters adjusted through governance (not admin)
- Delegation system enables liquid governance
- Emergency procedures tested (simulated attack response)

**Phase 3 philosophy:** Transfer control from builders to stakeholders. The central bank is now governed by its participants. The code enforces the will of Ag holders. No admin keys can override governance decisions.

### Phase 4 — Full Decentralization

**Status:** Long-term vision.

**What is added:**
- Admin key renouncement (no privileged access remains)
- Fully autonomous monetary policy (all parameters governance-controlled)
- Cross-chain expansion (if applicable)
- Institutional integration (if applicable)
- Protocol-owned liquidity (treasury owns its own LP positions)

**What the system can do after Phase 4:**
- Operate with zero human intervention (fully autonomous)
- Adjust all parameters through governance votes
- Manage its own liquidity positions
- Expand to new chains through governance decision
- Serve as monetary infrastructure for other protocols

**Key milestones:**
- Admin keys renounced on all contracts
- All privileged functions transferred to governance
- System operates for 90+ days without admin intervention
- External protocols begin using Au as monetary base

**Phase 4 philosophy:** The central bank is now fully autonomous. No individual, team, or foundation can control it. It is governed entirely by its stakeholders through code-enforced governance. It has achieved monetary sovereignty.

### Roadmap Summary

```
Phase 1 (NOW)        Phase 2              Phase 3              Phase 4
+-------------+    +-------------+    +-------------+    +-------------+
| Foundation  |    | Oracle      |    | Governance  |    | Full        |
|             |    | Integration |    | Activation  |    | Decentral   |
| Au Token    |--->| OracleWrap  |--->| Binding     |--->| Admin       |
| Ag Token    |    | FlashBuy    |    | Voting      |    | Renouncement|
| Staking     |    | TreasuryAMO |    | Delegation  |    | Autonomous  |
| Treasury    |    | Deviation   |    | Parameter   |    | Monetary    |
| Governor    |    | Detection   |    | Control     |    | Policy      |
| Security    |    | Auto-Stab   |    | Emergency   |    | Protocol-   |
| Layer       |    |             |    | Procedures  |    | Owned Liq   |
+-------------+    +-------------+    +-------------+    +-------------+
```

---

## XI. Economic Security Model

A central bank is only as secure as its defenses. The AV Treasury implements a comprehensive economic security model that protects against both external attacks and internal failures.

### Security Architecture Overview

```
+------------------------------------------------------------------+
|                   ECONOMIC SECURITY MODEL                         |
|                                                                   |
|  +----------------+  +------------------+  +------------------+  |
|  |  Access Control |  |  Operational     |  |  Emergency       |  |
|  |                 |  |  Safeguards      |  |  Response        |  |
|  | - Role-based    |  | - TWAP validate  |  | - Pause          |  |
|  | - EIP-7702      |  | - Slippage caps  |  | - Timelock       |  |
|  | - Privilege     |  | - Epoch limits   |  | - Admin last     |  |
|  |   separation    |  | - Cooldown       |  |   resort         |  |
|  +----------------+  +------------------+  +------------------+  |
|                                                                   |
|  +----------------+  +------------------+  +------------------+  |
|  |  Economic       |  |  Oracle          |  |  Governance      |  |
|  |  Constraints    |  |  Protection      |  |  Security        |  |
|  |                 |  |                  |  |                  |  |
|  | - Rate caps     |  | - Multi-source   |  | - Proposal       |  |
|  | - Tx limits     |  | - TWAP resist    |  |   threshold      |  |
|  | - Cooldowns     |  | - Staleness      |  | - Quorum         |  |
|  | - Blocklists    |  | - Cross-ref      |  | - Timelock       |  |
|  +----------------+  +------------------+  +------------------+  |
+------------------------------------------------------------------+
```

### EIP-7702 Hardening

EIP-7702 introduces a new transaction type that allows EOAs to temporarily execute contract code. While powerful, it introduces new attack vectors — particularly around signature replay and authorization delegation.

**The threat:** An attacker could craft a malicious EIP-7702 transaction that appears legitimate but executes unauthorized operations against the treasury or governance contracts.

**The defense:**
- All contracts validate that EIP-7702 delegations are from authorized code contracts only
- Signature replay protection is enforced at the contract level (not just the protocol level)
- Authorization can be revoked unilaterally by the delegator
- All EIP-7702 interactions are logged for audit

### Role-Based Access Control

The system implements granular role-based access control (RBAC) following the principle of least privilege:

```
Role                  | Capabilities
----------------------+----------------------------------
DEFAULT_ADMIN         | Grant/revoke roles, renounce roles
GOVERNOR              | Submit proposals, execute governance
EMERGENCY             | Trigger emergency pause
TREASURY_OPERATOR     | Execute AMO buybacks (within params)
ORACLE_UPDATER        | Update oracle data (within params)
GUARDIAN              | Cancel malicious timelock txs
```

**Privilege separation:** No single role can unilaterally drain the treasury, change governance parameters, or bypass security constraints. The GOVERNOR role can propose changes, but they must pass through timelock. The TREASURY_OPERATOR can execute buybacks, but only within AMO parameters. The EMERGENCY role can pause, but cannot unpause without governance.

**Role administration:** The DEFAULT_ADMIN role can grant and revoke roles. In Phase 4, this role will be renounced, making role assignments permanent (changeable only through governance).

### Timelock Protection

Every governance action passes through a timelock contract that enforces a mandatory waiting period:

- **Standard proposals:** 48-hour timelock
- **Critical proposals:** 7-day timelock

**Why timelock matters:** The timelock gives the community time to review executed code before it takes effect. If a malicious proposal passes governance (e.g., through a flash loan attack), the community can:
1. Detect the malicious code during the timelock period
2. Trigger emergency pause to prevent execution
3. Organize a response (e.g., counter-proposal, role revocation)

**Timelock cancellation:** The GUARDIAN role can cancel queued timelock transactions. This is a limited power — the guardian can cancel, but cannot execute arbitrary code. This prevents abuse while enabling emergency response.

### Emergency Stops

The system includes multiple layers of emergency stops:

**Contract-level pause:** Individual contracts can be paused by the EMERGENCY role. This stops all user-facing operations (transfers, staking, buybacks) while preserving state.

**System-level pause:** A global pause stops all operations across all contracts. This is the "circuit breaker" — used only in extreme circumstances.

**Governance pause:** Governance operations can be paused separately from economic operations. This prevents governance attacks while allowing normal economic activity to continue.

**Unpause procedure:** Unpausing requires either governance approval or a time-delayed automatic unpause (configurable). This prevents the emergency role from keeping the system paused indefinitely.

### Economic Constraints

Beyond access control, the system enforces economic constraints that limit the damage any single transaction can cause:

**Rate caps:** No more than 100,000 Ag can be emitted per day. No more than 10,000 Ag in a single emission. These caps are hard-coded and cannot be exceeded, even by governance (governance can only lower them).

**Transaction limits:** Maximum transaction size prevents whale manipulation. The limit is set high enough for legitimate use but low enough to prevent single-transaction market manipulation.

**Cooldowns:** 24-hour cooldown between AMO buybacks. FlashBuy has its own cooldown. These prevent high-frequency manipulation and give the market time to absorb each operation.

**Blocklists:** Governance can add addresses to a blocklist, preventing them from interacting with the system. This is a last-resort measure for addresses associated with attacks or sanctions.

### Oracle Protection

The oracle layer has its own security model:

**Multi-source aggregation:** No single source can manipulate the oracle. The median of DEX spot, DEX TWAP, and Chainlink is used.

**Staleness rejection:** Price data older than the governance-defined threshold is rejected.

**Deviation limits:** Price changes exceeding a maximum per-block threshold are flagged and may be rejected.

**Circuit breaker:** If the oracle detects a potential compromise (e.g., all sources diverge simultaneously), it can pause oracle-dependent systems.

### Governance Security

Governance itself is protected against attacks:

**Flash loan resistance:** Voting power is determined at the start of the voting period (snapshot), not at the time of voting. This prevents flash loan voting attacks where an attacker borrows tokens, votes, and returns them in a same-block transaction.

**Proposal threshold:** 100,000 Ag minimum stake prevents spam proposals. This is high enough to deter casual spam but low enough for serious participants.

**Quorum requirement:** A minimum percentage of total Ag supply must participate. This prevents minority governance where a small fraction of holders make decisions for the entire system.

**Timelock execution:** All governance actions pass through timelock, giving the community time to react to malicious proposals.

### The Security Philosophy

The AV Treasury security model follows three principles:

1. **Defense in depth.** No single safeguard is relied upon. Multiple overlapping protections ensure that if one fails, others remain.

2. **Least privilege.** Every role has the minimum capabilities needed for its function. No role can unilaterally compromise the system.

3. **Graceful degradation.** In an emergency, the system can be paused without losing state. It can be restarted without losing funds. Security measures protect the system without destroying it.

---

## XII. Conclusion

The AV Treasury is not a product. It is not a protocol. It is not a token.

It is a monetary system — a complete, self-sustaining economic organism that operates on-chain, governed by code, and owned by its participants.

Every component described in this document — the currency (Au), the governance (Ag), the monetary policy (PID + AMO), the treasury (TreasuryAMO), the oracle (OracleWrapper), the automatic stabilizer (FlashBuy), and the security layer — exists to serve a single purpose: to create a monetary system that works.

Not a system that works in theory. Not a system that works in a bull market. Not a system that works when everything goes right.

A system that works. Period.

A system that adjusts its policy at block speed. A system that stabilizes its currency without human intervention. A system that captures value from usage and recycles it into growth. A system that is governed by its stakeholders, not by a foundation. A system that is transparent by default, secure by design, and autonomous by architecture.

This is the AV Treasury. This is the central bank for the on-chain economy.

The code is the policy. The math is the governance. The protocol is the institution.

---

*End of Vision Document.*
