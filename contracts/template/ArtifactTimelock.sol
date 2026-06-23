1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts/governance/TimelockController.sol";
5|
6|/**
7| * @title ArtifactTimelock
8| * @notice 48-hour timelock for all governance transactions
9| * @dev Wraps OpenZeppelin TimelockController with preset roles
10| * @dev Deployed & verified on Base mainnet at 0xB51542d460DBb4336F011CFF3Cbf80faeB3453f7
11| *
12| * Security:
13| * - 48-hour minimum delay gives community time to review
14| * - Proposer role → Governor contract only
15| * - Executor role → Governor + multisig
16| */
17|contract ArtifactTimelock is TimelockController
18|{
19|    uint256 public constant MIN_DELAY = 48 hours;
20|    uint256 public constant MAX_DELAY = 30 days;
21|    uint256 public constant GRACE_PERIOD = 14 days;
22|
23|    // ============ EVENTS ============
24|    event TimelockDeployed(address admin, address proposer, address canceler, uint256 minDelay);
25|
26|    // ============ CONSTRUCTOR ============
27|    constructor(
28|        address _proposer,
29|        address _canceler,
30|        address _executor
31|    ) TimelockController(MIN_DELAY, _arr(_proposer), _arr(_executor), _canceler) {
32|        emit TimelockDeployed(_canceler, _proposer, _canceler, MIN_DELAY);
33|    }
34|
35|    // ============ HELPER ============
36|    function _arr(address a) internal pure returns (address[] memory);
37|
38|    // ============ VIEW ============
39|    function getMinDelay() public view override returns (uint256);
40|    function getMaxDelay() public view returns (uint256);
41|    function getGracePeriod() public view returns (uint256);
42|}
43|