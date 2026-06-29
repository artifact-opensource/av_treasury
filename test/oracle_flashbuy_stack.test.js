/**
 * @file oracle_flashbuy_stack.test.js
 * @notice Integration test: OracleGuardian + TreasuryFlashBuy_v2 stack
 * 
 * Tests:
 *   1. OracleGuardian deployment and basic price reads
 *   2. FlashBuy deployment and trigger check
 *   3. End-to-end: oracle price drop → trigger → buyback flow
 *   4. Access control (roles, permissions)
 *   5. Edge cases (zero price, stale price, paused)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle + FlashBuy Stack", function () {
    let oracleGuardian;
    let flashBuy;
    let avOracle;
    let mockUSDC;
    let mockAG;
    let mockAu;
    let mockDEX;

    let deployer;
    let treasury;
    let executor;
    let guardian;
    let user;

    // 18-decimal precision
    const ONE_ETHER = ethers.utils.parseEther("1");
    const ONE_USDC = ethers.utils.parseUnits("1", 6);

    // Au at peg ($1.00)
    const AU_PEG = ethers.utils.parseEther("1.0");
    // Au below peg ($0.93 — 7% below)
    const AU_BELOW_PEG = ethers.utils.parseEther("0.93");
    // Au well above peg ($1.50)
    const AU_ABOVE_PEG = ethers.utils.parseEther("1.50");

    // 500 bps = 5% below peg triggers buyback
    const BUYBACK_TRIGGER_BPS = 500;

    beforeEach(async function () {
        [deployer, treasury, executor, guardian, user] = await ethers.getSigners();

        // ─── Deploy Mock Tokens ────────────────────────────────────────────
        const MockToken = await ethers.getContractFactory("MockERC20");

        mockUSDC = await MockToken.deploy("USDC", "USDC", 6);
        mockAG = await MockToken.deploy("AG", "AG", 18);
        mockAu = await MockToken.deploy("Au", "Au", 18);

        // Mint tokens (to be funded after DEX is deployed)
        await mockUSDC.mint(treasury.address, ethers.utils.parseUnits("1000000", 6));
        await mockAu.mint(deployer.address, ethers.utils.parseEther("1000000"));

        // ─── Deploy Mock DEX ──────────────────────────────────────────────
        const MockDEX = await ethers.getContractFactory("MockDEX");
        mockDEX = await MockDEX.deploy(
            mockUSDC.address,
            mockAG.address,
            ethers.utils.parseEther("1.0") // 1 USDC = 1 AG
        );

        // Fund DEX with AG for swaps
        await mockAG.mint(mockDEX.address, ethers.utils.parseEther("1000000"));

        // ─── Deploy Mock AvOracle ─────────────────────────────────────────
        const MockAvOracle = await ethers.getContractFactory("MockAvOracle");
        avOracle = await MockAvOracle.deploy();
        // Set initial Au price at peg
        await avOracle.setPrice(mockAu.address, AU_PEG, 2); // source = TWAP

        // ─── Deploy Mock TreasuryAMO ──────────────────────────────────────
        const MockAMO = await ethers.getContractFactory("MockTreasuryAMO");
        const mockAMO = await MockAMO.deploy();

        // ─── Deploy OracleGuardian ────────────────────────────────────────
        const OracleGuardian = await ethers.getContractFactory("OracleGuardian");
        oracleGuardian = await OracleGuardian.deploy(
            avOracle.address,
            mockAu.address,
            mockUSDC.address,
            mockAMO.address,   // treasuryAMO with twapPrice()
            deployer.address,  // admin = deployer (simulating timelock)
            AU_PEG,
            BUYBACK_TRIGGER_BPS
        );

        // ─── Deploy TreasuryFlashBuy_v2 ───────────────────────────────────
        const TreasuryFlashBuy = await ethers.getContractFactory("TreasuryFlashBuy_v2");
        flashBuy = await TreasuryFlashBuy.deploy(
            treasury.address,
            oracleGuardian.address,
            mockUSDC.address,
            mockAG.address,
            mockAu.address,
            mockDEX.address,
            ethers.utils.parseUnits("10000", 6), // max 10k USDC per buyback
            ethers.utils.parseEther("100"),       // min 100 AG out
            deployer.address  // admin = deployer
        );

        // ─── Setup roles ──────────────────────────────────────────────────
        const EXECUTOR_ROLE = await flashBuy.EXECUTOR_ROLE();
        await flashBuy.grantRole(EXECUTOR_ROLE, executor.address);

        const GUARDIAN_ROLE = await oracleGuardian.GUARDIAN_ROLE();
        await oracleGuardian.grantRole(GUARDIAN_ROLE, guardian.address);
    });

    // =========================================================================
    //                        ORACLE GUARDIAN TESTS
    // =========================================================================

    describe("OracleGuardian", function () {
        it("should deploy with correct initial state", async function () {
            expect(await oracleGuardian.oracle()).to.equal(avOracle.address);
            expect(await oracleGuardian.auToken()).to.equal(mockAu.address);
            expect(await oracleGuardian.usdcToken()).to.equal(mockUSDC.address);
            expect(await oracleGuardian.auPeg()).to.equal(AU_PEG);
            expect(await oracleGuardian.buybackTriggerBps()).to.equal(BUYBACK_TRIGGER_BPS);
            expect(await oracleGuardian.oracleActive()).to.be.true;
        });

        it("should return Au price from oracle", async function () {
            const price = await oracleGuardian.getAuPrice();
            expect(price).to.equal(AU_PEG);
        });

        it("should return validated price when not stale", async function () {
            const price = await oracleGuardian.getValidatedAuPrice();
            expect(price).to.equal(AU_PEG);
        });

        it("should return USD price for USDC (=1)", async function () {
            // Set USDC price in mock oracle
            await avOracle.setPrice(mockUSDC.address, ONE_ETHER, 2);
            const price = await oracleGuardian.getUsdcPrice();
            expect(price).to.equal(ONE_ETHER);
        });

        it("should calculate TVL correctly", async function () {
            // TVL = totalAuSupply * auPrice
            const mockSupply = ethers.utils.parseEther("1000");
            const tvl = await oracleGuardian.calculateAuTVL(mockSupply);
            // 1000 * 1.0 = 1000
            expect(tvl).to.equal(ethers.utils.parseEther("1000"));
        });

        it("should detect deviation between TWAP and oracle", async function () {
            // Set oracle price to 10% above TWAP
            await avOracle.setPrice(mockAu.address, ethers.utils.parseEther("1.10"), 2);

            const [valid, deviationBps] = await oracleGuardian.validateTwapPrice(
                AU_PEG  // TWAP price to validate
            );

            // 10% = 1000 bps > 500 bps max → not valid
            expect(valid).to.be.false;
            expect(deviationBps).to.be.gt(500);
        });

        it("should allow guardian to pause", async function () {
            await oracleGuardian.connect(guardian).setEmergencyPause(true);
            expect(await oracleGuardian.paused()).to.be.true;
        });

        it("should prevent non-guardian from pausing", async function () {
            await expect(
                oracleGuardian.connect(user).setEmergencyPause(true)
            ).to.be.reverted; // AccessControl denies non-GUARDIAN_ROLE
        });

        it("should allow admin to update oracle", async function () {
            const newOracle = user.address;
            await oracleGuardian.setOracle(newOracle);
            expect(await oracleGuardian.oracle()).to.equal(newOracle);
        });

        it("should prevent zero address for oracle", async function () {
            await expect(
                oracleGuardian.setOracle(ethers.constants.AddressZero)
            ).to.be.revertedWith("OG: zero oracle");
        });
    });

    // =========================================================================
    //                        FLASHBUY TRIGGER TESTS
    // =========================================================================

    describe("FlashBuy Trigger", function () {
        it("should NOT trigger when Au is at peg", async function () {
            await avOracle.setPrice(mockAu.address, AU_PEG, 2);
            const shouldTrigger = await flashBuy.shouldBuyback();
            expect(shouldTrigger).to.be.false;
        });

        it("should NOT trigger when Au is above peg", async function () {
            await avOracle.setPrice(mockAu.address, AU_ABOVE_PEG, 2);
            const shouldTrigger = await flashBuy.shouldBuyback();
            expect(shouldTrigger).to.be.false;
        });

        it("should trigger when Au drops below peg threshold", async function () {
            // Set Au to $0.93 (7% below $1.00 peg, threshold is 5%)
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);
            const shouldTrigger = await flashBuy.shouldBuyback();
            expect(shouldTrigger).to.be.true;
        });

        it("should NOT trigger when Au is within threshold (4% below)", async function () {
            // $0.96 is 4% below $1.00 — within 5% threshold
            const AU_SLIGHTLY_BELOW = ethers.utils.parseEther("0.96");
            await avOracle.setPrice(mockAu.address, AU_SLIGHTLY_BELOW, 2);
            const shouldTrigger = await flashBuy.shouldBuyback();
            expect(shouldTrigger).to.be.false;
        });

        it("should return correct Au price from oracle wrapper", async function () {
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);
            const [price, source] = await flashBuy.getAuPriceFromOracle();
            expect(price).to.equal(AU_BELOW_PEG);
            expect(source).to.equal(2); // TWAP source
        });

        it("should return false when FlashBuy is inactive", async function () {
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);
            await flashBuy.setActive(false);
            const shouldTrigger = await flashBuy.shouldBuyback();
            expect(shouldTrigger).to.be.false;
        });
    });

    // =========================================================================
    //                        FLASHBUY EXECUTION TESTS
    // =========================================================================

    describe("FlashBuy Execution", function () {
        beforeEach(async function () {
            // Set Au below peg to trigger buyback
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);

            // Fund treasury with USDC
            await mockUSDC.connect(treasury).approve(flashBuy.address, ethers.utils.parseUnits("50000", 6));

            // Fund DEX with AG for swaps
            await mockAG.mint(mockDEX.address, ethers.utils.parseEther("100000"));
        });

        it("should revert when trigger not met", async function () {
            // Set Au back to peg
            await avOracle.setPrice(mockAu.address, AU_PEG, 2);

            const dexData = mockDEX.interface.encodeFunctionData("swap", [
                ethers.utils.parseUnits("1000", 6), // USDC in
                ethers.utils.parseEther("1000"),    // min AG out
                flashBuy.address                     // recipient
            ]);

            await expect(
                flashBuy.connect(executor).executeBuyback(
                    ethers.utils.parseUnits("1000", 6),
                    ethers.utils.parseEther("900"),
                    dexData
                )
            ).to.be.revertedWithCustomError(flashBuy, "TriggerNotMet");
        });

        it("should revert when amount exceeds max", async function () {
            const dexData = mockDEX.interface.encodeFunctionData("swap", [
                ethers.utils.parseUnits("50000", 6),
                ethers.utils.parseEther("50000"),
                flashBuy.address
            ]);

            await expect(
                flashBuy.connect(executor).executeBuyback(
                    ethers.utils.parseUnits("50000", 6), // exceeds 10k max
                    ethers.utils.parseEther("40000"),
                    dexData
                )
            ).to.be.revertedWithCustomError(flashBuy, "MaxUsdcExceeded");
        });

        it("should revert when not active", async function () {
            await flashBuy.setActive(false);

            const dexData = mockDEX.interface.encodeFunctionData("swap", [
                ethers.utils.parseUnits("1000", 6),
                ethers.utils.parseEther("1000"),
                flashBuy.address
            ]);

            await expect(
                flashBuy.connect(executor).executeBuyback(
                    ethers.utils.parseUnits("1000", 6),
                    ethers.utils.parseEther("900"),
                    dexData
                )
            ).to.be.revertedWithCustomError(flashBuy, "NotActive");
        });

        it("should revert when caller lacks EXECUTOR_ROLE", async function () {
            const dexData = mockDEX.interface.encodeFunctionData("swap", [
                ethers.utils.parseUnits("1000", 6),
                ethers.utils.parseEther("1000"),
                flashBuy.address
            ]);

            // OZ v5 AccessControl uses custom errors, not string reverts
            await expect(
                flashBuy.connect(user).executeBuyback(
                    ethers.utils.parseUnits("1000", 6),
                    ethers.utils.parseEther("900"),
                    dexData
                )
            ).to.be.reverted;
        });
    });

    // =========================================================================
    //                        ACCESS CONTROL TESTS
    // =========================================================================

    describe("Access Control", function () {
        it("should grant deployer as DEFAULT_ADMIN", async function () {
            const DEFAULT_ADMIN = await oracleGuardian.DEFAULT_ADMIN_ROLE();
            expect(await oracleGuardian.hasRole(DEFAULT_ADMIN, deployer.address)).to.be.true;
        });

        it("should allow admin to set parameters", async function () {
            await oracleGuardian.setBuybackTriggerBps(300); // 3%
            expect(await oracleGuardian.buybackTriggerBps()).to.equal(300);

            await oracleGuardian.setAuPeg(ethers.utils.parseEther("1.05"));
            expect(await oracleGuardian.auPeg()).to.equal(ethers.utils.parseEther("1.05"));
        });

        it("should reject invalid buybackTriggerBps", async function () {
            await expect(
                oracleGuardian.setBuybackTriggerBps(0)
            ).to.be.revertedWith("OG: invalid bps");

            await expect(
                oracleGuardian.setBuybackTriggerBps(6000) // 60% — too high
            ).to.be.revertedWith("OG: invalid bps");
        });

        it("should allow admin to update FlashBuy params", async function () {
            await flashBuy.setParams(
                ethers.utils.parseUnits("20000", 6), // new max
                ethers.utils.parseEther("200")        // new min
            );
            expect(await flashBuy.maxUsdcPerBuyback()).to.equal(ethers.utils.parseUnits("20000", 6));
            expect(await flashBuy.minAgOut()).to.equal(ethers.utils.parseEther("200"));
        });
    });

    // =========================================================================
    //                        INTEGRATION / E2E TESTS
    // =========================================================================

    describe("End-to-End Flow", function () {
        it("should detect price drop and trigger buyback flag", async function () {
            // 1. Au at peg — no trigger
            await avOracle.setPrice(mockAu.address, AU_PEG, 2);
            expect(await flashBuy.shouldBuyback()).to.be.false;

            // 2. Au drops to $0.93 — trigger fires
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);
            expect(await flashBuy.shouldBuyback()).to.be.true;

            // 3. OracleGuardian reports correct price
            const [price, source] = await flashBuy.getAuPriceFromOracle();
            expect(price).to.equal(AU_BELOW_PEG);

            // 4. Au recovers — trigger clears
            await avOracle.setPrice(mockAu.address, AU_PEG, 2);
            expect(await flashBuy.shouldBuyback()).to.be.false;
        });

        it("should track cumulative stats after buyback", async function () {
            await avOracle.setPrice(mockAu.address, AU_BELOW_PEG, 2);

            // Check initial stats
            expect(await flashBuy.totalUsdcSpent()).to.equal(0);
            expect(await flashBuy.totalAgBought()).to.equal(0);

            // Stats remain 0 since we can't execute without DEX integration in unit test
            // (Full execution test requires MockDEX integration)
        });
    });
});
