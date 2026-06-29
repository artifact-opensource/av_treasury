---
title: YIELD-PET Structural Metadata Schema
date: 2026-06-29
status: canonical
description: On-chain metadata schema specification for YIELD-PET generative LP vault entities.
category: technical
related: [research/acoustic_vault.md, research/morphspace.md, central-banking/10-quasicrystal-nft.md]
---

# Project YIELD-PET: Structural Metadata Schema Specification
**Protocol Standard ID:** ARC-SBT-099
**Version:** 1.0.0-PROD
**Classification:** Core Governance Specification

## 1. On-Chain Data URI Payload Structure
To achieve absolute zero-dependency immutability, the entire metadata payload is packed directly into a Base64 encoded JSON string on-chain. There are no IPFS pointers, no API links, and no hosted resources.

### 1.1 Base64 Schema Envelope
The contract returns the following standard layout when querying tokenURI(uint256 tokenId):
```json
{
  "name": "YIELD-PET #2199 - Spectral Ameba",
  "description": "An autonomous, generative, Account-Bound LP Vault and live mechanical entity. Visual mutations and acoustic frequencies are procedurally computed in real-time from locked capital volume, epoch velocity, and protocol yield rates.",
  "image": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii02MCAtNjAgMTIwIDEyMCIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSI+Li4uPC9zdmc+",
  "animation_url": "data:text/html;base64,PGh0bWw+PGhlYWQ+Li4uPC9oZWFkPjxib2R5Pi4uLjwvYm9keT48L2h0bWw+",
  "external_url": "[https://vault.artifactvirtual.com/pet/2199](https://vault.artifactvirtual.com/pet/2199)",
  "attributes": [
    {
      "trait_type": "DNA Seed",
      "value": "0x4FA9B3028E4C115500A7D9B4C28E00A3C5B2D1E9F8A7B6C5D4E3F2A1B0C9D8E7",
      "display_type": "string"
    },
    {
      "trait_type": "Operational Node Address",
      "value": "0x7F2a9De33D22489C94bC87E2356B2c5890871162",
      "display_type": "string"
    },
    {
      "trait_type": "Acoustic Synthesizer Base",
      "value": "SINE WAVE",
      "display_type": "string"
    },
    {
      "trait_type": "Symmetry Multiplier (m)",
      "value": 5.33,
      "display_type": "number"
    },
    {
      "trait_type": "Sovereign Account Status",
      "value": "BOUND-ACTIVE",
      "display_type": "string"
    },
    {
      "trait_type": "Locked Vault Capital",
      "value": 2500,
      "display_type": "number",
      "max_value": 10000
    },
    {
      "trait_type": "Accrued Epoch Yield Rate",
      "value": 12,
      "display_type": "boost_percentage"
    },
    {
      "trait_type": "System Vitality Level",
      "value": 100,
      "display_type": "number",
      "max_value": 100
    }
  ],
  "properties": {
    "vault_assets": {
      "lp_token_address": "0x1234567890123456789012345678901234567890",
      "underlying_pair": "ETH-USDC",
      "last_interaction_timestamp": 1774352800
    },
    "parametric_coefficients": {
      "m": 5.3333,
      "n1": 1.0000,
      "n2": 1.2400,
      "n3": 1.0000,
      "a": 1.0000,
      "b": 1.0000
    },
    "recovery_configuration": {
      "recovery_vault_registry": "0x5c4d37c5e884192039De3c58908711621D1D20D4",
      "is_reissuable": true
    }
  }
}

```
## 2. Genomic Parameter Matrix (Bit-Shift Allocation)
A single 256-bit unsigned integer (uint256 dna) represents the absolute genetic makeup of the pet. Below is the precise layout used to reconstruct variables client-side from raw hex bytes:
```
+-----------------------------------------------------------------------------------------------+
| Bytes   | Name                 | Value Space            | Morphspace Coefficient Link         |
+---------+----------------------+------------------------+-------------------------------------+
| 31 - 30 | Color Palette ID     | [0x0000 - 0xFFFF]      | Visual gradient array index         |
| 29 - 28 | Base Symmetry        | [3 - 16]               | Gielis base symmetry parameter ($m$)|
| 27 - 26 | Exponent Core n1     | [1 - 255] (scaled /10) | Gielis sharpness parameter ($n_1$)  |
| 25 - 24 | Exponent Core n2     | [1 - 255] (scaled /10) | Gielis bloating parameter ($n_2$)   |
| 23 - 22 | Exponent Core n3     | [1 - 255] (scaled /10) | Gielis pinching parameter ($n_3$)   |
| 21 - 20 | Synth Waveform Type  | [0 - 3] (Sine/Tri/etc.)| Web Audio oscillator wave           |
| 19 - 18 | Base Resonance Pitch | [50 - 1500] (Hz)       | Synthesizer root pitch offset       |
| 17 - 16 | Geolocation Pin X    | [0x0000 - 0xFFFF]      | Latitude coordinate anchor          |
| 15 - 14 | Geolocation Pin Y    | [0x0000 - 0xFFFF]      | Longitude coordinate anchor         |
| 13 - 00 | Cryptographic Salt   | [0x000...000]          | Unique variation differentiator     |
+-----------------------------------------------------------------------------------------------+

```
## 3. Yield-Driven Mutation Mechanics
Instead of static data inputs, the Gielis coefficients mutate based on live state variables stored within the LP vault.
```
       +----------------------------+
       |   Locked Vault Capital     | 
       |       (lpAmount)           |
       +-------------+--------------+
                     |
                     v
             m = BaseSymmetry + (lpAmount / 1500)
                     |
                     v
       +-------------+--------------+
       |  Procedural Geometry Path  |  ===> Real-time Morphing SVG
       +-------------+--------------+
                     ^
                     |
            n2 = 1.0 + (yieldRate / 50)
                     |
       +-------------+--------------+
       |    Epoch Protocol Yield    |
       |       (yieldRate)          |
       +----------------------------+

```
### 3.1 Decay & Dormancy Physics
When the elapsed time \Delta t since the last interaction (such as restaking rewards or calling interact()) exceeds the configured threshold, the parameters degrade toward zero-energy layout configurations:
 * **If \Delta t \le 7 \text{ days} (VIBRANT):** n_1, n_2, n_3 remain at genetic baseline values. Scale multiplier runs at optimal levels.
 * **If 7 \text{ days} < \Delta t \le 30 \text{ days} (DORMANT):** Coefficients degrade exponentially:
   
   
   The shape physically flattens, and the visual colors shift to dim, monochromatic hues.
 * **If \Delta t > 30 \text{ days} (TERMINATED):** The vault continues to accumulate yield safely, but the entity's rendering shape collapses into a static, low-energy geometric circle. Calling feed() (harvesting yield and restaking) resets this process, restoring vitality.