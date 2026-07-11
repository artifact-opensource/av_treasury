require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

// Parse RPC URL — .env has weird quoting: RPC_URL_BASE=['RPC_URL_BASE=https://...','https://...']
function parseRpcUrl(val) {
  if (!val) return undefined;
  // Try to extract URLs from the messy .env format
  const urlMatch = val.match(/https?:\/\/[^\s'")\]]+/);
  if (urlMatch) return urlMatch[0];
  // Fallback: try JSON parse
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string' && item.startsWith('http')) return item;
      }
      return parsed[0];
    }
    return parsed;
  } catch {
    return val;
  }
}

const RPC_URL_BASE = parseRpcUrl(process.env.RPC_URL_BASE);
const BASE_CHAIN_ID = parseInt(process.env.BASE_CHAIN_ID || "8453");
const ETHERSCAN_API_V2 = process.env.ETHERSCAN_API_V2;
// Support multiple key names — DEVELOPER_WALLET_PRIVATE_KEY is the deployer
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEVELOPER_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY_BASE;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
        },
      },
    ],
    overrides: {
      "contracts/av_suite/QuasiCrystalSVG.sol": {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
          viaIR: true,
        },
      },
      "contracts/av_suite/QuasiCrystalLPNFT.sol": {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // Interval mining (not automine) — robust for the analytics engine's throughput.
      mining: { auto: false, interval: 1000 },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Interval mining (not automine) — far more robust for sustained RPC load.
      // Automine causes nonce races (approve+swap from same account) and -32603
      // transport corruption under the analytics engine's throughput.
      mining: { auto: false, interval: 1000 },
    },
    base: {
      url: RPC_URL_BASE,
      chainId: BASE_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    baseSepolia: {
      url: process.env.RPC_URL_BASE_SEPOLIA || "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_V2,
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=8453",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/v2/api?chainid=84532",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};
