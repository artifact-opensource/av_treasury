export const BASE_CHAIN_ID = 8453

// ─── AV Treasury Contract Addresses (Base Mainnet) ───────────────
// Source: address.book (verified on-chain 2026-06-29)
export const AV_CONTRACTS = {
  auToken:       '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08' as `0x${string}`,
  auTokenImpl:   '0x4682C375969DBb1CDcbA1Eaedab7FC288c8fBb61' as `0x${string}`,
  agToken:       '0x1D31719389Bd8b17277Ba367c26b830aE34D3674' as `0x${string}`,
  agTokenImpl:   '0xBFD228862E407775D5911FD1a0fEF6bAb49534Da' as `0x${string}`,
  oracle:        '0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD' as `0x${string}`,
  oracleWrapper: '0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB' as `0x${string}`,
  oracleFlashBuy:'0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc' as `0x${string}`,
  pidController: '0xB8F240870DBc1cD5F9262F8180350A29ea404268' as `0x${string}`,
  treasuryAMO:   '0xF096cD4D24811B0F824c929907196bCB796bca88' as `0x${string}`,
  staking:       '0x8F638B6C2EBD61A638561B6993930CF25D53ACB9' as `0x${string}`,
  stakingImpl:   '0xE699960b6e81d00A42F8580004C8FBD72902806A' as `0x${string}`,
  governor:      '0x5F061c177b76753686122185989C2332C1d0e8b1' as `0x${string}`,
  timelock:      '0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be' as `0x${string}`,
  rsbt:          '0xfd04BcE29bCE1387E2c0B7599E68ed681e8a47CD' as `0x${string}`,
  acousticVault: '0xf6383860837E6cb983F9Af8Def92fc08F15Be65b' as `0x${string}`,
  flashLoan:     '0x4Ddd1873964E5C2e3bE6712E199812903E6696b9' as `0x${string}`,
  dexSimulator:  '0x2C1bD0e498cEA315dA7486a41FB3DD991DA302B2' as `0x${string}`,
  treasurySafe:  '0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e' as `0x${string}`,
  quasiCrystalNFT:'0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8' as `0x${string}`,
  quasiCrystalSVG:'0xe23F177d09C1C5388104f0369aE91Cc4eA34E528' as `0x${string}`,
  onChainBase64: '0x44D47F74728E3e7F8661bcC49524D9702778295C' as `0x${string}`,
  treasuryFlashBuy_v2: '0xf6383860837E6cb983F9Af8Def92fc08F15Be65b' as `0x${string}`,
} as const

// ─── Aerodrome Contract Addresses (Base Mainnet) ─────────────────
export const AERODROME = {
  router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb8AdE1e' as `0x${string}`,
  routerV2: '0xBE6D8f0d05cC4be24d5167a3eF0632D548A02bD2' as `0x${string}`,
  factory: '0x420000000000000000000000000000000000000D' as `0x${string}`,
  voter: '0x16613524e026d731b628eF12d6fC12b0824e0032' as `0x${string}`,
} as const

// ─── Token Addresses ──────────────────────────────────────────────
export const TOKENS = {
  au:   AV_CONTRACTS.auToken,
  ag:   AV_CONTRACTS.agToken,
  weth: '0x4200000000000000000000000000000000000006' as `0x${string}`,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  aero: '0x940181a94A35A4519B9f1E322c818B2C76230030' as `0x${string}`,
} as const

// ─── Chainlink Price Feeds (Base Mainnet) ─────────────────────────
export const CHAINLINK_FEEDS = {
  ethUsd: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' as `0x${string}`,
  usdcUsd: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B' as `0x${string}`,
} as const

// ─── Explorer ─────────────────────────────────────────────────────
export const EXPLORER = {
  url: 'https://basescan.org',
  apiUrl: 'https://api.basescan.org/api',
  apiKey: process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '',
} as const

// ─── Token Metadata ───────────────────────────────────────────────
export const TOKEN_META: Record<string, { name: string; symbol: string; icon: string; color: string; decimals: number }> = {
  au:   { name: 'Artifact Utility',     symbol: 'Au',   icon: 'Au',  color: '#FFD700', decimals: 18 },
  ag:   { name: 'Artifact Governance',  symbol: 'Ag',   icon: 'Ag',  color: '#C0C0C0', decimals: 18 },
  weth: { name: 'Wrapped Ethereum',     symbol: 'WETH', icon: 'Ξ',   color: '#627EEA', decimals: 18 },
  usdc: { name: 'USD Coin',             symbol: 'USDC', icon: '$',   color: '#2775CA', decimals: 6 },
  aero: { name: 'Aerodrome',            symbol: 'AERO', icon: '�',   color: '#0052FF', decimals: 18 },
}

// ─── Known Aerodrome Pools for AV Treasury ────────────────────────
export const KNOWN_POOLS = [
  { id: 'au-ag',   name: 'Au / Ag',   tokenA: TOKENS.au, tokenB: TOKENS.ag,   stable: true },
  { id: 'au-weth', name: 'Au / WETH', tokenA: TOKENS.au, tokenB: TOKENS.weth, stable: false },
  { id: 'ag-weth', name: 'Ag / WETH', tokenA: TOKENS.ag, tokenB: TOKENS.weth, stable: false },
  { id: 'au-usdc', name: 'Au / USDC', tokenA: TOKENS.au, tokenB: TOKENS.usdc, stable: true },
  { id: 'ag-usdc', name: 'Ag / USDC', tokenA: TOKENS.ag, tokenB: TOKENS.usdc, stable: true },
] as const
