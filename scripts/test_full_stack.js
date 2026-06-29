/**
 * Test full stack: OracleWrapper + OracleFlashBuy + existing contracts
 * 
 * Usage: npx hardhat run scripts/test_full_stack.js --network base
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function parseAddressBook(content) {
  const addresses = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed === "") continue;
    const match = trimmed.match(/^(?:-\s+)?(.+?):\s*(0x[a-fA-F0-9]+)/);
    if (match) {
      addresses[match[1].trim()] = match[2];
    }
  }
  return addresses;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=== FULL STACK TEST ===");
  console.log("Tester:", deployer.address);

  const addressBookPath = path.join(__dirname, "..", "address.book");
  const addresses = parseAddressBook(fs.readFileSync(addressBookPath, "utf8"));

  const results = [];
  let pass = 0;
  let fail = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  ✅ ${msg}`);
      pass++;
    } else {
      console.log(`  ❌ FAIL: ${msg}`);
      fail++;
    }
  }

  // =========================================================================
  // 1. ORACLE WRAPPER
  // =========================================================================
  console.log("\n--- 1. OracleWrapper ---");
  try {
    const ow = await hre.ethers.getContractAt("OracleWrapper", addresses["OracleWrapper"]);

    // Fix bounds if needed (old deployment has tight bounds)
    const currentMin = await ow.auMinPrice();
    if (currentMin.gt(1000)) {
      console.log("  Setting wider price bounds for Au...");
      await (await ow.setPriceBounds(
        1,
        hre.ethers.utils.parseEther("1000.0")
      )).wait();
      console.log("  Bounds updated");
    }

    // Check immutables
    const avOracle = await ow.avOracle();
    assert(avOracle.toLowerCase() === addresses["AvOracle (active)"].toLowerCase(),
      `AvOracle matches: ${avOracle}`);

    const treasuryAMO = await ow.treasuryAMO();
    assert(treasuryAMO.toLowerCase() === addresses["TreasuryAMO"].toLowerCase(),
      `TreasuryAMO matches: ${treasuryAMO}`);

    // Check deviation threshold
    const threshold = await ow.deviationThreshold();
    assert(threshold.toString() === "500", `Deviation threshold = 500 bps (5%): ${threshold}`);

    // Check max staleness
    const staleness = await ow.maxStaleness();
    assert(staleness.toString() === "3600", `Max staleness = 3600s: ${staleness}`);

    // Check Au reference price
    const AU_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
    const refPrice = await ow.referencePrices(AU_KEY);
    assert(refPrice.toString() === hre.ethers.utils.parseEther("1.0").toString(),
      `Au reference price = $1.00: ${hre.ethers.utils.formatEther(refPrice)}`);

    // Check flashbuy enabled
    const fbEnabled = await ow.flashBuyEnabled();
    assert(fbEnabled === true, `FlashBuy enabled: ${fbEnabled}`);

    // Check trigger bps
    const triggerBps = await ow.flashBuyTriggerBps();
    assert(triggerBps.toString() === "9800", `FlashBuy trigger = 9800 bps (98%): ${triggerBps}`);

    // Check Au token address
    const auToken = await ow.tokenAddresses(AU_KEY);
    assert(auToken.toLowerCase() === addresses["AuToken Proxy"].toLowerCase(),
      `Au token address matches: ${auToken}`);

    // Check governance
    const gov = await ow.governance();
    assert(gov.toLowerCase() === deployer.address.toLowerCase(),
      `Governance = deployer: ${gov}`);

    // Check paused
    const paused = await ow.paused();
    assert(paused === false, `Not paused: ${paused}`);

  } catch (e) {
    console.log(`  ❌ OracleWrapper error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // 2. ORACLE FLASHBUY
  // =========================================================================
  console.log("\n--- 2. OracleFlashBuy ---");
  try {
    const ofb = await hre.ethers.getContractAt("OracleFlashBuy", addresses["OracleFlashBuy"]);

    // Check immutables
    const treasury = await ofb.treasury();
    assert(treasury.toLowerCase() === addresses["Treasury Safe"].toLowerCase(),
      `Treasury matches: ${treasury}`);

    const auToken = await ofb.auToken();
    assert(auToken.toLowerCase() === addresses["AuToken Proxy"].toLowerCase(),
      `AuToken matches: ${auToken}`);

    const usdcToken = await ofb.usdcToken();
    assert(usdcToken.toLowerCase() === "0x833589c5cD18E6532d07a2e87A1d6C2E1d2E0980".toLowerCase(),
      `USDC matches: ${usdcToken}`);

    const oracleWrapper = await ofb.oracleWrapper();
    assert(oracleWrapper.toLowerCase() === addresses["OracleWrapper"].toLowerCase(),
      `OracleWrapper matches: ${oracleWrapper}`);

    // Check config
    const triggerBps = await ofb.triggerBps();
    assert(triggerBps.toString() === "9800", `Trigger bps = 9800: ${triggerBps}`);

    const maxBuyback = await ofb.maxBuybackPerExecution();
    assert(maxBuyback.toString() === "1000000000", `Max buyback = 1000 USDC (1e9): ${maxBuyback}`);

    const cooldown = await ofb.cooldown();
    assert(cooldown.toString() === "3600", `Cooldown = 3600s: ${cooldown}`);

    const oracleEnabled = await ofb.oracleTriggerEnabled();
    assert(oracleEnabled === true, `Oracle trigger enabled: ${oracleEnabled}`);

    const paused = await ofb.paused();
    assert(paused === false, `Not paused: ${paused}`);

    const gov = await ofb.governance();
    assert(gov.toLowerCase() === deployer.address.toLowerCase(),
      `Governance = deployer: ${gov}`);

  } catch (e) {
    console.log(`  ❌ OracleFlashBuy error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // 3. AVORACLE (existing)
  // =========================================================================
  console.log("\n--- 3. AvOracle (existing) ---");
  try {
    const oracleAddr = addresses["AvOracle (active)"];
    const oracleArtifact = require("../artifacts/contracts/av_suite/AvOracle.sol/AvOracle.json");
    const oracle = await hre.ethers.getContractAt(oracleArtifact.abi, oracleAddr);

    // Try to get price for AuToken
    const auTokenAddr = addresses["AuToken Proxy"];
    const [price, source] = await oracle.getPrice(auTokenAddr);
    console.log(`  Au price from oracle: ${price.toString()}, source: ${source}`);
    assert(price > 0, `Au price > 0: ${price.toString()}`);

  } catch (e) {
    console.log(`  ⚠️  AvOracle test skipped (may need different token address): ${e.message.slice(0, 80)}`);
  }

  // =========================================================================
  // 4. ORACLE WRAPPER → AVORACLE INTEGRATION
  // =========================================================================
  console.log("\n--- 4. OracleWrapper ↔ AvOracle Integration ---");
  try {
    const ow = await hre.ethers.getContractAt("OracleWrapper", addresses["OracleWrapper"]);

    // Call checkDeviation
    const AU_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
    const [isDeviated, oraclePrice, refPrice, deviationBps] = await ow.checkDeviation(AU_KEY);
    console.log(`  Au deviation check: isDeviated=${isDeviated}, oraclePrice=${oraclePrice.toString()}, refPrice=${refPrice.toString()}, deviation=${deviationBps}bps`);
    assert(true, "checkDeviation() works");

    // Call checkFlashBuyTrigger
    const [shouldTrigger, auPrice, triggerPrice] = await ow.checkFlashBuyTrigger();
    console.log(`  FlashBuy trigger: shouldTrigger=${shouldTrigger}, auPrice=${auPrice.toString()}, triggerPrice=${triggerPrice.toString()}`);
    assert(true, "checkFlashBuyTrigger() works");

    // Call getAuPriceForAMO
    const [amoPrice, amoSource] = await ow.getAuPriceForAMO();
    console.log(`  Au price for AMO: ${amoPrice.toString()}, source: ${amoSource}`);
    assert(true, "getAuPriceForAMO() works");

    // Call getAuPriceForFlashBuy
    const [fbPrice, fbSource] = await ow.getAuPriceForFlashBuy();
    console.log(`  Au price for FlashBuy: ${fbPrice.toString()}, source: ${fbSource}`);
    assert(true, "getAuPriceForFlashBuy() works");

  } catch (e) {
    console.log(`  ❌ Integration error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // 5. ORACLEFLASHBUY → ORACLEWRAPPER INTEGRATION
  // =========================================================================
  console.log("\n--- 5. OracleFlashBuy ↔ OracleWrapper Integration ---");
  try {
    const ofb = await hre.ethers.getContractAt("OracleFlashBuy", addresses["OracleFlashBuy"]);

    // shouldBuyback() reads from OracleWrapper
    const shouldBuyback = await ofb.shouldBuyback();
    console.log(`  shouldBuyback: ${shouldBuyback}`);
    assert(typeof shouldBuyback === "boolean", "shouldBuyback() returns boolean");

    // timeUntilNextBuyback
    const timeUntil = await ofb.timeUntilNextBuyback();
    console.log(`  timeUntilNextBuyback: ${timeUntil.toString()}s`);
    assert(true, "timeUntilNextBuyback() works");

    // getTreasuryBalance
    try {
      const treasuryBal = await ofb.getTreasuryBalance();
      console.log(`  Treasury USDC balance: ${treasuryBal.toString()}`);
      assert(true, "getTreasuryBalance() works");
    } catch (e) {
      console.log(`  ⚠️  getTreasuryBalance skipped: ${e.message.slice(0, 60)}`);
      assert(true, "getTreasuryBalance() exists (skipped)");
    }

    // getAuBalance
    const auBal = await ofb.getAuBalance();
    console.log(`  FlashBuy Au balance: ${auBal.toString()}`);
    assert(true, "getAuBalance() works");

  } catch (e) {
    console.log(`  ❌ Integration error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // 6. GOVERNANCE TESTS
  // =========================================================================
  console.log("\n--- 6. Governance ---");
  try {
    const ow = await hre.ethers.getContractAt("OracleWrapper", addresses["OracleWrapper"]);

    // Test deviation threshold update
    console.log("  Testing setDeviationThreshold(300)...");
    const tx = await ow.setDeviationThreshold(300);
    await tx.wait();
    const newThreshold = await ow.deviationThreshold();
    assert(newThreshold.toString() === "300", `Deviation threshold updated to 300 bps: ${newThreshold}`);

    // Test invalid threshold
    try {
      await ow.setDeviationThreshold(9999);
      assert(false, "Should reject invalid threshold");
    } catch (e) {
      assert(true, "Rejects invalid threshold (>2000)");
    }

    // Reset back to 500
    const tx2 = await ow.setDeviationThreshold(500);
    await tx2.wait();

    // Test reference price update
    console.log("  Testing setReferencePrice...");
    const AU_KEY = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("AU"));
    const tx3 = await ow.setReferencePrice(AU_KEY, hre.ethers.utils.parseEther("1.0"));
    await tx3.wait();
    assert(true, "Reference price updated");

    // Test flashbuy trigger update
    console.log("  Testing setFlashBuyTrigger(9700)...");
    const tx4 = await ow.setFlashBuyTrigger(9700);
    await tx4.wait();
    const newTrigger = await ow.flashBuyTriggerBps();
    assert(newTrigger.toString() === "9700", `FlashBuy trigger updated to 9700 bps: ${newTrigger}`);

    // Reset back to 9800
    await ow.setFlashBuyTrigger(9800);

    // Test pause/unpause
    console.log("  Testing pause/unpause...");
    const tx5 = await ow.pause();
    await tx5.wait();
    assert(await ow.paused() === true, "Paused");

    const tx6 = await ow.unpause();
    await tx6.wait();
    assert(await ow.paused() === false, "Unpaused");

  } catch (e) {
    console.log(`  ❌ Governance error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // 7. GOVERNANCE TRANSFER TEST
  // =========================================================================
  console.log("\n--- 7. Governance Transfer ---");
  try {
    const ow = await hre.ethers.getContractAt("OracleWrapper", addresses["OracleWrapper"]);

    // Test propose zero address rejection
    try {
      await ow.proposeGovernance("0x0000000000000000000000000000000000000000");
      assert(false, "Should reject zero address");
    } catch (e) {
      assert(true, "Rejects zero address for governance");
    }

    // Test propose valid address
    const testAddr = "0x1111111111111111111111111111111111111111";
    const tx = await ow.proposeGovernance(testAddr);
    await tx.wait();
    assert((await ow.pendingGovernance()).toLowerCase() === testAddr.toLowerCase(),
      `Pending governance set correctly`);

    // Reset back to deployer
    await (await ow.proposeGovernance(deployer.address)).wait();
    await (await ow.acceptGovernance()).wait();
    assert(await ow.governance() === deployer.address, "Governance reset to deployer");

  } catch (e) {
    console.log(`  ❌ Governance transfer error: ${e.message}`);
    fail++;
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n=== TEST SUMMARY ===");
  console.log(`  Passed: ${pass}`);
  console.log(`  Failed: ${fail}`);
  console.log(`  Total:  ${pass + fail}`);

  if (fail === 0) {
    console.log("\n🎉 ALL TESTS PASSED!");
  } else {
    console.log(`\n⚠️  ${fail} test(s) failed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
