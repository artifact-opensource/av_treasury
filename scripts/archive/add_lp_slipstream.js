const { ethers } = require("hardhat");

async function main() {
  const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const WETH = "0x4200000000000000000000000000000000000006";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  const TREASURY = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const [deployer] = await ethers.getSigners();
  
  // First, transfer AU to Treasury (it should already be there from mint_and_distribute.js)
  // Check AU balance of Treasury
  const au = new ethers.Contract(AU, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function transfer(address, uint256) returns (bool)",
  ], ethers.provider);
  
  const treasuryBal = await au.balanceOf(TREASURY);
  console.log("Treasury AU balance:", ethers.utils.formatUnits(treasuryBal, 18));
  
  // If treasury doesn't have enough, transfer from deployer
  const deployerBal = await au.balanceOf(deployer.address);
  console.log("Deployer AU balance:", ethers.utils.formatUnits(deployerBal, 18));
  
  // Mint 100K AU to treasury if needed
  if (treasuryBal.lt(ethers.utils.parseUnits("100000", 18))) {
    console.log("Minting 100K AU to Treasury...");
    const mintTx = await au.transfer(TREASURY, ethers.utils.parseUnits("100000", 18));
    await mintTx.wait();
  }
  
  // Now approve the PositionManager to spend AU from Treasury
  // We need to do this via the Treasury contract
  const treasury = new ethers.Contract(TREASURY, [
    "function approve(address, address, uint256) external",
    "function execute(address, uint256, bytes) external",
  ], deployer);
  
  // Actually, let's just use the Treasury as a Safe that can call any function
  // The Treasury should be a Safe/DAO that can call mint on the PositionManager
  
  // Encode the approve call: au.approve(POSITION_MANAGER, amount)
  const approveCalldata = au.interface.encodeFunctionData("approve", [
    POSITION_MANAGER,
    ethers.utils.parseUnits("100000", 18),
  ]);
  
  console.log("Approving PM to spend AU...");
  // If Treasury is a Safe, we should use execTransaction
  // But let's try calling approve directly from deployer to the AU contract
  // The Treasury needs to hold the AU and approve the PM
  
  // Check if the Treasury is the AU contract owner or if we can call approve on behalf
  // Actually - the AU tokens are in the Treasury, so the Treasury needs to approve
  // Let's check if Treasury has an execute function
  
  try {
    // Try calling as if Treasury is a Safe
    const execTx = await treasury.execute(AU, 0, approveCalldata, { gasLimit: 100000 });
    await execTx.wait();
    console.log("✅ Approved via Treasury.execute()");
  } catch(e) {
    console.log("Treasury.execute() failed:", e.message.substring(0, 100));
    
    // Alternative: transfer AU to deployer first, then mint directly
    console.log("Alternative: transferring AU to deployer and minting directly...");
    
    // Transfer AU from Treasury to deployer
    const transferCalldata = au.interface.encodeFunctionData("transfer", [
      deployer.address,
      ethers.utils.parseUnits("100000", 18),
    ]);
    
    try {
      const xferTx = await treasury.execute(AU, 0, transferCalldata, { gasLimit: 100000 });
      await xferTx.wait();
      console.log("Transferred AU to deployer");
    } catch(e2) {
      console.log("Transfer also failed:", e2.message.substring(0, 100));
      console.log("Trying direct transfer from deployer...");
      // Maybe the deployer has the tokens
    }
  }
  
  // Now check deployer balance and approve PM
  const depBal = await au.balanceOf(deployer.address);
  console.log("Deployer AU balance:", ethers.utils.formatUnits(depBal, 18));
  
  if (depBal.gte(ethers.utils.parseUnits("100000", 18))) {
    console.log("Approving PM from deployer...");
    const approveTx = await au.approve(POSITION_MANAGER, ethers.utils.parseUnits("100000", 18));
    await approveTx.wait();
    console.log("✅ Approved");
    
    // Now mint the LP position
    const pm = new ethers.Contract(POSITION_MANAGER, [
      "function mint((address,address,bool,int24,int24,uint256,uint256,uint256,uint256,address,uint256)) returns (uint256, uint128)",
    ], deployer);
    
    // One-sided LP: provide only AU (token0)
    // We need to figure out which is token0 and token1
    // Au address < WETH address (0x0c5A... < 0x4200...)
    // So Au = token0, WETH = token1
    
    const params = {
      token0: AU,           // Au is token0 (lower address)
      token1: WETH,          // WETH is token1
      tickSpacing: 100,      // volatile pool with tickSpacing=100
      tickLower: -887200,    // min tick for volatile
      tickUpper: 887200,     // max tick for volatile
      amount0Desired: ethers.utils.parseUnits("100000", 18),  // 100K Au
      amount1Desired: 0,     // No WETH (one-sided)
      amount0Min: 0,         // Accept whatever we get (one-sided, no slippage on token1)
      amount1Min: 0,
      recipient: TREASURY,   // LP goes to Treasury
      deadline: Math.floor(Date.now() / 1000) + 300,  // 5 min
    };
    
    console.log("Minting LP position...");
    const mintTx = await pm.mint(params, { gasLimit: 500000 });
    const receipt = await mintTx.wait();
    console.log("✅ LP minted! Gas:", receipt.gasUsed.toString());
    console.log("Logs:", receipt.logs.length);
    for (const log of receipt.logs) {
      if (log.topics[0] === "0x7a53080ba414258570b4ca80b9b6c57d89b36883c08b587c78a56e0b8b9e5e5e") {
        console.log("  Pool created event");
      }
    }
  } else {
    console.log("❌ Not enough AU. Need to figure out token flow.");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
