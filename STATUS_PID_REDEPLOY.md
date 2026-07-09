# STATUS — PID REDEPLOY + ORACLE REORIENT (Sirius approved 2026-07-08)

## LIVE TOPOLOGY (source of truth = address.book == keeper/config.py CONTRACTS)
All ALIVE on Base mainnet:
- AgToken 0x1D31, AuToken 0x0c5A..A1DD, USDC 0x8335..fC
- PID 0xB8F2 (v2, BARE, staking→0xd81C BROKEN, admin=0x0, never run)
- AVLPStaking 0x8F63 (UUPS, impl 0xe699, CORRECT: ag=Ag, au=Au, lpNFT=auLP_NFT)
  - 0xd81C (UUPS, impl 0xb005, BROKEN: ag=auLP_NFT, au=Ag, lpNFT=treasury) ← what PID points to
- TreasuryAMO 0xF096, TreasuryFlashBuy 0xf638
- Governor 0x5F06, Timelock 0x0905, TreasurySafe 0x1082
- SlipstreamRouter 0xcF77, auLP_NFT 0x7797, FlashLoan 0x4DDD, DexSimulator 0x2C1b
- QuasiCrystal 0xfd04 (stale), AvOracleV5 0xb479 (reverts) — oracle conflict

DEAD (stale fiction, do NOT use): PID 0x9911, Governor 0x259c, Timelock 0x6623,
TreasuryAMO 0x5665, AVLPStaking 0xD96D, OracleFlashBuy 0xDfD0 (chain.py TUI + README v3.2).

## DEPLOYER / GAS
- PRIVATE_KEY_BASE (AVA 0x21E9) = 0 ETH  (cannot deploy)
- DEVELOPER_WALLET (0xEc2b) = 0.00079 ETH (~$2) → HARDHAT DEPLOYER ✅
- KEEPER (0xc63B..7555) = 0.00059 ETH

## PLAN — PID REDEPLOY
1. Deploy PID_Emission_Controller_v2 (repo source, behaviorally identical to live 0xB8F2)
   ctor(admin=KEEPER 0xc63B..7555, staking=0x8F63, agToken=0x1D31,
        targetTVL=1e25, kp=1e14, ki=1e13, kd=5e13)
   → admin=keeper auto-grants DEFAULT_ADMIN + PARAM + EMIT roles (constructor).
2. Verify on Etherscan V2; on-chain assert staking()==0x8F63, agToken==0x1D31.
3. Update address.book PID line → new addr; update keeper/config.py CONTRACTS['pid'].
4. Fix chain.py TUI dead addresses (display-only) to live v2 set.
5. git commit.

## THEN — ORACLE REORIENT
- keeper oracle.py reads QuasiCrystal 0xfd04 (isPriceValid=FALSE). Book says AvOracleV5 0xb479 (reverts).
- Both SOURCE-MISSING from repo. Need: pick canonical, recover source, seed feed, repoint keeper.

## DOUBLE FLYWHEEL (for reference)
F1 EMISSION: PID→Ag mint→stake Ag in AVLPStaking→Au rewards→Au/ETH LP.
F2 AMO/BUYBACK: TreasuryAMO + TreasuryFlashBuy buy Au w/ profits → Au/ETH LP via SlipstreamRouter.
Profits→LP→TVL→PID emission scales. Keeper: emission/buyback/oracle/governor/warden.
