---
title: Address Book — Canonical Contract Addresses
version: 1.0
status: canonical
source: ../address.book
last_updated: 2026-06-29
---

# Address Book — Canonical Contract Addresses

> This document mirrors the canonical `address.book` at the repository root. In case of conflict, the on-chain state is authoritative.

## Currency

| Contract | Address | Type |
|----------|---------|------|
| Au Token (Proxy) | `0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08` | UUPS Proxy |
| Au Token (Implementation) | `0x2B501a3EB675A6C84Bb9C65F1c39C2d6e9e32b29` | Implementation |
| Ag Token (Proxy) | `0x1D31719389Bd8b17277Ba367c26b830aE34D3674` | UUPS Proxy |
| Ag Token (Implementation) | `0x80015309cF7f18d49f28C0b0E6c2f0c5c3288817` | Implementation |

## Reserves

| Contract | Address | Type |
|----------|---------|------|
| TreasuryAMO | `0x56653245f4718fe105b95C8424947B31b84b5188` | Non-upgradeable |
| FlashBuy v2 | `0xf6383860837E6cb983F9Af8Def92fc08F15Be65b` | Non-upgradeable |

## Monetary Policy

| Contract | Address | Type |
|----------|---------|------|
| PID Controller | `0x991138923880773D67c01392c31A255e770F7f70` | Non-upgradeable (params via gov) |

## Oracle

| Contract | Address | Type |
|----------|---------|------|
| OracleWrapper | `0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB` | Non-upgradeable |
| AvOracle v5 | `0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD` | Non-upgradeable |

## Governance

| Contract | Address | Type |
|----------|---------|------|
| Governor v5 (spectre-patched) | `0x5F061c177b76753686122185989C2332C1d0e8b1` | Non-upgradeable |
| Timelock | `0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be` | Non-upgradeable |

### Deprecated Governance

| Contract | Address | Status | Replacement |
|----------|---------|--------|-------------|
| Governor v5 (pre-patch) | `0x3DEDAf8AF86838D3EB8342c2E0AE605B5F74a9eb` | Replaced | Governor v5 (spectre-patched) |
| Governor v5 (original) | `0x1Dc51EccAeA0c9fb41Bc42d6e452D2c27225f0a9` | Replaced | Governor v5 (spectre-patched) |
| Governor (old) | `0x259c1C2354Bc9e1eF20ee3B7b1D8580Cb5F06385` | Deprecated | Governor v5 (spectre-patched) |
| Timelock (old) | `0x662321CC63700865838aB08378061BE499344714` | Deprecated | Timelock (new) |

## Liquidity

| Contract | Address | Type |
|----------|---------|------|
| QuasiCrystalLPNFT | `0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8` | ERC-721 |
| AVLPStaking v2 (Proxy) | `0xD96D502B20474308521958573E3Fa68DbB041685` | UUPS Proxy |
| AVLPStaking v2 (Implementation) | `0xE699960b6e81d00A42F8580004C8FBD72902806A` | Implementation |

## Keeper Bot

| Wallet | Address | Network | Role |
|--------|---------|---------|------|
| Keeper Hot Wallet | `0xc63B7A10BB926B3b25EcB51887945CaeB6927555` | Base | Emission/Buyback/Oracle automation |

## External

| Name | Address | Role |
|------|---------|------|
| Treasury Safe | `0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e` | Multi-sig |
| Au/WETH Pool (Aerodrome) | `0xA41aB59dDDE5bA9b561f838d0B23268ADB863665` | AMM Pool |
| Slipstream Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | AMM Router |

## Deprecated

| Contract | Address | Status | Replacement |
|----------|---------|--------|-------------|
| AuToken v1 | `0x40930113...` | Deprecated | AuToken v2 (proxy) |
| AgToken v1 | `0x8a222b54...` | Deprecated | AgToken v2 (proxy) |
| AVLPStaking v1 | `0x5808E556...` | Deprecated | AVLPStaking v2 |
| AvOracle v3 | `0x2c920073...` | Deprecated | AvOracle v5 |
| AvOracle v4 | `0x92414472...` | Deprecated | AvOracle v5 |
