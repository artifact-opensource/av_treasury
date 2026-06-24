module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "./sandbox/contracts_temp",
    artifacts: "./artifacts/sandbox",
    cache: "./cache",
    libraries: ["./lib"],
  },
  networks: {
    sandbox: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
      },
    },
  },
};
