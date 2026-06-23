1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
5|import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
6|import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
7|import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
8|import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
9|import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
10|import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
11|import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
12|
13|/**
14| * @title AVLPStaking_v2
15| * @notice Stake LP NFTs, earn Au + Ag rewards. UUPS upgradeable.
16| * @dev Ag-based multiplier: 1x-2.5x based on staker's Ag holdings.
17| * @dev Deployed & verified on Base mainnet at 0x3e26b061eC20392b32dE712132c41bbE43f52556
18| */
19|contract AVLPStaking_v2 is
20|    AccessControlUpgradeable,
21|    ReentrancyGuardUpgradeable,
22|    PausableUpgradeable,
23|    UUPSUpgradeable,
24|    IERC721ReceiverUpgradeable
25|{
26|    using SafeERC20Upgradeable for IERC20Upgradeable;
27|
28|    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
29|
30|    IERC20Upgradeable public auToken;
31|    IERC20Upgradeable public agToken;
32|    IERC721Upgradeable public lpNFT;
33|
34|    uint256 public auRewardPerBlock;
35|    uint256 public agRewardPerBlock;
36|
37|    // H-05: Rate caps
38|    uint256 public constant MAX_AU_RATE = 1000 * 1e18;
39|    uint256 public constant MAX_AG_RATE = 100 * 1e18;
40|    uint256 public constant RATE_DELAY = 48 hours;
41|
42|    // H-05: Rate change timelock
43|    uint256 public rateChangeScheduledAt;
44|    uint256 public pendingAuRate;
45|    uint256 public pendingAgRate;
46|
47|    // C-03: Upgrade
48|    uint256 public constant UPGRADE_DELAY = 7 days;
49|    uint256 public upgradeScheduledAt;
50|    address public pendingImplementation;
51|
52|    // Staking state
53|    uint256 public totalWeights;
54|    uint256 public accAuPerWeight;
55|    uint256 public accAgPerWeight;
56|    uint256 public lastRewardBlock;
57|
58|    mapping(uint256 => uint256) public _stakedWeights;
59|    mapping(uint256 => address) public _stakeOwner;
60|    mapping(address => uint256[]) public _ownerStakes;
61|    mapping(uint256 => uint256) public _pendingAu;
62|    mapping(uint256 => uint256) public _pendingAg;
63|    mapping(uint256 => uint256) public _debtAu;
64|    mapping(uint256 => uint256) public _debtAg;
65|
66|    // Dust accumulator
67|    uint256 public dustAu;
68|    uint256 public dustAg;
69|
70|    // ============ STRUCTS ============
71|    struct Stake {
72|        address owner;
73|        uint256 tokenId;
74|        uint256 weight;
75|        uint256 depositedAt;
76|    }
77|
78|    // ============ EVENTS ============
79|    event StakedNFT(address indexed user, uint256 tokenId, uint256 weight);
80|    event UnstakedNFT(address indexed user, uint256 tokenId);
81|    event RewardsClaimed(address indexed user, uint256 auAmount, uint256 agAmount);
82|    event RewardRatesUpdated(uint256 auRate, uint256 agRate);
83|    event RateChangeScheduled(uint256 auRate, uint256 agRate, uint256 executableAt);
84|    event NFTRecovered(uint256 tokenId, address to);
85|    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
86|    event UpgradeExecuted(address indexed newImplementation);
87|    event UpgradeCancelled(address indexed cancelledImplementation);
88|
89|    // ============ INITIALIZER ============
90|    function initialize(address _auToken, address _agToken, address _lpNFT) public initializer;
91|
92|    // ============ UPGRADE TIMELOCK ============
93|    function announceUpgrade(address newImplementation) external onlyRole(DEFAULT_ADMIN_ROLE);
94|    function cancelUpgrade() external onlyRole(DEFAULT_ADMIN_ROLE);
95|    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE);
96|
97|    // ============ RATE MANAGEMENT (48h timelock) ============
98|    function scheduleRateChange(uint256 _auRate, uint256 _agRate) external onlyRole(ADMIN_ROLE);
99|    function executeRateChange() external onlyRole(ADMIN_ROLE);
100|    function setRewardRates(uint256 _auRate, uint256 _agRate) external onlyRole(ADMIN_ROLE);
101|
102|    // ============ STAKING ============
103|    function stake(uint256 tokenId, uint256 weight) external nonReentrant whenNotPaused;
104|    function unstake(uint256 tokenId) external nonReentrant whenNotPaused;
105|    function claimRewards(uint256 tokenId) external nonReentrant whenNotPaused;
106|
107|    // ============ AG MULTIPLIER ============
108|    /// @notice Calculate Ag-based multiplier for a staker (1x-2.5x)
109|    /// @return multiplier in basis points (10000 = 1x, 25000 = 2.5x)
110|    function getAgMultiplier(address staker) public view returns (uint256);
111|
112|    // ============ REWARD DISTRIBUTION ============
113|    function _distributeRewards() internal;
114|    function distributeDust() external;
115|    function pendingRewards(uint256 tokenId) external view returns (uint256 auAmount, uint256 agAmount);
116|
117|    // ============ NFT RECOVERY ============
118|    function recoverNFT(uint256 tokenId, address to) external onlyRole(ADMIN_ROLE);
119|
120|    // ============ VIEW ============
121|    function getStakes(address user) external view returns (uint256[] memory);
122|
123|    // ============ PAUSE ============
124|    function pause() external onlyRole(ADMIN_ROLE);
125|    function unpause() external onlyRole(ADMIN_ROLE);
126|
127|    // ============ IERC721Receiver ============
128|    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4);
129|}
130|