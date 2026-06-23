# AV Token Deployment Guide — Index

> **Created:** 2026-06-23
> **Purpose:** Comprehensive deployment documentation for the AV Token ecosystem

## Files

| File | Description |
|---|---|
| `DEPLOYMENT_GUIDE.md` | Complete deployment guide with all lessons learned (28KB) |

## Quick Reference

- **V2 Production Contracts:** 8 contracts deployed 2026-06-22, all verified
- **Network:** Base Mainnet (chainId 8453)
- **Status:** ✅ All systems operational
- **V1 Status:** ❌ Compromised 2026-06-17 — do not use

## Key Lessons (TL;DR)

1. **Never use a single private key** for production deployments — use multisig + timelock
2. **Monitor for EIP-7702 delegation** on all deployer wallets (`eth_getCode` should return `0x`)
3. **Disable fees during initial distribution** — re-enable after all transfers complete
4. **Validate private key matches declared address** before deploying
5. **Verify all contracts immediately** on block explorer before considering deployment complete
6. **Use fee-disabled distribution pattern** to avoid balance discrepancies
7. **Base L2 gas is extremely cheap** — entire 8-contract deployment costs < 0.0002 ETH
