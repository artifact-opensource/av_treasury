export const BASE_CHAIN_ID = 8453

export const AV_CONTRACTS = {
  auToken: '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08' as `0x${string}`,
  agToken: '0x1D31719389Bd8b17277Ba367c26b830aE34D3674' as `0x${string}`,
  oracle: '0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19' as `0x${string}`,
  pidController: '0xB8F240870DBc1cD5F9262F8180350A29ea404268' as `0x${string}`,
  treasuryAMO: '0xF096cD4D24811B0F824c929907196bCB796bca88' as `0x${string}`,
  staking: '0x8F638B6C2EBD61A638561B6993930CF25D53ACB9' as `0x${string}`,
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
