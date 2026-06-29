---
title: 09 — Governance Framework (Governor + Timelock)
date: 2026-06-29
status: draft
description: The DAO governance system. Covers proposal lifecycle, voting mechanics, proposal tiers, timelock security, and governance-controlled parameters.
category: central-banking
related: [01-dual-token-architecture.md, 02-monetary-policy-engine.md, 10-quasicrystal-nft.md, INDEX.md]
---

# 09 — Governance Framework

## 9.1 Overview

The governance system consists of:
- **Governor** (`0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385`) — proposal and voting
- **Timelock** (`0x662321CC63700865838aB08378061BE499344714`) — delayed execution

Together they form the **central bank council** — a deliberative body that
sets policy but cannot act unilaterally or instantaneously.

## 9.2 Governor Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Proposal threshold | 100,000 Ag | Minimum to submit |
| Voting delay | 1 day | Review before voting |
| Voting period | 30 days | Voting window |
| Quorum | 4% of total Ag | Minimum participation |
| Timelock delay | 48 hours | Delay before execution |

## 9.3 Proposal Lifecycle

```
Draft → Submitted → Active (1 day) → Voting (30 days) → Queued (48h) → Executed
                                            ↓                          ↓
                                       Cancelled                  Cancelled
```

## 9.4 Proposal Tiers

| Tier | Scope | Threshold | Voting Period | Quorum |
|------|-------|-----------|---------------|--------|
| **Standard** | Parameter changes | 100K Ag | 30 days | 4% |
| **Emergency** | Security patches | 200K Ag | 7 days | 6% |
| **Constitutional** | Architecture changes | 500K Ag | 45 days | 10% |

## 9.5 Voting Power

```
voting_power = Ag_balance + veAg_multiplier
veAg_multiplier = Ag_locked × (lock_duration / max_lock_duration) × 1.5
Max multiplier: 2.5× (for 4-year lock)
```

## 9.6 Governance-Controlled Parameters

### PID Parameters
| Parameter | Current | Range | Tier |
|-----------|---------|-------|------|
| Kp | 0.5 | 0–5 | Standard |
| Ki | 0.1 | 0–2 | Standard |
| Kd | 0.2 | 0–2 | Standard |
| Target TVL | Scaling | $100K–$1B | Standard |
| Epoch duration | 5 days | 1–30 days | Standard |

### Treasury Parameters
| Parameter | Current | Range | Tier |
|-----------|---------|-------|------|
| Reserve ratio | 60% | 50–100% | Standard |
| Max buyback | 10% | 1–25% | Standard |
| FlashBuy threshold | 2% | 0.5–10% | Standard |

### Token Parameters
| Parameter | Current | Range | Tier |
|-----------|---------|-------|------|
| Au transfer tax | 9 bps | 0–20 bps | Constitutional |
| Tax split | 50:50 | 0:100 to 100:0 | Standard |

## 9.7 Timelock Security

The 48-hour timelock provides:
1. **Review window** — community can analyze changes
2. **Exit rights** — users can withdraw if they disagree
3. **Emergency cancellation** — any address can cancel
4. **Upgrade safety** — visible before execution

## 9.8 Emergency Powers

- **Pause contracts** — Emergency tier, 7-day voting, 6% quorum
- **Emergency withdrawal** — Treasury Safe 3-of-5 multisig
- **Oracle override** — Manual prices if oracle fails

Emergency powers limited to 72 hours. Extension requires standard proposal.
