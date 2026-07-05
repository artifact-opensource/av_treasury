export const BASE_CHAIN_ID = 8453

export const AV_CONTRACTS = {
  auToken: '0x9A3E5E5b8c4F0e9E8D7c6B5A4f3E2D1C0B9A8F7E6D' as `0x${string}`,
  agToken: '0x8B2D4C6F8E0A9C7B5D3F1E2A4C6D8F0B2E4A6C8D' as `0x${string}`,
  artuToken: '0x7C1F3E5D7B9A0C2E4F6D8B0A2C4E6F8D0A2C4E6F' as `0x${string}`,
  artgToken: '0x6D0E2F4A6C8E0B2D4F6A8C0E2F4A6C8E0B2D4F6A' as `0x${string}`,
  router: '0x5E9F1D3A5C7E9B1D3F5A7C9E1B3D5F7A9C1E3F5B' as `0x${string}`,
  aerodromeRouter: '0x4D8E0C2A4F6E8B0D2A4C6E8F0A2C4E6F8D0A2C' as `0x${string}`,
  aerodromeFactory: '0x3C7F9D1B3E5A7C9E1F3A5C7E9B1D3F5A7C9E1B' as `0x${string}`,
  aerodromePool: '0x2B6E8C0A4F6D8B0E2A4C6E8F0A2C4E6F8D0A2C' as `0x${string}`,
  avOracle: '0x1A5F7D9B1C3E5A7F9D1B3E5A7C9E1F3A5C7E9B1D' as `0x${string}`,
  staking: '0x0F4E6C8A0B2D4F6A8C0E2F4A6C8E0B2D4F6A8C0E' as `0x${string}`,
  governance: '0xF0E2D4C6A8B0E2F4A6C8E0A2C4E6F8D0A2C4E6F' as `0x${string}`,
  treasurySafe: '0xE1D3C5A7B9E1F3A5C7E9B1D3F5A7C9E1B3F5A7C9' as `0x${string}`,
  governor: '0xD2C4E6A8B0F2E4A6C8E0A2C4E6F8D0A2C4E6F8D0' as `0x${string}`,
  voter: '0xC3E5A7B9E1F3A5C7E9B1D3F5A7C9E1B3F5A7C9E1' as `0x${string}`,
  oracle: '0x1A5F7D9B1C3E5A7F9D1B3E5A7C9E1F3A5C7E9B1D' as `0x${string}`,
  routerV2: '0x4D8E0C2A4F6E8B0D2A4C6E8F0A2C4E6F8D0A2C' as `0x${string}`,
} as const

export const TOKENS = {
  au:   AV_CONTRACTS.auToken,
  ag:   AV_CONTRACTS.agToken,
  artu: AV_CONTRACTS.artuToken,
  artg: AV_CONTRACTS.artgToken,
  weth: '0x4200000000000000000000000000000000000006' as `0x${string}`,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  aero: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' as `0x${string}`,
} as const

export const TOKEN_META = {
  au:   { symbol: 'Au', name: 'Artifact Gold',   decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/au.png', coingeckoId: 'artifact-gold' },
  ag:   { symbol: 'Ag', name: 'Artifact Silver', decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/ag.png', coingeckoId: 'artifact-silver' },
  artu: { symbol: 'ARTU', name: 'Artifact Utility', decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/artu.png', coingeckoId: 'artifact-utility' },
  artg: { symbol: 'ARTG', name: 'Artifact Governance', decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/artg.png', coingeckoId: 'artifact-governance' },
  weth: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/weth.png', coingeckoId: 'ethereum' },
  usdc: { symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/usdc.png', coingeckoId: 'usd-coin' },
  aero: { symbol: 'AERO', name: 'Aerodrome', decimals: 18, logo: 'https://raw.githubusercontent.com/artifact-opensource/assets/main/tokens/aero.png', coingeckoId: 'aerodrome-finance' },
} as const

export const AERODROME = {
  router: AV_CONTRACTS.aerodromeRouter,
  routerV2: AV_CONTRACTS.routerV2,
  factory: AV_CONTRACTS.aerodromeFactory,
  pool: AV_CONTRACTS.aerodromePool,
  voter: AV_CONTRACTS.voter,
} as const

export const KNOWN_POOLS = [
  { name: 'Au/USDC', token0: TOKENS.au, token1: TOKENS.usdc, stable: false, fee: 3000, address: AV_CONTRACTS.aerodromePool },
  { name: 'Ag/USDC', token0: TOKENS.ag, token1: TOKENS.usdc, stable: false, fee: 3000, address: AV_CONTRACTS.aerodromePool },
  { name: 'ARTU/USDC', token0: TOKENS.artu, token1: TOKENS.usdc, stable: false, fee: 3000, address: AV_CONTRACTS.aerodromePool },
  { name: 'ARTG/USDC', token0: TOKENS.artg, token1: TOKENS.usdc, stable: false, fee: 3000, address: AV_CONTRACTS.aerodromePool },
  { name: 'Au/Ag', token0: TOKENS.au, token1: TOKENS.ag, stable: true, fee: 100, address: AV_CONTRACTS.aerodromePool },
] as const

export const EXPLORER = {
  url: 'https://basescan.org',
  tx: (hash: string) => `https://basescan.org/tx/${hash}`,
  address: (addr: string) => `https://basescan.org/address/${addr}`,
  token: (addr: string) => `https://basescan.org/token/${addr}`,
} as const
