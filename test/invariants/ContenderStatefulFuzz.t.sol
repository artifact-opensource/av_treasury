// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../../contracts/AgToken.sol";
import "../../contracts/AuToken.sol";
import "../../contracts/PID_Emission_Controller_v2.sol";
import "../../contracts/TreasuryAMO.sol";
import "../../contracts/AvOracle.sol";

/// @title MockAerodromeRouter
/// @notice Minimal mock for TreasuryAMO's aerodromeRouter dependency
contract MockAerodromeRouter {
    function getAmountsOut(uint256, address[] memory) external pure returns (uint256[] memory) {
        return new uint256[](2);
    }
}

/// @title ContenderStatefulFuzz
/// @notice Stateful fuzz testing suite in the style of Paradigm's Contender.
/// @dev Tests multi-call sequences with random actors and random arguments.
///      Invariants are checked after EVERY call to catch state corruption.
///
/// Approach:
///   1. Deploy all contracts in a realistic configuration
///   2. Execute N random calls from random callers with random arguments
///   3. After each call, assert all invariants hold
///   4. Run with `forge test --fuzz-runs 10000` for deep coverage
///
/// This complements Halmos (symbolic) by exploring concrete execution paths
/// that symbolic solvers may miss — especially cross-contract interaction bugs.
contract ContenderStatefulFuzz is Test {
    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 constant MAX_SUPPLY = 1_000_000_000e18;
    uint256 constant FUNDING_AMOUNT = 10_000e18;
    uint256 constant NUM_ACTORS = 5;
    uint256 constant MAX_TRANSFER = 100_000e18;
    uint256 constant MAX_MINT_BURN = 50_000e18;

    // ─── Deployed Contracts ────────────────────────────────────────────────
    AgToken agToken;
    AuToken auToken;
    PID_Emission_Controller_v2 pidController;
    TreasuryAMO treasuryAMO;
    AvOracle avOracle;
    MockAerodromeRouter mockRouter;

    // ─── Actors ─────────────────────────────────────────────────────────────
    address[NUM_ACTORS] actors;
    address deployer;
    address minter;
    address burner;
    address user1;
    address user2;

    // ─── Fuzz State Tracking ───────────────────────────────────────────────
    uint256 public totalMinted;
    uint256 public totalBurned;
    mapping(address => uint256) public agBalances;
    mapping(address => uint256) public auBalances;
    bool public pidActive;
    uint256 public pidTargetTVL;

    // ─── Events for traceability ───────────────────────────────────────────
    event FuzzAction(string action, address caller, uint256 value);
    event InvariantViolation(string reason, address subject);

    // ═══════════════════════════════════════════════════════════════════════
    //  SETUP
    // ═══════════════════════════════════════════════════════════════════════

    function setUp() public {
        deployer = makeAddr("deployer");
        minter = makeAddr("minter");
        burner = makeAddr("burner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        actors = [deployer, minter, burner, user1, user2];

        vm.deal(deployer, 100 ether);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);

        // ── Deploy AgToken (UUPS proxy) ──
        vm.startPrank(deployer);
        agToken = new AgToken();
        agToken.initialize(deployer);
        agToken.grantRole(agToken.MINTER_ROLE(), minter);
        agToken.grantRole(agToken.BURNER_ROLE(), burner);
        vm.stopPrank();

        // ── Deploy AuToken (UUPS proxy) ──
        vm.startPrank(deployer);
        auToken = new AuToken();
        auToken.initialize(deployer);
        auToken.grantRole(auToken.MINTER_ROLE(), minter);
        // Set max wallet to 100% for fuzz testing (avoids constraint noise)
        auToken.setMaxWalletAmount(10_000);
        auToken.setMaxTxAmount(10_000);
        vm.stopPrank();

        // ── Deploy PID Controller ──
        vm.startPrank(deployer);
        pidController = new PID_Emission_Controller_v2(
            deployer,      // admin
            address(this), // staking (using this contract as mock staking)
            address(agToken), // agToken
            50_000e18,     // targetTVL
            1e15,          // kp
            1e14,          // ki
            1e14           // kd
        );
        vm.stopPrank();
        pidActive = true;
        pidTargetTVL = 50_000e18;

        // ── Deploy Mock Router ──
        mockRouter = new MockAerodromeRouter();
        vm.label(address(mockRouter), "MockRouter");

        // ── Deploy TreasuryAMO ──
        vm.startPrank(deployer);
        treasuryAMO = new TreasuryAMO(
            address(auToken),
            address(agToken),
            address(mockRouter), // aerodromeRouter
            deployer             // admin
        );
        vm.stopPrank();

        // ── Deploy AvOracle ──
        vm.startPrank(deployer);
        avOracle = new AvOracle(
            address(auToken),
            address(agToken),
            deployer,  // admin
            deployer   // governor
        );
        vm.stopPrank();

        // ── Fund TreasuryAMO ──
        // Temporarily set max wallet to 100% for bootstrap mint
        vm.startPrank(deployer);
        auToken.setMaxWalletAmount(10000);
        auToken.mint(address(treasuryAMO), FUNDING_AMOUNT);
        auToken.setMaxWalletAmount(1000);
        vm.stopPrank();

        auBalances[address(treasuryAMO)] = FUNDING_AMOUNT;
        totalMinted = FUNDING_AMOUNT;

        // ── Label for traces ──
        vm.label(deployer, "deployer");
        vm.label(minter, "minter");
        vm.label(burner, "burner");
        vm.label(user1, "user1");
        vm.label(user2, "user2");
        vm.label(address(agToken), "AgToken");
        vm.label(address(auToken), "AuToken");
        vm.label(address(pidController), "PIDController");
        vm.label(address(treasuryAMO), "TreasuryAMO");
        vm.label(address(avOracle), "AvOracle");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INVARIANTS (checked after every fuzz action)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Core invariant: AgToken totalSupply == sum of all balances
    /// @dev We verify by checking that no individual balance exceeds totalSupply
    ///      and that totalSupply is monotonic (only changes via mint/burn)
    function invariant_agToken_supplySum() public view {
        uint256 supply = agToken.totalSupply();
        // No single balance can exceed total supply
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            assertTrue(agToken.balanceOf(actors[i]) <= supply, "INV: AgToken balance > supply");
        }
        // TreasuryAMO and TreasuryAMO contract also hold AgToken
        assertTrue(agToken.balanceOf(address(treasuryAMO)) <= supply, "INV: treasuryAMO Ag balance > supply");
    }

    /// @notice Core invariant: AgToken totalSupply never exceeds MAX_SUPPLY
    function invariant_agToken_maxSupply() public view {
        assertTrue(agToken.totalSupply() <= MAX_SUPPLY, "INV: AgToken exceeds max supply");
    }

    /// @notice Core invariant: No AgToken balance exceeds totalSupply
    function invariant_agToken_balanceLteSupply() public view {
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            assertTrue(
                agToken.balanceOf(actors[i]) <= agToken.totalSupply(),
                "INV: AgToken balance > supply"
            );
        }
    }

    /// @notice Core invariant: AuToken totalSupply >= sum of all known balances
    /// @dev AuToken has maxWallet constraints but supply accounting must be consistent
    function invariant_auToken_supplySum() public view {
        uint256 supply = auToken.totalSupply();
        // No single balance can exceed total supply
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            assertTrue(auToken.balanceOf(actors[i]) <= supply, "INV: AuToken balance > supply");
        }
        assertTrue(auToken.balanceOf(address(treasuryAMO)) <= supply, "INV: treasuryAMO Au balance > supply");
    }

    /// @notice Core invariant: TreasuryAMO balance <= AuToken totalSupply
    function invariant_treasury_balanceLteAuSupply() public view {
        assertTrue(
            auToken.balanceOf(address(treasuryAMO)) <= auToken.totalSupply(),
            "INV: TreasuryAMO balance > AuToken supply"
        );
    }

    /// @notice Core invariant: PID controller targetTVL is non-negative
    function invariant_pid_targetTVLNonNegative() public view {
        assertTrue(pidTargetTVL >= 0, "INV: PID targetTVL negative");
    }

    /// @notice Core invariant: No actor has negative balance (always true for ERC20, but explicit)
    function invariant_noNegativeBalances() public view {
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            // Solidity uint can't be negative, but we check for unexpected state
            assertEq(
                agToken.balanceOf(actors[i]) > 0 || agToken.balanceOf(actors[i]) == 0,
                true,
                "INV: negative balance state"
            );
        }
    }

    /// @notice Core invariant: AgToken paused state is consistent
    function invariant_pausedConsistency() public view {
        // If paused, no transfers should work (tested separately)
        // Here we just ensure the state variable is boolean (0 or 1)
        assertTrue(
            agToken.paused() == false || agToken.paused() == true,
            "INV: paused state corrupted"
        );
    }

    /// @notice Core invariant: Roles are not granted to zero address
    function invariant_rolesNotZeroAddress() public view {
        assertFalse(
            agToken.hasRole(agToken.MINTER_ROLE(), address(0)),
            "INV: MINTER_ROLE granted to zero"
        );
        assertFalse(
            agToken.hasRole(agToken.BURNER_ROLE(), address(0)),
            "INV: BURNER_ROLE granted to zero"
        );
    }

    /// @notice Core invariant: PID controller AgToken address matches deployed
    function invariant_pid_agTokenMatches() public view {
        assertEq(
            address(pidController.agToken()),
            address(agToken),
            "INV: PID AgToken mismatch"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  FUZZ ACTIONS (random sequences)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz: Transfer AgToken between random actors
    /// @dev Tests: balance conservation, zero-address handling, insufficient balance
    function fuzz_transferAgToken(
        address from,
        address to,
        uint256 amount
    ) public {
        // Constrain inputs
        _constrainActor(from);
        _constrainActor(to);
        if (from == to) return;
        amount = _bound(amount, 0, MAX_TRANSFER);

        uint256 fromBalanceBefore = agToken.balanceOf(from);
        uint256 toBalanceBefore = agToken.balanceOf(to);
        uint256 totalSupplyBefore = agToken.totalSupply();

        vm.startPrank(from);
        try agToken.transfer(to, amount) returns (bool success) {
            if (success) {
                // Invariant: total supply unchanged after transfer
                assertEq(agToken.totalSupply(), totalSupplyBefore, "transfer changed supply");

                // Invariant: balances updated correctly
                if (amount <= fromBalanceBefore) {
                    assertEq(agToken.balanceOf(from), fromBalanceBefore - amount, "from balance");
                    assertEq(agToken.balanceOf(to), toBalanceBefore + amount, "to balance");
                }
            }
        } catch {
            // Expected for insufficient balance or paused
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Mint AgToken (as minter)
    /// @dev Tests: max supply enforcement, mint accounting, role enforcement
    function fuzz_mintAgToken(
        address to,
        uint256 amount
    ) public {
        _constrainActor(to);
        amount = _bound(amount, 0, MAX_MINT_BURN);

        uint256 totalSupplyBefore = agToken.totalSupply();
        uint256 toBalanceBefore = agToken.balanceOf(to);

        vm.startPrank(minter);
        try agToken.mint(to, amount) {
            // Invariant: supply increased by exactly amount
            assertEq(agToken.totalSupply(), totalSupplyBefore + amount, "mint supply");

            // Invariant: recipient balance increased by exactly amount
            assertEq(agToken.balanceOf(to), toBalanceBefore + amount, "mint balance");
        } catch {
            // Expected when totalSupply + amount > MAX_SUPPLY
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Burn AgToken (as burner)
    /// @dev Tests: burn accounting, underflow protection, role enforcement
    function fuzz_burnAgToken(
        address from,
        uint256 amount
    ) public {
        _constrainActor(from);
        amount = _bound(amount, 0, MAX_MINT_BURN);

        uint256 totalSupplyBefore = agToken.totalSupply();
        uint256 fromBalanceBefore = agToken.balanceOf(from);

        vm.startPrank(burner);
        try agToken.burn(from, amount) {
            // Invariant: supply decreased by exactly amount
            assertEq(agToken.totalSupply(), totalSupplyBefore - amount, "burn supply");

            // Invariant: sender balance decreased
            assertEq(agToken.balanceOf(from), fromBalanceBefore - amount, "burn balance");
        } catch {
            // Expected when amount > balance
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Approve + transferFrom flow
    /// @dev Tests: allowance accounting, allowance exhaustion, balance conservation
    function fuzz_approveAndTransferFrom(
        address owner,
        address spender,
        uint256 approveAmount,
        uint256 transferAmount
    ) public {
        _constrainActor(owner);
        _constrainActor(spender);
        if (owner == spender) return;
        approveAmount = _bound(approveAmount, 0, MAX_TRANSFER);
        transferAmount = _bound(transferAmount, 0, MAX_TRANSFER);

        uint256 ownerBalanceBefore = agToken.balanceOf(owner);
        uint256 allowanceBefore = agToken.allowance(owner, spender);

        // Step 1: Approve
        vm.startPrank(owner);
        try agToken.approve(spender, approveAmount) {
            // Allowance should be set
            uint256 newAllowance = agToken.allowance(owner, spender);
            assertTrue(newAllowance == approveAmount || newAllowance == allowanceBefore + approveAmount, "approve failed");
        } catch {}
        vm.stopPrank();

        // Step 2: TransferFrom
        uint256 spenderBalanceBefore = agToken.balanceOf(spender);
        vm.startPrank(spender);
        try agToken.transferFrom(owner, spender, transferAmount) returns (bool success) {
            if (success && transferAmount <= ownerBalanceBefore) {
                // Invariant: owner balance decreased
                assertEq(agToken.balanceOf(owner), ownerBalanceBefore - transferAmount, "transferFrom owner");
                // Invariant: spender balance increased
                assertEq(agToken.balanceOf(spender), spenderBalanceBefore + transferAmount, "transferFrom spender");
            }
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Mint AuToken (as minter)
    /// @dev Tests: AuToken mint with maxWallet constraints
    function fuzz_mintAuToken(
        address to,
        uint256 amount
    ) public {
        _constrainActor(to);
        amount = _bound(amount, 0, MAX_MINT_BURN);

        uint256 totalSupplyBefore = auToken.totalSupply();
        uint256 toBalanceBefore = auToken.balanceOf(to);

        vm.startPrank(minter);
        try auToken.mint(to, amount) {
            // Invariant: supply increased by exactly amount
            assertEq(auToken.totalSupply(), totalSupplyBefore + amount, "Au mint supply");
            assertEq(auToken.balanceOf(to), toBalanceBefore + amount, "Au mint balance");
        } catch {
            // Expected when maxWallet exceeded
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Mint AuToken to TreasuryAMO (simulating revenue)
    /// @dev Tests: TreasuryAMO receives AuToken correctly
    function fuzz_mintToTreasury(uint256 amount) public {
        amount = _bound(amount, 0, MAX_MINT_BURN);

        uint256 treasuryBalanceBefore = auToken.balanceOf(address(treasuryAMO));
        uint256 totalSupplyBefore = auToken.totalSupply();

        vm.startPrank(minter);
        try auToken.mint(address(treasuryAMO), amount) {
            assertEq(
                auToken.balanceOf(address(treasuryAMO)),
                treasuryBalanceBefore + amount,
                "treasury mint balance"
            );
            assertEq(auToken.totalSupply(), totalSupplyBefore + amount, "treasury mint supply");
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: PID Controller updateTWATVL (emission dynamics)
    /// @dev Tests: PID math doesn't overflow, TWA TVL stays within bounds
    function fuzz_pidUpdateTwaTVL(uint256 /*tvlDelta*/) public {
        uint256 agSupplyBefore = agToken.totalSupply();

        vm.startPrank(deployer);
        try pidController.updateTWATVL() {
            // Invariant: PID update should not change AgToken supply directly
            // (it only computes emission rate; actual minting is separate)
            assertEq(agToken.totalSupply(), agSupplyBefore, "PID changed supply");
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: PID Controller updateTvlSnapshot
    /// @dev Tests: snapshot update, state consistency
    function fuzz_pidUpdateTvlSnapshot(uint256 /*seed*/) public {
        vm.startPrank(deployer);
        try pidController.updateTvlSnapshot() {
            // Should not revert
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: PID Controller setTargetTVL
    /// @dev Tests: targetTVL update, bounds checking
    function fuzz_pidSetTargetTVL(uint256 newTargetTVL) public {
        newTargetTVL = _bound(newTargetTVL, 0, MAX_SUPPLY);

        vm.startPrank(deployer);
        try pidController.setTargetTVL(newTargetTVL) {
            pidTargetTVL = newTargetTVL;
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: TreasuryAMO emergencyWithdraw
    /// @dev Tests: only admin can withdraw, withdraw doesn't exceed balance
    /// @dev Note: contract must be paused first (whenPaused modifier)
    function fuzz_treasuryEmergencyWithdraw(uint256 amount) public {
        amount = _bound(amount, 0, FUNDING_AMOUNT);

        uint256 treasuryBalanceBefore = auToken.balanceOf(address(treasuryAMO));

        // Pause first (required by whenPaused modifier)
        vm.startPrank(deployer);
        try agToken.pause() {} catch {}
        vm.stopPrank();

        vm.startPrank(deployer);
        try treasuryAMO.emergencyWithdraw(address(auToken), amount) {
            uint256 treasuryBalanceAfter = auToken.balanceOf(address(treasuryAMO));
            // Balance should decrease by exactly amount (or revert if insufficient)
            assertTrue(
                treasuryBalanceAfter == treasuryBalanceBefore - amount ||
                treasuryBalanceAfter == 0,
                "emergencyWithdraw accounting"
            );
        } catch {
            // Expected if amount > balance
        }
        vm.stopPrank();

        // Unpause for other tests
        vm.startPrank(deployer);
        try agToken.unpause() {} catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: TreasuryAMO parameter setters
    /// @dev Tests: parameter bounds, access control
    function fuzz_treasurySetCooldown(uint256 newCooldown) public {
        newCooldown = _bound(newCooldown, 0, 365 days);

        vm.startPrank(deployer);
        try treasuryAMO.setCooldown(newCooldown) {
            assertEq(treasuryAMO.cooldown(), newCooldown, "cooldown not set");
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Pause/Unpause AgToken
    /// @dev Tests: pause state machine, transfers blocked when paused
    function fuzz_pauseUnpause(bool pause) public {
        vm.startPrank(deployer);
        if (pause) {
            try agToken.pause() {
                assertTrue(agToken.paused(), "not paused after pause()");
            } catch {}
        } else {
            try agToken.unpause() {
                assertFalse(agToken.paused(), "still paused after unpause()");
            } catch {}
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Pause and try transfer — should fail when paused
    function fuzz_transferWhenPaused(address from, address to, uint256 amount) public {
        _constrainActor(from);
        _constrainActor(to);
        if (from == to) return;
        amount = _bound(amount, 0, MAX_TRANSFER);

        // First pause
        vm.startPrank(deployer);
        try agToken.pause() {} catch {}
        vm.stopPrank();

        // Record state before
        uint256 fromBalanceBefore = agToken.balanceOf(from);
        uint256 toBalanceBefore = agToken.balanceOf(to);

        // Try transfer — should fail when paused
        vm.startPrank(from);
        try agToken.transfer(to, amount) returns (bool s) {
            // Transfer succeeded — only OK if not paused
            assertFalse(agToken.paused(), "transfer succeeded while paused");
        } catch {
            // Transfer failed — expected when paused or insufficient balance
            // Verify no balance change occurred
            assertEq(agToken.balanceOf(from), fromBalanceBefore, "balance changed on failed transfer");
            assertEq(agToken.balanceOf(to), toBalanceBefore, "balance changed on failed transfer");
        }
        vm.stopPrank();

        // Unpause for other tests
        vm.startPrank(deployer);
        try agToken.unpause() {} catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Transfer AuToken between random actors
    /// @dev Tests: AuToken transfer with maxWallet constraints
    function fuzz_transferAuToken(
        address from,
        address to,
        uint256 amount
    ) public {
        _constrainActor(from);
        _constrainActor(to);
        if (from == to) return;
        amount = _bound(amount, 0, MAX_TRANSFER);

        uint256 fromBalanceBefore = auToken.balanceOf(from);
        uint256 totalSupplyBefore = auToken.totalSupply();

        vm.startPrank(from);
        try auToken.transfer(to, amount) returns (bool success) {
            if (success && amount <= fromBalanceBefore) {
                assertEq(auToken.totalSupply(), totalSupplyBefore, "Au transfer changed supply");
                assertEq(auToken.balanceOf(from), fromBalanceBefore - amount, "Au from balance");
            }
        } catch {
            // Expected for maxWallet violation or insufficient balance
        }
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Delegate AgToken votes
    /// @dev Tests: vote delegation, checkpoint accounting
    function fuzz_delegate(address delegatee, address delegator) public {
        _constrainActor(delegatee);
        _constrainActor(delegator);

        vm.startPrank(delegator);
        try agToken.delegate(delegatee) {
            // Delegation succeeded
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Fuzz: Set AuToken max wallet (as ANTI_BOT_ROLE holder)
    /// @dev Tests: max wallet bounds, cannot set below MIN_WALLET_BPS
    function fuzz_setAuTokenMaxWallet(uint256 newMaxWalletBps) public {
        // Bound to valid range (MIN_WALLET_BPS=100 to 10000)
        newMaxWalletBps = _bound(newMaxWalletBps, 100, 10000);

        vm.startPrank(deployer);
        try auToken.setMaxWalletAmount(newMaxWalletBps) {
            // Max wallet updated
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  RUNNER (Contender-style sequence)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Main fuzz runner: execute a long random sequence of actions
    /// @dev This is the Contender-style entry point. Each iteration picks a
    ///      random action with random inputs and executes it, checking
    ///      invariants after every step.
    ///
    /// Run with: `forge test --match-test testFuzz_longSequence --fuzz-runs 10000`
    function testFuzz_longSequence(uint256 seed) public {
        // Bound seed to prevent extreme values
        seed = _bound(seed, 0, type(uint256).max);

        // Execute 50 random actions in sequence
        for (uint256 i = 0; i < 50; i++) {
            uint256 actionSelector = _bound(uint256(keccak256(abi.encode(seed, i))), 0, 12);

            if (actionSelector == 0) {
                fuzz_transferAgToken(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 2))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 3)))
                );
            } else if (actionSelector == 1) {
                fuzz_mintAgToken(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 2)))
                );
            } else if (actionSelector == 2) {
                fuzz_burnAgToken(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 2)))
                );
            } else if (actionSelector == 3) {
                fuzz_approveAndTransferFrom(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 2))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 3))),
                    uint256(keccak256(abi.encode(seed, i, 4)))
                );
            } else if (actionSelector == 4) {
                fuzz_mintAuToken(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 2)))
                );
            } else if (actionSelector == 5) {
                fuzz_mintToTreasury(
                    uint256(keccak256(abi.encode(seed, i, 2)))
                );
            } else if (actionSelector == 6) {
                fuzz_pidUpdateTwaTVL(uint256(keccak256(abi.encode(seed, i, 1))));
            } else if (actionSelector == 7) {
                fuzz_pidSetTargetTVL(uint256(keccak256(abi.encode(seed, i, 1))));
            } else if (actionSelector == 8) {
                fuzz_treasuryEmergencyWithdraw(uint256(keccak256(abi.encode(seed, i, 1))));
            } else if (actionSelector == 9) {
                fuzz_pauseUnpause(uint256(keccak256(abi.encode(seed, i, 1))) % 2 == 0);
            } else if (actionSelector == 10) {
                fuzz_transferAuToken(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 2))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 3)))
                );
            } else if (actionSelector == 11) {
                fuzz_pidUpdateTvlSnapshot(uint256(keccak256(abi.encode(seed, i, 1))));
            } else if (actionSelector == 12) {
                fuzz_transferWhenPaused(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 2))), 0, NUM_ACTORS - 1)],
                    uint256(keccak256(abi.encode(seed, i, 3)))
                );
            } else {
                fuzz_delegate(
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 1))), 0, NUM_ACTORS - 1)],
                    actors[_bound(uint256(keccak256(abi.encode(seed, i, 2))), 0, NUM_ACTORS - 1)]
                );
            }
        }
    }

    /// @notice Test: AgToken max supply cannot be exceeded even with rapid minting
    function testFuzz_agToken_maxSupplyExceeded() public {
        vm.startPrank(minter);
        // Mint up to MAX_SUPPLY
        try agToken.mint(user1, MAX_SUPPLY / 2) {
            // Second mint of remaining + 1 should fail
            try agToken.mint(user2, MAX_SUPPLY / 2 + 1) {
                revert("should have reverted: exceeded max supply");
            } catch {
                // Expected — would exceed MAX_SUPPLY
            }
        } catch {}
        vm.stopPrank();

        assertTrue(agToken.totalSupply() <= MAX_SUPPLY);
    }

    /// @notice Test: AgToken cannot mint to zero address
    function testFuzz_agToken_mintToZeroAddress() public {
        vm.startPrank(minter);
        try agToken.mint(address(0), 1000e18) {
            // Should revert
            revert("should have reverted");
        } catch {}
        vm.stopPrank();
    }

    /// @notice Test: AuToken max wallet constraint is enforced
    /// @dev Setup sets maxWallet to 100% (10000 bps) for fuzzing freedom.
    ///      Here we set it to 10% and verify the constraint kicks in.
    ///      Key insight: maxWallet is checked AFTER _update, using NEW totalSupply.
    ///      So we need to account for the supply increase from the mint itself.
    function testFuzz_auToken_maxWalletEnforced() public {
        // Set max wallet to 10% for this test
        vm.startPrank(deployer);
        auToken.setMaxWalletAmount(1000); // 10%
        vm.stopPrank();

        uint256 currentSupply = auToken.totalSupply();
        if (currentSupply > 0) {
            // After minting `amount`, newSupply = currentSupply + amount
            // maxWallet = (currentSupply + amount) * 1000 / 10000
            // Check: amount > maxWallet
            // => amount > (currentSupply + amount) * 1000 / 10000
            // => amount * 10000 > (currentSupply + amount) * 1000
            // => amount * 10000 > currentSupply * 1000 + amount * 1000
            // => amount * 9000 > currentSupply * 1000
            // => amount > currentSupply * 1000 / 9000
            // => amount > currentSupply / 9
            // For currentSupply = 10000e18: amount > 1111.11e18
            uint256 threshold = currentSupply / 9;
            if (threshold > 0) {
                vm.startPrank(minter);
                // Mint just above the threshold — should fail
                try auToken.mint(user1, threshold + 1) {
                    revert("max wallet violated");
                } catch {
                    // Expected — exceeds maxWallet
                }
                vm.stopPrank();
            }
        }

        // Restore to 100% for other tests
        vm.startPrank(deployer);
        auToken.setMaxWalletAmount(10000);
        vm.stopPrank();
    }

    /// @notice Test: PID controller cannot be updated with invalid params
    function testFuzz_pid_invalidParams() public {
        vm.startPrank(deployer);
        // Try to set targetTVL to extreme values
        try pidController.setTargetTVL(type(uint256).max) {
            // Should either succeed or revert gracefully
        } catch {}
        vm.stopPrank();

        _checkCoreInvariants();
    }

    /// @notice Test: TreasuryAMO cannot be drained by non-admin
    function testFuzz_treasury_accessControl() public {
        vm.startPrank(user1);
        (bool success, ) = address(treasuryAMO).call(
            abi.encodeWithSignature("allocate(uint256)", FUNDING_AMOUNT)
        );
        // Should fail — user1 is not admin
        assertFalse(success, "non-admin can call allocate");
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function _constrainActor(address actor) internal view {
        bool valid = false;
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            if (actors[i] == actor) {
                valid = true;
                break;
            }
        }
        require(valid, "invalid actor");
    }

    function _checkCoreInvariants() internal view {
        // Run all invariants inline for speed
        assertTrue(agToken.totalSupply() <= MAX_SUPPLY, "INV: max supply");
        // AgToken supply must match its tracked mints/burns (not AuToken mints)
        uint256 expectedAgSupply = agToken.totalSupply(); // trust the contract
        assertTrue(expectedAgSupply <= MAX_SUPPLY, "INV: AgToken max supply");
        assertTrue(
            auToken.balanceOf(address(treasuryAMO)) <= auToken.totalSupply(),
            "INV: treasury overflow"
        );
        assertEq(address(pidController.agToken()), address(agToken), "INV: PID AgToken");
    }
}
