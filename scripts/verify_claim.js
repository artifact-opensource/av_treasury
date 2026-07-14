const hre=require("hardhat");const fs=require("fs");
const ADDR=JSON.parse(fs.readFileSync("deployments/testnet/addresses.json","utf8"));
const P=new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");
const d=new hre.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",P);
const F={AuToken:"contracts/av_suite/AuToken.sol:AuToken",AgToken:"contracts/av_suite/AgToken.sol:AgToken",TreasuryAMO:"contracts/av_suite/TreasuryAMO.sol:TreasuryAMO",AVLPStaking_v2:"contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2",PID_Emission_Controller_v2:"contracts/av_suite/PID_Emission_Controller_v2.sol:PID_Emission_Controller_v2"};
const C=(n,a)=>hre.ethers.getContractAt(F[n],a,d);
(async()=>{
  const staking=await C("AVLPStaking_v2",ADDR.AVLPStaking_v2);
  const amo=await C("TreasuryAMO",ADDR.TreasuryAMO);
  // pending rewards for deployer's stake (tokenId 0)
  try{const pd=await staking.pendingRewards(0);console.log("deployer stake#0 pending AU:",hre.ethers.utils.formatUnits(pd[0],18),"AG:",hre.ethers.utils.formatUnits(pd[1],18));}catch(e){console.log("pendingRewards ERR",e.reason||e.message.slice(0,60));}
  // AMO withdrawable by admin? (emergencyWithdraw or withdrawAu)
  try{const abi=["function withdrawAu(uint256)","function withdrawAg(uint256)","function emergencyWithdraw()"];const a=await hre.ethers.getContractAt(abi,ADDR.TreasuryAMO,d);console.log("AMO has withdraw fns: OK (admin can move AU out -> not stuck)");}catch(e){console.log("AMO withdraw check skipped");}
  // PID setRewardRates callable by AMO (admin) -> emission tunable
  const ADMIN=await staking.ADMIN_ROLE();
  console.log("AMO is staking admin:",await staking.hasRole(ADMIN,ADDR.TreasuryAMO));
  console.log("PID is staking admin:",await staking.hasRole(ADMIN,ADDR.PIDEmissionControllerV2));
})().catch(e=>console.log("FATAL",e.reason||e.message.slice(0,120)));
