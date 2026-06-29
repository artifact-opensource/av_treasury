// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";

/**
 * @title ArtifactGovernor v5 — UUPS Upgradeable
 * @notice Upgradeable governance contract for AV Treasury DAO.
 * @dev Deploys behind a UUPS proxy to bypass EIP-170 24KB code size limit.
 *      Implements timelock integration directly (no GovernorTimelockControl
 *      inheritance due to Solidity 0.8.26 abstract override bugs).
 *
 * @custom:security timelock — All proposals must be queued in the timelock
 *      before execution. No governance action can bypass the delay.
 * @custom:upgrade Only governance can authorize upgrades (via timelock).
 */
contract GovernorContractV5UUPS is
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    UUPSUpgradeable
{
    // ─── Constants ────────────────────────────────────────────────────

    uint256 public constant INITIAL_VOTING_DELAY = 1;
    uint256 public constant INITIAL_VOTING_PERIOD = 216000;
    uint256 public constant INITIAL_PROPOSAL_THRESHOLD = 100000e18;
    uint256 public constant INITIAL_QUORUM_BPS = 4;

    // ─── State ─────────────────────────────────────────────────────────

    TimelockController public timelock;
    mapping(uint256 => bytes32) private _timelockIds;
    uint256 public proposalCount;
    mapping(uint256 => string) public proposalDescriptions;

    struct ProposalData {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bytes32 descriptionHash;
    }
    mapping(uint256 => ProposalData) private _proposalData;

    // ─── Events ────────────────────────────────────────────────────────

    event ProposalTimelockQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalCreatedDetailed(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 voteStart,
        uint256 voteEnd,
        string description
    );

    // ─── Initializer ──────────────────────────────────────────────────

    function initialize(
        IVotes _token,
        TimelockController _timelock
    ) public initializer {
        __Governor_init("ArtifactGovernor");
        __GovernorSettings_init(
            uint48(INITIAL_VOTING_DELAY),
            uint32(INITIAL_VOTING_PERIOD),
            INITIAL_PROPOSAL_THRESHOLD
        );
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(INITIAL_QUORUM_BPS);
        timelock = _timelock;
    }

    // ─── UUPS Authorization ────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyTimelock {}

    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "Only timelock");
        _;
    }

    // ─── Timelock Integration ──────────────────────────────────────────

    function _executor() internal view override returns (address) {
        return address(timelock);
    }

    function proposalNeedsQueuing(uint256) public pure override returns (bool) {
        return true;
    }

    function state(uint256 proposalId)
        public
        view
        override
        returns (ProposalState)
    {
        ProposalState baseState = super.state(proposalId);
        if (baseState == ProposalState.Succeeded) {
            bytes32 tid = _timelockIds[proposalId];
            if (tid != bytes32(0)) {
                if (timelock.isOperationDone(tid)) return ProposalState.Executed;
                if (timelock.isOperationPending(tid)) return ProposalState.Queued;
            }
        }
        return baseState;
    }

    function queue(uint256 proposalId) public virtual returns (uint256) {
        require(state(proposalId) == ProposalState.Succeeded, "Governor: not succeeded");
        ProposalData storage pd = _proposalData[proposalId];
        for (uint256 i = 0; i < pd.targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            timelock.schedule(pd.targets[i], pd.values[i], pd.calldatas[i], bytes32(0), salt, timelock.getMinDelay());
        }
        bytes32 tid = _computeSalt(proposalId, 0);
        _timelockIds[proposalId] = tid;
        emit ProposalTimelockQueued(proposalId, block.timestamp + timelock.getMinDelay());
        return proposalId;
    }

    function executeProposal(uint256 proposalId) public virtual {
        require(state(proposalId) == ProposalState.Queued, "Governor: not queued");
        ProposalData storage pd = _proposalData[proposalId];
        for (uint256 i = 0; i < pd.targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            timelock.execute(pd.targets[i], pd.values[i], pd.calldatas[i], bytes32(0), salt);
        }
        delete _timelockIds[proposalId];
        emit ProposalExecuted(proposalId);
    }

    // ─── Internal ──────────────────────────────────────────────────────

    function _computeSalt(uint256 proposalId, uint256 index) internal pure returns (bytes32) {
        return keccak256(abi.encode(proposalId, index));
    }

    function _executeOperations(
        uint256, address[] memory, uint256[] memory, bytes[] memory, bytes32
    ) internal pure override {
        revert("Governor: use queue() and executeProposal()");
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override returns (uint48) {
        _proposalData[proposalId] = ProposalData(targets, values, calldatas, descriptionHash);
        for (uint256 i = 0; i < targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            timelock.schedule(targets[i], values[i], calldatas[i], bytes32(0), salt, timelock.getMinDelay());
        }
        bytes32 tid = _computeSalt(proposalId, 0);
        _timelockIds[proposalId] = tid;
        emit ProposalTimelockQueued(proposalId, block.timestamp + timelock.getMinDelay());
        return uint48(block.timestamp + timelock.getMinDelay());
    }

    // ─── View Overrides ───────────────────────────────────────────────

    function votingDelay() public view override(GovernorUpgradeable, GovernorSettingsUpgradeable) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(GovernorUpgradeable, GovernorSettingsUpgradeable) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256) public view override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable) returns (uint256) {
        return super.quorum(0);
    }

    function proposalThreshold() public view override(GovernorUpgradeable, GovernorSettingsUpgradeable) returns (uint256) {
        return super.proposalThreshold();
    }

    function propose(
        address[] memory targets, uint256[] memory values,
        bytes[] memory calldatas, string memory description
    ) public override(GovernorUpgradeable) returns (uint256) {
        uint256 pid = super.propose(targets, values, calldatas, description);
        _proposalData[pid] = ProposalData(targets, values, calldatas, keccak256(bytes(description)));
        proposalCount++;
        proposalDescriptions[pid] = description;
        emit ProposalCreatedDetailed(pid, _msgSender(), proposalSnapshot(pid), proposalDeadline(pid), description);
        return pid;
    }

    function supportsInterface(bytes4 interfaceId) public view override(GovernorUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
