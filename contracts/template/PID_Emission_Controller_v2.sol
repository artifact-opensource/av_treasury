1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts/access/AccessControl.sol";
5|import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
6|import "@openzeppelin/contracts/security/Pausable.sol";
7|
8|/**
9| * @title PID_Emission_Controller_v2
10| * @notice PID-controlled $Ag emission based on staking TVL vs target.
11| * @dev v2: Hard bounds on PID gains, two-step admin, daily emission cap.
12| * @dev Deployed & verified on Base mainnet at 0x70D3e11aD8274C07ca7D1ABa2e88376c355ed3df
13| */
14|contract PID_Emission_Controller_v2 is AccessControl, ReentrancyGuard, Pausable
15|{
16|    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");
17|    bytes32 public constant EMIT_ROLE = keccak256("EMIT_ROLE");
18|
19|    // Two-step admin
20|    address public pendingAdmin;
21|    address public currentAdmin;
22|
23|    // Token refs
24|    address public auToken;
25|    address public agToken;
26|    address public staking;
27|
28|    // PID parameters (bounded: 1e12 to 1e18)
29|    uint256 public kp;
30|    uint256 public ki;
31|    uint256 public kd;
32|
33|    uint256 public constant MIN_K = 1e12;
34|    uint256 public constant MAX_K = 1e18;
35|    uint256 public constant MAX_INTEGRAL = 1e24;
36|    uint256 public constant MAX_SINGLE_EMISSION = 10000e18;
37|    uint256 public constant DAILY_EMISSION_CAP = 100_000e18;
38|    uint256 public constant INTEGRAL_DECAY_NUM = 99;
39|    uint256 public constant INTEGRAL_DECAY_DEN = 100;
40|
41|    // PID state
42|    int256 public integral;
43|    int256 public lastError;
44|    uint256 public lastUpdate;
45|    uint256 public targetTVL;
46|
47|    // Timelock for PID parameter changes
48|    uint256 public constant PARAM_CHANGE_DELAY = 2 days;
49|    struct ParamChange {
50|        uint256 kp;
51|        uint256 ki;
52|        uint256 kd;
53|        uint256 targetTVL;
54|        uint256 scheduledAt;
55|        bool exists;
56|    }
57|    ParamChange public pendingParamChange;
58|
59|    // Emission tracking
60|    uint256 public totalAgEmitted;
61|    uint256 public emissionCount;
62|    bool public emergencyStop;
63|    uint256 public dailyEmitted;
64|    uint256 public currentDay;
65|
66|    // ============ INTERFACES ============
67|    interface IAgToken {
68|        function mint(address to, uint256 amount) external;
69|    }
70|    interface IStaking {
71|        function totalStakedNFTs() external view returns (uint256);
72|    }
73|
74|    // ============ EVENTS ============
75|    event PidGainsUpdated(uint256 kp, uint256 ki, uint256 kd);
76|    event TargetTVLUpdated(uint256 oldTarget, uint256 newTarget);
77|    event AgEmitted(uint256 amount, uint256 tvl, int256 error);
78|    event EmergencyStopToggled(bool stopped);
79|    event AdminChangeRequested(address indexed currentAdmin, address indexed pendingAdmin);
80|    event AdminRoleTransferred(address indexed oldAdmin, address indexed newAdmin);
81|    event ParamChangeScheduled(uint256 kp, uint256 ki, uint256 kd, uint256 targetTVL, uint256 executeAfter);
82|
83|    // ============ INITIALIZER ============
84|    constructor(address _admin);
85|
86|    // ============ TWO-STEP ADMIN TRANSFER ============
87|    function requestAdminChange(address _newAdmin) external;
88|    function acceptAdmin() external;
89|    function cancelAdminChange() external;
90|
91|    // ============ CONTRACT SETUP ============
92|    function setAuToken(address _auToken) external;
93|    function setAgToken(address _agToken) external;
94|    function setStaking(address _staking) external;
95|
96|    // ============ PID PARAMETER MANAGEMENT ============
97|    function schedulePidGainsChange(uint256 _kp, uint256 _ki, uint256 _kd) external;
98|    function executePidGainsChange() external;
99|    function cancelParamChange() external;
100|    function setTargetTVL(uint256 _targetTVL) external;
101|
102|    // ============ PID COMPUTATION ============
103|    /// @notice Preview next emission amount without state change
104|    function previewEmission() public view returns (uint256 agAmount);
105|    /// @notice Execute emission (requires EMIT_ROLE)
106|    function executeEmission() external nonReentrant whenNotPaused;
107|
108|    // ============ EMERGENCY ============
109|    function setEmergencyStop(bool _stopped) external;
110|    function resetIntegral() external;
111|    function pause() external;
112|    function unpause() external;
113|
114|    // ============ VIEW ============
115|    function getCurrentTVL() public view returns (uint256);
116|    function getPidState() external view returns (
117|        uint256 _kp, uint256 _ki, uint256 _kd,
118|        int256 _integral, int256 _lastError,
119|        uint256 _targetTVL, uint256 _currentTVL,
120|        bool _emergencyStop, bool _paused
121|    );
122|}
123|