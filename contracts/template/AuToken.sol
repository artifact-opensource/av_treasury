1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|("@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
5|import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
6|import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20FlashMintUpgradeable.sol";
7|import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
8|import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
9|import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
10|import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
11|import "@openzeppelin/contracts/utils/Base64.sol";
12|import "@openzeppelin/contracts/utils/Strings.sol";
13|
14|/**
15| * @title Artifact Utility (Au)
16| * @notice UUPS upgradeable utility token. Fixed supply. Fees, blocklist, cooldowns, flash loans.
17| * @dev Deployed & verified on Base mainnet at 0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f
18| */
19|contract AuToken is
20|    ERC20Upgradeable,
21|    ERC20PermitUpgradeable,
22|    ERC20FlashMintUpgradeable,
23|    AccessControlUpgradeable,
24|    ReentrancyGuardUpgradeable,
25|    PausableUpgradeable,
26|    UUPSUpgradeable
27|{
28|    // ============ CONSTANTS ============
29|    /// @notice Maximum total supply (1 billion Au, fixed)
30|    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
31|    /// @notice Fee denominator (100000 = 100%, basis points)
32|    uint256 public constant FEE_DENOMINATOR = 100_000;
33|    /// @notice Initial transfer fee (9 bps = 0.09%)
34|    uint256 public constant INITIAL_FEE_BPS = 9;
35|    /// @notice Maximum fee cap (500 bps = 5%, governance-adjustable)
36|    uint256 public constant MAX_FEE_BPS = 500;
37|    /// @notice Maximum sell cooldown (7 days)
38|    uint256 public constant MAX_SELL_COOLDOWN = 7 days;
39|    /// @notice Minimum transaction amount (1% of supply in bps)
40|    uint256 public constant MIN_TX_BPS = 100;
41|    /// @notice Minimum wallet amount (1% of supply in bps)
42|    uint256 public constant MIN_WALLET_BPS = 100;
43|    /// @notice Maximum flash loan amount (1M Au)
44|    uint256 public constant MAX_FLASH_LOAN_CAP = 1_000_000 * 1e18;
45|    /// @notice Portion of fee burned (5000 = 50%)
46|    uint256 public constant FEE_BURN_PORTION = 5000;
47|
48|    bytes32 public constant ANTI_BOT_ROLE = keccak256("ANTI_BOT_ROLE");
49|    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
50|
51|    // ============ STATE ============
52|    uint256 public transferFeeBps;
53|    uint256 public maxTxAmountBps;
54|    uint256 public maxWalletAmountBps;
55|    uint256 public sellCooldown;
56|    address public treasury;
57|    uint256 public accumulatedFees;
58|    bool public feesEnabled;
59|
60|    mapping(address => bool) public isBlocked;
61|    mapping(address => uint256) public lastSellTimestamp;
62|    mapping(address => bool) public isWhitelistedContract;
63|
64|    uint256 public upgradeScheduledAt;
65|    address public pendingImplementation;
66|
67|    // ============ EVENTS ============
68|    event TransferFeeUpdated(uint256 newFeeBps);
69|    event MaxTxAmountUpdated(uint256 newMaxTxBps);
70|    event MaxWalletAmountUpdated(uint256 newMaxWalletBps);
71|    event SellCooldownUpdated(uint256 newCooldown);
72|    event TreasuryUpdated(address newTreasury);
73|    event BlocklistUpdated(address indexed account, bool blocked);
74|    event WhitelistUpdated(address indexed contractAddr, bool whitelisted);
75|    event FeesWithdrawn(uint256 amount);
76|    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
77|    event UpgradeExecuted(address indexed newImplementation);
78|    event UpgradeCancelled(address indexed cancelledImplementation);
79|
80|    // ============ INITIALIZER ============
81|    /// @notice Initialize proxy — governance sets treasury, deployer gets roles
82|    function initialize(address _treasury) external initializer;
83|
84|    // ============ UPGRADE TIMELOCK ============
85|    function announceUpgrade(address newImplementation) external onlyRole(DEFAULT_ADMIN_ROLE);
86|    function cancelUpgrade() external onlyRole(DEFAULT_ADMIN_ROLE);
87|    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE);
88|
89|    // ============ FEE MANAGEMENT ============
90|    function setTransferFeeBps(uint256 _feeBps) external onlyRole(ANTI_BOT_ROLE);
91|    function setMaxTxAmount(uint256 _maxTxAmountBps) external onlyRole(ANTI_BOT_ROLE);
92|    function setMaxWalletAmount(uint256 _maxWalletAmountBps) external onlyRole(ANTI_BOT_ROLE);
93|    function setSellCooldown(uint256 _cooldown) external onlyRole(ANTI_BOT_ROLE);
94|    function setWhitelistedContract(address _contractAddr, bool _whitelisted) external onlyRole(ANTI_BOT_ROLE);
95|    function setFeesEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE);
96|    function withdrawFees() external;
97|
98|    // ============ BLOCKLIST ============
99|    function setBlocked(address _account, bool _blocked) external onlyRole(ANTI_BOT_ROLE);
100|
101|    // ============ PAUSABLE ============
102|    function pause() external onlyRole(DEFAULT_ADMIN_ROLE);
103|    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
104|
105|    // ============ TREASURY ============
106|    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE);
107|
108|    // ============ MINT ============
109|    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused;
110|
111|    // ============ FLASH LOAN ============
112|    /// @notice Maximum flash loan available for a token
113|    function maxFlashLoan(address token) public view override returns (uint256);
114|    /// @notice Flash mint fee — override to charge 9 bps
115|    function _flashFee(address token, uint256 amount) internal view override returns (uint256);
116|
117|    // ============ TRANSFER LOGIC (fee engine) ============
118|    function _transfer(address from, address to, uint256 amount) internal override;
119|    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused;
120|
121|    // ============ TOKEN URI (on-chain SVG) ============
122|    function tokenURI(uint256) public pure returns (string memory);
123|}
124|