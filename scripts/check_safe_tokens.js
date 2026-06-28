const { ethers } = require("hardhat");
async function main() {
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const AG = "0x1D31719389Bd8b17277Ba367c26b830aE34D3674";
  
  const abi = ["function balanceOf(address) view returns (uint256)"];
  
  for (const [name, token] of [["AU", AU], ["AG", AG]]) {
    try {
      const t = new ethers.Contract(token, abi, ethers.provider);
      const bal = await t.balanceOf(SAFE);
      console.log(`Safe ${name} balance:`, bal.toString());
    } catch(e) {}
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
