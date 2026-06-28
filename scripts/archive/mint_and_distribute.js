/**
 * Mint AuToken and distribute:
 * - 999,000,000 → Treasury Safe (reserves)
 * - 700,000 → Treasury Safe (for staking, until staking deployed)
 * - 300,000 → Deployer (ops)
 *
 * Deployer has MINTER_ROLE.
 * Treasury Safe threshold=1, deployer is owner.
 *
 * Usage:
 *   npx hardhat run scripts/mint_and_distribute.js --network base
 */

const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const AU_TOKEN = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";

  // Amounts (18 decimals)
  const RESERVES = ethers.utils.parseUnits("999000000", 18);
  const STAKING = ethers.utils.parseUnits("700000", 18);
  const OPS = ethers.utils.parseUnits("300000", 18);

  console.log("=".repeat(60));
  console.log("  MINT AuTOKEN — DISTRIBUTION");
  console.log("=".repeat(60));
  console.log(`  Network:  ${network.name}`);
  console.log(`  Deployer: ${deployerAddress}`);
  console.log(`  AuToken:  ${AU_TOKEN}`);
  console.log(`  Treasury: ${TREASURY}`);
  console.log("-".repeat(60));
  console.log(`  Reserves (Treasury):  ${ethers.utils.formatEther(RESERVES)} Au`);
  console.log(`  Staking  (Treasury):  ${ethers.utils.formatEther(STAKING)} Au`);
  console.log(`  Ops      (Deployer):  ${ethers.utils.formatEther(OPS)} Au`);
  console.log(`  TOTAL:                ${ethers.utils.formatEther(RESERVES.add(STAKING).add(OPS))} Au`);
  console.log("=".repeat(60));

  const auToken = await ethers.getContractAt("contracts/av_suite/AuToken.sol:AuToken", AU_TOKEN);

  // Verify deployer has MINTER_ROLE
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const hasMinter = await auToken.hasRole(MINTER_ROLE, deployerAddress);
  if (!hasMinter) {
    throw new Error("Deployer does NOT have MINTER_ROLE!");
  }
  console.log("\n  ✅ Deployer has MINTER_ROLE");

  // Step 1: Mint 999M to Treasury (reserves)
  console.log("\n  📦 Minting 999M Au to Treasury (reserves)...");
  const tx1 = await auToken.connect(deployer).mint(TREASURY, RESERVES);
  await tx1.wait();
  console.log(`  ✅ TX: ${tx1.hash}`);

  // Step 2: Mint 700K to Treasury (staking)
  console.log("\n  📦 Minting 700K Au to Treasury (staking)...");
  const tx2 = await auToken.connect(deployer).mint(TREASURY, STAKING);
  await tx2.wait();
  console.log(`  ✅ TX: ${tx2.hash}`);

  // Step 3: Mint 300K to Deployer (ops)
  console.log("\n  📦 Minting 300K Au to Deployer (ops)...");
  const tx3 = await auToken.connect(deployer).mint(deployerAddress, OPS);
  await tx3.wait();
  console.log(`  ✅ TX: ${tx3.hash}`);

  // Verify balances
  const treasuryBal = await auToken.balanceOf(TREASURY);
  const deployerBal = await auToken.balanceOf(deployerAddress);
  const totalSupply = await auToken.totalSupply();

  console.log("\n" + "=".repeat(60));
  console.log("  FINAL BALANCES");
  console.log("=".repeat(60));
  console.log(`  Treasury Safe:  ${ethers.utils.formatEther(treasuryBal)} Au  (expected: ${ethers.utils.formatEther(RESERVES.add(STAKING))})`);
  console.log(`  Deployer:       ${ethers.utils.formatEther(deployerBal)} Au  (expected: ${ethers.utils.formatEther(OPS)})`);
  console.log(`  Total Supply:   ${ethers.utils.formatEther(totalSupply)} Au`);
  console.log("=".repeat(60));

  // Verify correctness
  const expectedTotal = RESERVES.add(STAKING).add(OPS);
  if (!totalSupply.eq(expectedTotal)) {
    throw new Error(`Total supply mismatch! Got ${totalSupply}, expected ${expectedTotal}`);
  }
  if (!treasuryBal.eq(RESERVES.add(STAKING))) {
    throw new Error(`Treasury balance mismatch!`);
  }
  if (!deployerBal.eq(OPS)) {
    throw new Error(`Deployer balance mismatch!`);
  }

  console.log("\n  ✅ All balances verified correctly");
  console.log("\n✅ DONE\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ FAILED:", error.message);
    process.exit(1);
  });
