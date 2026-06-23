1|// SPDX-License-Identifier: AGPL-3.0-only
2|pragma solidity 0.8.20;
3|
4|import "@openzeppelin/contracts/governance/Governor.sol";
5|import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
6|import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
7|import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
8|import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
9|import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
10|
11|/**
12| * @title ArtifactGovernor
13| * @notice OpenZeppelin Governor for decentralized proposal execution
14| * @dev Integrates with Artifact Governance (Ag) for voting, TimelockController for execution delay
15| * @dev Deployed & verified on Base mainnet at 0xaB8b57022309834fcB056B434bb5BbF976351C66
16| *
17| * Security parameters:
18| * - 48-hour timelock on all execution
19| * - Quorum: 4% of total supply
20| * - Proposal threshold: 100,000 Ag
21| * - Voting period: ~3 days
22| * - Snapshot-based voting prevents flash loan governance attacks
23| */
24|contract GovernorContract is
25|    Governor,
26|    GovernorSettings,
27|    GovernorCountingSimple,
28|    GovernorVotes,
29|    GovernorVotesQuorumFraction,
30|    GovernorTimelockControl
31|{
32|    uint256 public constant INITIAL_VOTING_DELAY = 1;
33|    uint256 public constant INITIAL_VOTING_PERIOD = 216000;
34|    uint256 public constant INITIAL_PROPOSAL_THRESHOLD = 100000e18;
35|    uint256 public constant INITIAL_QUORUM_BPS = 4;
36|
37|    uint256 public proposalCount;
38|    mapping(uint256 => string) public proposalDescriptions;
39|
40|    // ============ EVENTS ============
41|    event ProposalCreatedDetailed(
42|        uint256 indexed proposalId,
43|        address proposer,
44|        string description,
45|        uint256 startBlock,
46|        uint256 endBlock
47|    );
48|
49|    // ============ CONSTRUCTOR ============
50|    constructor(IVotes _token, TimelockController _timelock)
51|        Governor("ArtifactGovernor")
52|        GovernorSettings(INITIAL_VOTING_DELAY, INITIAL_VOTING_PERIOD, INITIAL_PROPOSAL_THRESHOLD)
53|        GovernorVotes(_token)
54|        GovernorVotesQuorumFraction(INITIAL_QUORUM_BPS)
55|        GovernorTimelockControl(_timelock)
56|    {}
57|
58|    // ============ GOVERNANCE OVERRIDES ============
59|    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256);
60|    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256);
61|    function quorum(uint256) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256);
62|    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256);
63|    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState);
64|    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
65|        public override(Governor, IGovernor) returns (uint256 proposalId);
66|
67|    function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
68|        internal override(Governor, GovernorTimelockControl);
69|    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
70|        internal override(Governor, GovernorTimelockControl) returns (uint256);
71|    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address);
72|    function supportsInterface(bytes4 interfaceId) public view override(Governor, GovernorTimelockControl) returns (bool);
73|
74|    // ============ VIEW ============
75|    function getProposalDescription(uint256 proposalId) external view returns (string memory);
76|    function getProposalCount() external view returns (uint256);
77|}
78|