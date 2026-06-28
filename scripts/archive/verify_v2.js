// Verify contracts on Basescan using Etherscan V2 API directly
// Usage: node scripts/verify_v2.js

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const API_KEY = process.env.ETHERSCAN_API_V2;
const CHAIN_ID = 8453;
const API_BASE = "https://api.etherscan.io/v2/api";

// Load deployed addresses
const deployedPath = path.join(__dirname, "..", "deployed_tokens.json");
const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { timeout: 30000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function submitVerification(name, address, sourceCode, constructorArgs, library) {
  console.log(`\n[Verifying ${name} at ${address}...]`);
  
  const params = new URLSearchParams();
  params.set("chainid", CHAIN_ID);
  params.set("module", "contract");
  params.set("action", "verifysourcecode");
  params.set("apikey", API_KEY);
  params.set("codeformat", "solidity-standard-json-input");
  params.set("sourceCode", sourceCode);
  params.set("contractaddress", address);
  params.set("contractname", name);
  params.set("compilerversion", "v0.8.26");
  params.set("optimizationUsed", "1");
  params.set("runs", "200");
  params.set("evmVersion", "cancun");
  if (constructorArgs) {
    params.set("constructorArguements", constructorArgs);
  }
  if (library) {
    params.set("libraryname1", library.name);
    params.set("libraryaddress1", library.address);
  }

  const url = `${API_BASE}?${params.toString()}`;
  
  try {
    const response = await httpGet(url);
    const result = JSON.parse(response);
    
    if (result.status === "1") {
      console.log(`  ✅ ${name} submitted. GUID: ${result.result}`);
      return result.result; // GUID for status check
    } else {
      console.log(`  ❌ ${name} failed: ${result.message} - ${result.result}`);
      return null;
    }
  } catch (e) {
    console.log(`  ❌ ${name} error: ${e.message}`);
    return null;
  }
}

async function checkStatus(guid) {
  const params = new URLSearchParams();
  params.set("chainid", CHAIN_ID);
  params.set("module", "contract");
  params.set("action", "checkverifystatus");
  params.set("apikey", API_KEY);
  params.set("guid", guid);
  
  const url = `${API_BASE}?${params.toString()}`;
  const response = await httpGet(url);
  const result = JSON.parse(response);
  return result;
}

async function main() {
  // Read the Hardhat build artifact (standard JSON input)
  const artifactsDir = path.join(__dirname, "..", "artifacts");
  
  // We need to construct the standard JSON input for verification
  // For simplicity, we'll use the flattened source approach
  
  console.log("=== Etherscan V2 Verification ===");
  console.log("Chain ID:", CHAIN_ID);
  console.log("Deployer:", deployed.AgToken);
  console.log("---");

  // For each contract, we need to submit the source code
  // The Etherscan V2 API expects the full standard JSON input
  
  // Let's try a simpler approach - use the hardhat-etherscan plugin
  // but with a patched API URL that includes chainId
  
  console.log("Using direct API submission...");
  
  // Read source files
  const svgSource = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "av_suite", "QuasiCrystalSVG.sol"),
    "utf8"
  );
  const agTokenSource = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "av_suite", "AgToken.sol"),
    "utf8"
  );
  const auTokenSource = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "av_suite", "AuToken.sol"),
    "utf8"
  );
  const nftSource = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "av_suite", "QuasiCrystalLPNFT.sol"),
    "utf8"
  );

  // Submit verifications one by one
  const results = {};
  
  // 1. QuasiCrystalSVG
  results.svg = await submitVerification(
    "QuasiCrystalSVG",
    deployed.QuasiCrystalSVG,
    JSON.stringify({
      language: "Solidity",
      sources: { "QuasiCrystalSVG.sol": { content: svgSource } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "cancun",
        viaIR: true,
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.sourceMap"] } },
      },
    }),
    null,
    null
  );

  // 2. AgToken implementation
  results.agImpl = await submitVerification(
    "AgToken",
    deployed.AgTokenImpl,
    JSON.stringify({
      language: "Solidity",
      sources: { "AgToken.sol": { content: agTokenSource } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "cancun",
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.sourceMap"] } },
      },
    }),
    null,
    null
  );

  // 3. AuToken implementation
  results.auImpl = await submitVerification(
    "AuToken",
    deployed.AuTokenImpl,
    JSON.stringify({
      language: "Solidity",
      sources: { "AuToken.sol": { content: auTokenSource } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "cancun",
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.sourceMap"] } },
      },
    }),
    null,
    null
  );

  // 4. QuasiCrystalLPNFT
  results.nft = await submitVerification(
    "QuasiCrystalLPNFT",
    deployed.QuasiCrystalLPNFT,
    JSON.stringify({
      language: "Solidity",
      sources: { "QuasiCrystalLPNFT.sol": { content: nftSource } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "cancun",
        viaIR: true,
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.sourceMap"] } },
        libraries: {
          "QuasiCrystalSVG.sol": { QuasiCrystalSVG: deployed.QuasiCrystalSVG },
        },
      },
    }),
    "000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000ec2b8ee9266e0c4540aa9ba2f6637640b019fa7e000000000000000000000000000000000000000000000000000000000000000c51756173694372797374616c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000451434c5000000000000000000000000000000000000000000000000000000000000000000000000000000000ec2b8ee9266e0c4540aa9ba2f6637640b019fa7e0000000000000000000000000ec2b8ee9266e0c4540aa9ba2f6637640b019fa7e",
    null
  );

  console.log("\n=== Verification Submitted ===");
  console.log(JSON.stringify(results, null, 2));
  
  // Save GUIDs for status checking
  fs.writeFileSync(
    path.join(__dirname, "..", "verification_guids.json"),
    JSON.stringify(results, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
