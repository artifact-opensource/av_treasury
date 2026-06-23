// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Artifact Governance (Ag) — v3
 * @notice UUPS upgradeable governance token. Mintable/burnable. Backed by protocol reserves.
 * @dev No genesis mint. All Ag emitted through Staking + PID controller only.
 * @author Artifact Virtual DAO
 */
contract AgToken is
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant UPGRADE_DELAY = 7 days;
    uint256 public upgradeScheduledAt;
    address public pendingImplementation;

    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
    event UpgradeExecuted(address indexed newImplementation);
    event UpgradeCancelled(address indexed cancelledImplementation);

    function initialize(address admin) public initializer {
        require(admin != address(0), "Ag: zero admin");

        __ERC20_init("Artifact Governance", "Ag");
        __ERC20Permit_init("Artifact Governance");
        __ERC20Votes_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    function announceUpgrade(address newImplementation) external onlyRole(UPGRADER_ROLE) {
        require(newImplementation != address(0), "Ag: zero impl");
        require(newImplementation.code.length > 0, "Ag: not a contract");
        pendingImplementation = newImplementation;
        upgradeScheduledAt = block.timestamp;
        emit UpgradeAnnounced(newImplementation, block.timestamp + UPGRADE_DELAY);
    }

    function cancelUpgrade() external onlyRole(UPGRADER_ROLE) {
        emit UpgradeCancelled(pendingImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {
        require(pendingImplementation != address(0), "Ag: no upgrade announced");
        require(newImplementation == pendingImplementation, "Ag: not announced impl");
        require(block.timestamp >= upgradeScheduledAt + UPGRADE_DELAY, "Ag: timelock active");
        emit UpgradeExecuted(newImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Ag: max supply");
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
        emit Burn(from, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function delegate(address delegatee) public override {
        _delegate(msg.sender, delegatee);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }
}
