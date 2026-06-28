const { ethers } = require("hardhat");
async function main() {
  const libs = [
    ["OnChainBase64", "0x44D47F74728E3e7F8661bcC49524D9702778295C", []],
    ["QuasiCrystalSVG", "0xe23F177d09C1C5388104f0369aE91Cc4eA34E528", []],
  ];
  for (const [name, addr, args] of libs) {
    console.log(`🔍 Verifying ${name}...`);
    try {
      await require("hardhat").run("verify:verify", { address: addr, constructorArguments: args });
      console.log(`✅ ${name} verified`);
    } catch(e) {
      console.log(`⚠️ ${name}: ${e.message.split('\n')[0]}`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
