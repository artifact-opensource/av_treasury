const { ethers } = require("hardhat");

async function main() {
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  
  // Let's get the full ABI and try to decode what's happening
  // First, check if the oracle has an owner() or any state we can read
  const basicAbi = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  ];
  
  const oracle = new ethers.Contract(ORACLE, basicAbi, ethers.provider);
  
  try {
    const owner = await oracle.owner();
    console.log("Owner:", owner);
  } catch(e) { console.log("No owner()"); }
  
  try {
    const paused = await oracle.paused();
    console.log("Paused:", paused);
  } catch(e) { console.log("No paused()"); }
  
  // Check roles
  const GOVERNOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNOR"));
  try {
    const admin = await oracle.getRoleAdmin(GOVERNOR);
    consoleNOR admin role:", admin);
  } catch(e) { console.log("getRoleAdmin failed"); }
  
  // Now the real question: does the call even ENTER the function?
  // Maybe it's reverting on a modifier check
  // Check: does the oracle have an onlyGovernor or onlyAdmin modifier on getTwapPrice?
  // From the code: getTwapPrice is public view with no modifier
  
  // Let me try calling with value=0 and different gas settings
  try {
    const result = await ethers.provider.call({
      from: ethers.constants.AddressZero,
      to: ORACLE,
      data: "0x63cde84b0000000000000000000000000c5a9a970b9c9b77a1ddb1cd62f279ce6cda2f08",
      gasLimit: 100000,
    });
    console.log("Call succeeded:", result);
  } catch(e) {
    console.log("Call with zero address sender also reverted:", e.message.slice(0, 100));
  }
  
  // Let me try with a much higher gas limit
  try {
    const result = await ethers.provider.call({
      to: ORACLE,
      data: "0x63cde84b0000000000000000000000000c5a9a970b9c9b77a1ddb1cd62f279ce6cda2f08",
      gasLimit: 500000,
    });
    console.log("Call with 500k gas succeeded:", result);
  } catch(e) {
    console.log("Call with 500k gas also reverted:", e.message.slice(0, 100));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
