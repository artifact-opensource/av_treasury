1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
5|import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
6|import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
7|import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
8|import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
9|import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
10|
11|/**
12| * @title Artifact Governance (Ag)
13| * @notice UUPS upgradeable governance token. Mintable/burnable. Backed by protocol reserves.
14| * @dev No genesis mint. All Ag emitted through Staking + PID controller only.
15| * @dev Deployed & verified on Base mainnet at 0xC4553019F739Aea58BD5A9d8ea2820951AC6380F
16| */
17|contract AgToken is
18|    ERC20Upgradeable,
19|    ERC20PermitUpgradeable,
20|    ERC20VotesUpgradeable,
21|    AccessControlUpgradeable,
22|    ReentrancyGuardUpgradeable,
23|    UUPSUpgradeable
24|{
25|    /// @notice Maximum total supply (100M Ag)
26|    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;
27|
28|    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
29|    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
30|    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
31|
32|    uint256 public constant UPGRADE_DELAY = 7 days;
33|    uint256 public upgradeScheduledAt;
34|    address public pendingImplementation;
35|
36|    // ============ EVENTS ============
37|    event Mint(address indexed to, uint256 amount);
38|    event Burn(address indexed from, uint256 amount);
39|    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
40|    event UpgradeExecuted(address indexed newImplementation);
41|    event UpgradeCancelled(address indexed cancelledImplementation);
42|
43|    // ============ INITIALIZER ============
44|    function initialize(address admin) public initializer;
45|
46|    // ============ UPGRADE TIMELOCK ============
47|    function announceUpgrade(address newImplementation) external onlyRole(UPGRADER_ROLE);
48|    function cancelUpgrade() external onlyRole(UPGRADER_ROLE);
49|    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
50|
51|    // ============ MINT / BURN ============
52|    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE);
53|    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE);
54|
55|    // ============ REQUIRED OVERRIDES FOR ERC20Votes ============
56|    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);
57|    function _mint(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);
58|    function _burn(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable);
59|
60|    // ============ GOVERNANCE ============
61|    function delegate(address delegatee) external;
62|    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
63|    function getVotes(address account) public view override returns (uint256);
64|    function getPriorVotes(address account, uint256 blockNumber) public view override returns (uint256);
65|}
66|