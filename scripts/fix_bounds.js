const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const ow = await hre.ethers.getContractAt("OracleWrapper", "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB");

  const minB = await ow.auMinPrice();
  const maxB = await ow.auMaxPrice();
  console.log("Current min:", minB.toString());
  console.log("Current max:", maxB.toString());

  const tx = await ow.setPriceBounds(
    1,
    hre.ethers.utils.parseEther("1000.0")
  );
  await tx.wait();
  console.log("Bounds updated to: 1 wei - $1000");

  // Verify
  console.log("New min:", (await ow.auMinPrice()).toString());
  console.log("New max:", (await ow.auMaxPrice()).toString());
}
main().catch(console.error);
