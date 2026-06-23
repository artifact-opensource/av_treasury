1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
5|import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
6|import "@openzeppelin/contracts/access/AccessControl.sol";
7|import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
8|import "@openzeppelin/contracts/security/Pausable.sol";
9|
10|/**
11| * @title TreasuryAMO
12| * @notice Automated Market Operations: TWAP buybacks, runway reserve protection
13| * @dev Executes autonomous buybacks of $Au using treasury funds
14| * @dev Deployed & verified on Base mainnet at 0x4eB2eb2904E8CAEd16eDf0b134bA9Df5170BE23F
15| */
16|contract TreasuryAMO is AccessControl, ReentrancyGuard, Pausable
17|{
18|    using SafeERC20 for IERC20;
19|
20|    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
21|    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");
22|
23|    IERC20 public auToken;
24|    IERC20 public reserveToken;
25|
26|    address public aerodromeRouter;
27|    address public uniswapRouter;
28|
29|    // Operational params
30|    uint256 public cooldown;              // Minimum seconds between operations
31|    uint256 public lastOperationTime;
32|    uint256 public maxSlippageBps;        // Max slippage (bps)
33|    uint256 public maxPriceDeviationBps;  // Max TWAP deviation (bps)
34|    uint256 public minRunwayReserve;      // Minimum reserve to keep
35|    uint256 public maxBuybackPerEpochBps; // Max % of reserve per buyback
36|
37|    // TWAP state
38|    uint256 public twapPrice;
39|    uint256 public twapLastUpdate;
40|    uint256 public twapWindow;
41|
42|    // Tracking
43|    uint256 public totalBuybacksExecuted;
44|    uint256 public totalAuBought;
45|    uint256 public totalReserveSpent;
46|
47|    // ============ INTERFACES ============
48|    interface IUniswapV2Router {
49|        function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts);
50|        function swapExactTokensForTokensSupportingTransferTokens(
51|            uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline
52|        ) external;
53|    }
54|    interface IAerodromeRouter {
55|        function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts);
56|        function swapExactTokensForTokens(
57|            uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline
58|        ) external returns (uint256[] memory amounts);
59|    }
60|
61|    // ============ EVENTS ============
62|    event BuybackExecuted(uint256 reserveAmountIn, uint256 auAmountOut, uint256 timestamp, address executor);
63|    event TWAPUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp);
64|    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
65|    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
66|    event RunwayUpdated(uint256 oldReserve, uint256 newReserve);
67|    event RouterUpdated(string name, address oldRouter, address newRouter);
68|
69|    // ============ CONSTRUCTOR ============
70|    constructor(
71|        address _auToken,
72|        address _reserveToken,
73|        address _aerodromeRouter,
74|        address _admin
75|    );
76|
77|    // ============ CORE BUYBACK LOGIC ============
78|    function executeBuyback(
79|        uint256 reserveAmount,
80|        uint256 minAuOut,
81|        bool useAerodrome,
82|        uint256 deadline
83|    )
84|        external
85|        onlyExecutor
86|        nonReentrant
87|        whenNotPaused
88|        respectsCooldown
89|        respectsRunway(reserveAmount);
90|
91|    // ============ TWAP MANAGEMENT ============
92|    function updateTWAP(uint256 _price) external onlyRole(PARAM_ROLE);
93|
94|    // ============ PARAMETER MANAGEMENT ============
95|    function setCooldown(uint256 _cooldown) external onlyRole(PARAM_ROLE);
96|    function setMaxSlippage(uint256 _bps) external onlyRole(PARAM_ROLE);
97|    function setMaxPriceDeviation(uint256 _bps) external onlyRole(PARAM_ROLE);
98|    function setMinRunwayReserve(uint256 _reserve) external onlyRole(PARAM_ROLE);
99|    function setMaxBuybackPerEpoch(uint256 _bps) external onlyRole(PARAM_ROLE);
100|    function setAerodromeRouter(address _router) external onlyRole(PARAM_ROLE);
101|    function setUniswapRouter(address _router) external onlyRole(PARAM_ROLE);
102|
103|    // ============ EMERGENCY ============
104|    function pause() external onlyRole(DEFAULT_ADMIN_ROLE);
105|    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
106|    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused;
107|
108|    // ============ VIEW ============
109|    function timeUntilNextOperation() external view returns (uint256);
110|    function getReserveBalance() external view returns (uint256);
111|    function getAuBalance() external view returns (uint256);
112|    function getExpectedOutput(uint256 reserveAmount, bool useAerodrome) external view returns (uint256);
113|
114|    // ============ MODIFIERS ============
115|    modifier onlyExecutor() { ... }
116|    modifier respectsCooldown() { ... }
117|    modifier respectsRunway(uint256 spendAmount) { ... }
118|
119|    receive() external payable;
120|}
121|