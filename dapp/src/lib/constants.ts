export const BASE_CHAIN_ID = 8453

export const AV_CONTRACTS = {
  auToken: '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08' as `0x${string}`,
  agToken: '0x1D31719389Bd8b17277Ba367c26b830aE34D3674' as `0x${string}`,
  oracle: '0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19' as `0x${string}`,
  pidController: '0xB8F240870DBc1cD5F9262F8180350A29ea404268' as `0x${string}`,
  treasuryAMO: '0xF096cD4D24811B0F824c929907196bCB796bca88' as `0x${string}`,
  staking: '0x8F638B6C2EBD61A638561B6993930CF25D53ACB9' as `0x${string}`,
  treasurySafe: '0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e' as `0x${string}`, // Treasury Safe (Gnosis Safe)
  governor: '0x5F061c177b76753686122185989C2332C1d0e8b1' as `0x${string}`, // Governor Contract
  timelock: '0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be' as `0x${string}`, // Timelock
};

// Aerodrome Finance contract addresses on Base Mainnet
export const AERODROME = {
  routerV2: '0xBE489A2f3C30dcDa27a4Be1191761ac34014ec2E' as `0x${string}`, // Aerodrome V2 Router (Slipstream)
  voter: '0x8E5B8d8927124Fd4E869986b6B15593d9c2A6131' as `0x${string}`, // Aerodrome Voter
  slipstreamRouter: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43' as `0x${string}`, // Aerodrome Slipstream CL Router (used by AMO)
};

export const EXPLORER = 'https://basescan.org';

export const KNOWN_POOLS = {
  'au-weth': {
    id: 'au-weth',
    name: 'Au/WETH',
    address: '0xA41aB59dDDE5bA9b561f838d0B23268ADB863665' as `0x${string}`,
    tokenA: '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08' as `0x${string}`, // AuToken
    tokenB: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH
    stable: false,
  },
};

export const TOKEN_META: Record<string, { name: string; symbol: string; icon: string; color: string }> = {
  au: { name: "Artifact Utility", symbol: "Au", icon: "https://raw.githubusercontent.com/artifact-virtual/assets/main/tokens/au-gold.svg", color: "#FFD700" },
  ag: { name: "Artifact Governance", symbol: "Ag", icon: "https://raw.githubusercontent.com/artifact-virtual/assets/main/tokens/ag-silver.svg", color: "#C0C0C0" },
  eth: { name: "Ethereum", symbol: "ETH", icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg", color: "#627EEA" },
  weth: { name: "Wrapped Ethereum", symbol: "WETH", icon: "weth", color: "#627EEA" },
  usdc: { name: "USD Coin", symbol: "USDC", icon: "usdc", color: "#2775CA" },
  aero: { name: "Aerodrome", symbol: "AERO", icon: "aero", color: "#0052FF" },
};

export const TOKENS = TOKEN_META;
