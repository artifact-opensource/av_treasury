# Aerodrome Contract Addresses on Base Mainnet

## Verified Contracts
- **NonfungiblePositionManager**: `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA` (47KB code, verified on Basescan)
  - This is the REAL Aerodrome V3 NFT position manager
  - mint() selector: `0x42a3b065` (struct params: (address,address,int24,int24,uint128,uint256,uint256,uint256,uint256,address,uint256))
  - Factory() returns empty (immutable inlined)

## Broken/Proxy Contracts (DO NOT USE)
- `0xb9A1094D614c70B94C2CD7b4efc3A6adC6e6F4d3` — EIP-1167 inverted proxy pointing to empty address `0x04e4003628c6472adf250c82099925b3978e6e15`. ALL calls revert.
- `0x9b758EFd22c56e6B243a062d3acFE7d2526F051B` — Another broken minimal proxy. Holds 300,000 Au tokens.
- `0xE6A41fE61E7a1996B59d508661e3f524d6A32075` — Another minimal proxy (deploys the broken proxy above)

## Key Token Addresses
- Au Token: `0xd680724362455593C32f31094255fC5149EB39Eb`
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913`
- WETH on Base: `0x4200000000000000000000000000000000000006`

## Deployed Workspace Contracts
- TreasuryAMO: `0xca37D135D95EdDAe37def8403fAA32365744Ee15`
- StakingImpl: `0x1EF8aE04D658780Ac46Aa02Baf8a89Bee6a88ECd`
- Staking (broken proxy): `0x9b758EFd22c56e6B243a062d3acFE7d2526F051B`

## Notes
- Could NOT find the Aerodrome Factory or Router addresses on Base Mainnet
- Known factory addresses have NO code
- TheGraph aerodrome subgraph returns empty
- Uniswap V3 Factory on Base unknown

## Function Selectors
- Uniswap V3 mint(struct): `0x42a3b065`
- Uniswap V3 mint(address,int24,int24,uint128,bytes) [WRONG, doesn't exist]: `0xebf0f267`
- Unknown selector user tried: `0x499a98fd` (not in 4byte.directory)
