const { ethers } = require("hardhat");
async function main() {
  const addrs = {
    'AgToken': '0x1D31719389Bd8b17277Ba367c26b830aE34D3674',
    'AuToken': '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08',
    'Treasury': '0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e',
    'AMO': '0xBE96ad6165e8C1b88e86533F3968C318e860168F',
  };
  for (const [name, addr] of Object.entries(addrs)) {
    const code = await ethers.provider.getCode(addr);
    console.log(name + ':', code.length > 10 ? '✅ deployed' : '❌ no code');
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
