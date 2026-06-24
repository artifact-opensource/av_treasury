// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../contracts/RSBT.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ============ Mocks ============

contract MockERC721 {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to, uint256 tokenId) external {
        require(to != address(0), "zero address");
        require(_owners[tokenId] == address(0), "already minted");
        _owners[tokenId] = to;
        unchecked { _balances[to] += 1; }
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(owner != address(0), "not minted");
        require(msg.sender == owner || msg.sender == _tokenApprovals[tokenId] || _operatorApprovals[owner][msg.sender], "not approved");
        require(from == owner, "from not owner");
        require(to != address(0), "zero address");
        _tokenApprovals[tokenId] = address(0);
        _operatorApprovals[owner][msg.sender] = false;
        unchecked { _balances[owner] -= 1; _balances[to] += 1; }
        _owners[tokenId] = to;
    }

    function approve(address spender, uint256 tokenId) external {
        require(_owners[tokenId] == msg.sender, "not owner");
        _tokenApprovals[tokenId] = spender;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "not owner");
        require(to != address(0), "zero address");
        _tokenApprovals[tokenId] = address(0);
        unchecked { _balances[from] -= 1; _balances[to] += 1; }
        _owners[tokenId] = to;
    }
}

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title RSBTInvariants
 * @notice Halmos-style invariant tests for RSBT (Reissuable Soulbound Token)
 * @dev Tests verify that critical properties hold for all possible states
 *
 * How to run:
 *   forge test --match-path test/invariants/RSBTInvariants.t.sol -vv
 */
contract RSBTInvariants is Test {
    // ============ State ============

    RSBT public rsbt;
    MockERC721 public lpNFT;
    MockERC20 public agToken;
    MockERC20 public auToken;

    address public owner = address(this);
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint256 public constant AG_THRESHOLD = 1000e18;

    // ============ Setup ============

    function setUp() public {
        lpNFT = new MockERC721();
        agToken = new MockERC20("AgToken", "Ag");
        auToken = new MockERC20("AuToken", "Au");

        rsbt = new RSBT(
            address(lpNFT),
            address(agToken),
            address(auToken),
            AG_THRESHOLD
        );

        // Mint LP NFTs to users
        lpNFT.mint(user1, 1);
        lpNFT.mint(user1, 2);
        lpNFT.mint(user2, 3);
        lpNFT.mint(user2, 4);

        // Mint AgTokens to users
        agToken.mint(user1, 500e18);
        agToken.mint(user2, 2000e18);
    }

    // ============ Invariant: No LP NFT can be staked twice ============

    function invariant_NoDoubleStake() public view {
        uint256[] memory tokenIds = new uint256[](4);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        tokenIds[2] = 3;
        tokenIds[3] = 4;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 rsbtId = rsbt.lpToRSBT(tokenIds[i]);
            if (rsbtId != 0) {
                RSBT.RSBTPosition memory pos = rsbt.getPosition(rsbtId);
                assertTrue(pos.exists, "staked LP must have valid position");
                assertEq(lpNFT.ownerOf(tokenIds[i]), address(rsbt), "LP must be held by RSBT");
            }
        }
    }

    // ============ Invariant: Multiplier within bounds ============

    function invariant_MultiplierWithinBounds() public view {
        uint256 totalSupplyVal = rsbt.totalSupply();
        for (uint256 i = 1; i <= totalSupplyVal; i++) {
            RSBT.RSBTPosition memory pos = rsbt.getPosition(i);
            if (pos.exists) {
                assertTrue(pos.multiplier >= 10000, "multiplier below minimum");
                assertTrue(pos.multiplier <= 25000, "multiplier above maximum");
            }
        }
    }

    // ============ Invariant: Total supply consistency ============

    function invariant_TotalSupplyConsistency() public view {
        uint256 totalSupplyVal = rsbt.totalSupply();
        if (totalSupplyVal > 0) {
            bool anyExist = false;
            for (uint256 i = 1; i <= totalSupplyVal; i++) {
                if (rsbt.getPosition(i).exists) {
                    anyExist = true;
                    break;
                }
            }
            assertTrue(anyExist, "if totalSupply > 0, at least one position must exist");
        }
    }

    // ============ Invariant: Cooldown period validity ============

    function invariant_CooldownPeriod() public view {
        uint256 totalSupplyVal = rsbt.totalSupply();
        for (uint256 i = 1; i <= totalSupplyVal; i++) {
            // Public mapping getter returns individual fields, not struct
            (uint256 rsbtTokenId, uint256 cooldownEnd, bool active) = rsbt.redemptions(i);
            if (active) {
                assertTrue(cooldownEnd > 0, "cooldown end must be set");
            }
        }
    }

    // ============ Invariant: Redemption implies position exists ============

    function invariant_RedemptionImpliesPosition() public view {
        uint256 totalSupplyVal = rsbt.totalSupply();
        for (uint256 i = 1; i <= totalSupplyVal; i++) {
            (, , bool active) = rsbt.redemptions(i);
            if (active) {
                assertTrue(rsbt.getPosition(i).exists, "active redemption must have existing position");
            }
        }
    }

    // ============ Invariant: AgThreshold never zero ============

    function invariant_AgThresholdNonZero() public view {
        assertTrue(rsbt.agThreshold() != 0, "agThreshold must never be zero");
    }

    // ============ Invariant: Token addresses immutable ============

    function invariant_TokenAddressesImmutable() public view {
        assertEq(address(rsbt.lpNFT()), address(lpNFT), "LP NFT address changed");
        assertEq(address(rsbt.agToken()), address(agToken), "AgToken address changed");
        assertEq(address(rsbt.auToken()), address(auToken), "AuToken address changed");
    }

    // ============ Functional Tests ============

    function test_Stake() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        vm.stopPrank();

        assertEq(rsbtId, 1);
        assertEq(rsbt.totalSupply(), 1);
        assertEq(lpNFT.ownerOf(1), address(rsbt));

        RSBT.RSBTPosition memory pos = rsbt.getPosition(rsbtId);
        assertEq(pos.lpTokenId, 1);
        assertEq(pos.owner, user1);
        assertEq(pos.lpValueAtStake, 100e18);
        assertTrue(pos.exists);
    }

    function test_StakeMultiplierCalculation() public {
        // user1 has 500e18 agToken, threshold is 1000e18
        // multiplier = 10000 + (15000 * 500e18) / 1000e18 = 10000 + 7500 = 17500
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        vm.stopPrank();

        RSBT.RSBTPosition memory pos = rsbt.getPosition(rsbtId);
        assertEq(pos.multiplier, 17500);
    }

    function test_StakeMultiplierMaxCap() public {
        // user2 has 2000e18 agToken, threshold is 1000e18
        // multiplier = 10000 + (15000 * 2000e18) / 1000e18 = 40000, capped at 25000
        vm.startPrank(user2);
        lpNFT.approve(address(rsbt), 3);
        uint256 rsbtId = rsbt.stake(3, 100e18);
        vm.stopPrank();

        RSBT.RSBTPosition memory pos = rsbt.getPosition(rsbtId);
        assertEq(pos.multiplier, 25000);
    }

    function test_StakeMultiplierMin() public {
        address user3 = makeAddr("user3");
        lpNFT.mint(user3, 5);
        agToken.mint(user3, 0);

        vm.startPrank(user3);
        lpNFT.approve(address(rsbt), 5);
        uint256 rsbtId = rsbt.stake(5, 50e18);
        vm.stopPrank();

        RSBT.RSBTPosition memory pos = rsbt.getPosition(rsbtId);
        assertEq(pos.multiplier, 10000);
    }

    function test_RevertStakeZeroValue() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        try rsbt.stake(1, 0) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_RevertStakeNotOwner() public {
        vm.startPrank(user2);
        try rsbt.stake(1, 100e18) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_RevertDoubleStake() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        rsbt.stake(1, 100e18);

        try rsbt.stake(1, 100e18) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_InitiateRedemption() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        rsbt.initiateRedemption(rsbtId);
        vm.stopPrank();

        assertFalse(rsbt.isRedemptionReady(rsbtId));
        assertEq(rsbt.getRemainingCooldown(rsbtId), 7 days);
    }

    function test_RedeemAfterCooldown() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        rsbt.initiateRedemption(rsbtId);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days + 1);

        vm.startPrank(user1);
        rsbt.redeem(rsbtId);
        vm.stopPrank();

        assertEq(lpNFT.ownerOf(1), user1);
        // Position is burned after redemption
        assertEq(rsbt.lpToRSBT(1), 0);
    }

    function test_RevertRedeemBeforeCooldown() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        rsbt.initiateRedemption(rsbtId);

        try rsbt.redeem(rsbtId) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_RevertRedeemNotOwner() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        rsbt.initiateRedemption(rsbtId);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days + 1);

        vm.startPrank(user2);
        try rsbt.redeem(rsbtId) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_RevertRedeemNoActiveRedemption() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);

        try rsbt.redeem(rsbtId) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
        vm.stopPrank();
    }

    function test_AdminUpdateAgThreshold() public {
        uint256 oldThreshold = rsbt.agThreshold();
        rsbt.setAgThreshold(2000e18);
        assertEq(rsbt.agThreshold(), 2000e18);
        assertTrue(oldThreshold != rsbt.agThreshold());
    }

    function test_RevertSetAgThresholdZero() public {
        try rsbt.setAgThreshold(0) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
    }

    function test_AdminUpdateLPValue() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        vm.stopPrank();

        rsbt.updateLPValue(rsbtId, 200e18);
        assertEq(rsbt.getPosition(rsbtId).lpValueAtStake, 200e18);
    }

    function test_AdminUpdateDebt() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        vm.stopPrank();

        rsbt.updateDebt(rsbtId, 50e18);
    }

    function test_EmergencyWithdrawLP() public {
        // Transfer LP NFT to RSBT contract directly (simulating accidental deposit)
        vm.startPrank(user1);
        lpNFT.transferFrom(user1, address(rsbt), 1);
        vm.stopPrank();

        rsbt.emergencyWithdrawLP(1, owner);
        assertEq(lpNFT.ownerOf(1), owner);
    }

    function test_RevertEmergencyWithdrawStakedLP() public {
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        rsbt.stake(1, 100e18);
        vm.stopPrank();

        try rsbt.emergencyWithdrawLP(1, owner) {
            revert("should have reverted");
        } catch {
            // Expected revert
        }
    }

    function test_CalculateMultiplierView() public {
        assertEq(rsbt.calculateMultiplier(0), 10000);
        assertEq(rsbt.calculateMultiplier(500e18), 17500);
        assertEq(rsbt.calculateMultiplier(1000e18), 25000);
        assertEq(rsbt.calculateMultiplier(2000e18), 25000);
    }

    function test_FullLifecycle() public {
        // 1. Stake
        vm.startPrank(user1);
        lpNFT.approve(address(rsbt), 1);
        uint256 rsbtId = rsbt.stake(1, 100e18);
        vm.stopPrank();

        // 2. Update LP value
        rsbt.updateLPValue(rsbtId, 150e18);
        assertEq(rsbt.getPosition(rsbtId).lpValueAtStake, 150e18);

        // 3. Update debt
        rsbt.updateDebt(rsbtId, 50e18);

        // 4. Initiate redemption
        vm.startPrank(user1);
        rsbt.initiateRedemption(rsbtId);
        vm.stopPrank();

        // 5. Advance time
        vm.warp(block.timestamp + 7 days + 1);

        // 6. Redeem
        vm.startPrank(user1);
        rsbt.redeem(rsbtId);
        vm.stopPrank();

        // Verify final state
        assertEq(lpNFT.ownerOf(1), user1);
        assertEq(rsbt.lpToRSBT(1), 0);
    }

}
