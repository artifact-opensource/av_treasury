const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const ORACLE = "0x6A4BFA98EA5FD675C907B48C65AD2243D80DED19";
  const AU = "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08";
  const POOL = "0xA41aB59dDDE5bA9b561f838d0B23268ADB863665";
  
  // Step 1: Call updatePrice from Safe (has ORACLE_ADMIN) to initialize reserves
  // The Safe needs to call oracle.updatePrice(AU)
  // We know updatePrice exists and works when called from oracle itself
  
  // Let's try: first updatePrice, then getPrice
  // Simulate updatePrice(SAFE) which has ORACLE_ADMIN
  const SAFE = "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e";
  
  const updateSelector = "0x96e85ced"; // updatePrice(address)
  const updateData = updateSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2);
  
  try {
    await provider.call({ from: SAFE, to: ORACLE, data: updateData });
    console.log("✅ updatePrice(AU) from Safe succeeded");
  } catch(e) { console.log("❌ updatePrice error:", e.reason || e.message.slice(0,80)); }
  
  // Step 2: Now try getPrice
  const priceSelector = "0x41976e09"; // getPrice(address)
  const priceData = priceSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2);
  
  try {
    const result = await provider.call({ to: ORACLE, data: priceData });
    const [price, decimals] = ethers.utils.defaultAbiCoder.decode(["uint256", "uint8"], result);
    console.log("✅ getPrice(AU):", price.toString(), "decimals:", decimals);
    console.log("Formatted:", ethers.utils.formatUnits(price, decimals));
  } catch(e) { console.log("❌ getPrice error:", e.reason || e.message.slice(0,80)); }
  
  // Step 3: Try getTwapPrice again (maybe it needs reserves initialized first)
  const twapSelector = "0x63cde84b"; // getTwapPrice(address)
  const twapData = twapSelector + ethers.utils.defaultAbiCoder.encode(["address"], [AU]).slice(2);
  
  try {
    const result = await provider.call({ to: ORACLE, data: twapData });
    const price = ethers.utils.defaultAbiCoder.decode(["uint256"], result)[0];
    console.log("✅ getTwapPrice(AU):", price.toString());
  } catch(e) { console.log("❌ getTwapPrice still reverts:", e.reason || e.message.slice(0,80)); }
  
  // Step 4: Try getAuAgPrices
  const auAgSelector = "0xeb813feb"; // getAuAgPrices()
  try {
    const result = await provider.call({ to: ORACLE, data: auAgSelector });
    const [auPrice, agPrice] = ethers.utils.defaultAbiCoder.decode(["uint256", "uint256"], result);
    console.log("✅ getAuAgPrices():", auPrice.toString(), agPrice.toString());
  } catch(e) { console.log("❌ getAuAgPrices error:", e.reason || e.message.slice(0,80)); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
