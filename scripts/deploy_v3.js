const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const agToken = process.env.AG_TOKEN_ADDR;
  const keeper = process.env.KEEPER_ADDR;
  const admin = process.env.ADMIN_ADDR;

  const PIDControllerV3 = await hre.ethers.getContractFactory("PID_Emission_Controller_v3");
  const controller = await PIDControllerV3.deploy(agToken, keeper, admin);

  await controller.deployed();

  console.log("PID_Emission_Controller_v3 deployed to:", controller.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
