// propose_flip_bootstrap.js — submit governance proposal to flip oracle bootstrap OFF
// Governor 0x5F06 (vote-based, 1e6 Ag threshold) -> Timelock 0x09058 -> Oracle 0x1B5F.setBootstrapMode(false)
const e = require("ethers");

async function main() {
  const RPC = process.env.RPC_URL_BASE;
  const PK = process.env.DEVELOPER_WALLET_PRIVATE_KEY; // deployer / proposer key
  if (!PK) throw new Error("DEVELOPER_WALLET_PRIVATE_KEY missing");

  const provider = new e.providers.JsonRpcProvider(RPC);
  const wallet = new e.Wallet(PK, provider);

  const GOV = e.utils.getAddress("0x5F061c177b76753686122185989C2332C1d0e8b1");
  const ORACLE = e.utils.getAddress("0x1B5F6AC11efFeEBd5371858ce394DD0B8669732b");

  const govAbi = [
    "function propose(address[],uint256[],bytes[],string) returns (uint256)",
    "function getVotes(address) view returns (uint256)",
    "function proposalThreshold() view returns (uint256)",
    "function votingDelay() view returns (uint256)",
    "function votingPeriod() view returns (uint256)",
    "function state(uint256) view returns (uint8)",
    "function hashProposal(address[],uint256[],bytes[],bytes32) view returns (uint256)"
  ];
  const gov = new e.Contract(GOV, govAbi, wallet);

  const iface = new e.utils.Interface(["function setBootstrapMode(bool)"]);
  const calldata = iface.encodeFunctionData("setBootstrapMode", [false]);

  const targets = [ORACLE];
  const values = ["0"];
  const calldatas = [calldata];
  const description = "Disable bootstrap mode on AV Oracle 0x1B5F (resume normal feed governance)";

  console.log("proposer:", wallet.address);
  console.log("proposer votes:", (await gov.getVotes(wallet.address)).toString());
  console.log("proposalThreshold:", (await gov.proposalThreshold()).toString());
  console.log("votingDelay:", (await gov.votingDelay()).toString(), "votingPeriod:", (await gov.votingPeriod()).toString());

  const tx = await gov.propose(targets, values, calldatas, description, {
    gasLimit: 500000,
    maxPriorityFeePerGas: e.utils.parseUnits("0.005", "gwei"),
    maxFeePerGas: e.utils.parseUnits("0.05", "gwei")
  });
  console.log("TX SUBMITTED:", tx.hash);
  console.log("explorer: https://basescan.org/tx/" + tx.hash);

  const receipt = await tx.wait();
  console.log("status:", receipt.status, "block:", receipt.blockNumber);

  const descHash = e.utils.keccak256(e.utils.toUtf8Bytes(description));
  const pid = await gov.hashProposal(targets, values, calldatas, descHash);
  console.log("PROPOSAL_ID:", pid.toString());
}

main().catch((err) => {
  console.log("SUBMIT FAILED / REVERTED");
  console.log("reason:", err.error?.reason || err.reason || err.message.slice(0, 200));
  if (err.transactionHash) console.log("txHash:", err.transactionHash, "https://basescan.org/tx/" + err.transactionHash);
  process.exit(1);
});
