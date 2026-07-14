const hre=require("hardhat");const fs=require("fs");
(async()=>{
  const ADDR=JSON.parse(fs.readFileSync("deployments/testnet/addresses.json","utf8"));
  const P=new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
  const d=new hre.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",P);
  const amo=await hre.ethers.getContractAt("contracts/av_suite/TreasuryAMO.sol:TreasuryAMO",ADDR.TreasuryAMO,d);
  const EXEC=await amo.EXECUTOR_ROLE();
  console.log("AMO EXECUTOR_ROLE:",EXEC);
  console.log("keeper(0x7099) has EXEC:",await amo.hasRole(EXEC,"0x70997970C51812dc3A010C7d01b50e0d17dc79C8"));
  console.log("deployer has EXEC:",await amo.hasRole(EXEC,d.address));
  console.log("deployer is DEFAULT_ADMIN:",await amo.hasRole(await amo.DEFAULT_ADMIN_ROLE(),d.address));
})().catch(e=>console.log("FATAL",e.reason||e.message.slice(0,120)));
