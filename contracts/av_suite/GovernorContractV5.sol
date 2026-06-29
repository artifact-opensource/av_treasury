// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title ArtifactGovernor v5
 * @notice Governance contract for AV Treasury DAO.
 * @dev Compatible with OpenZeppelin v5.6.x and Solidity 0.8.26.
 *      Implements timelock integration directly instead of inheriting from
 *      GovernorTimelockControl (which is abstract and causes Solidity 0.8.26
 *      override resolution bugs).
 *
 *      All proposal execution is routed through the TimelockController,
 *      enforcing a minimum 48h delay on governance actions.
 *
 * @custom:security timelock — All proposals must be queued in the timelock
 *      before execution. No governance action can bypass the delay.
 * @custom:ozfive Updated for OZ v5 compatibility (uint48 queue IDs, etc.)
 */
contract GovernorContractV5 is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction
{
    // ─── Constants ────────────────────────────────────────────────────

    uint256 public constant INITIAL_VOTING_DELAY = 1;
    uint256 public constant INITIAL_VOTING_PERIOD = 216000;
    uint256 public constant INITIAL_PROPOSAL_THRESHOLD = 100000e18;
    uint256 public constant INITIAL_QUORUM_BPS = 4;

    // ─── State ─────────────────────────────────────────────────────────

    /// @notice The TimelockController instance that enforces execution delays.
    TimelockController public immutable TIMELOCK;

    /// @notice Mapping from proposal ID to timelock operation salt.
    mapping(uint256 => bytes32) private _timelockIds;

    /// @notice Proposal data storage (targets, values, calldatas, descriptionHash).
    struct ProposalData {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bytes32 descriptionHash;
    }

    /// @notice Mapping from proposal ID to its stored data.
    mapping(uint256 => ProposalData) private _proposalData;

    // ─── Events ────────────────────────────────────────────────────────

    event ProposalTimelockQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalTimelocked(uint256 indexed proposalId, bytes32 indexed timelockId);

    // ─── Constructor ───────────────────────────────────────────────────

    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("ArtifactGovernor")
        GovernorSettings(
            uint48(INITIAL_VOTING_DELAY),
            uint32(INITIAL_VOTING_PERIOD),
            INITIAL_PROPOSAL_THRESHOLD
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(INITIAL_QUORUM_BPS)
    {
        TIMELOCK = _timelock;
    }

    // ─── Timelock Integration ──────────────────────────────────────────

    /**
     * @notice Returns the timelock address as the executor.
     * @dev This ensures that the Governor's relay() function routes through
     *      the timelock, and that proposals are identified as timelocked.
     */
    function _executor() internal view override returns (address) {
        return address(TIMELOCK);
    }

    /**
     * @notice Whether a proposal needs to be queued before execution.
     * @dev Always returns true — all proposals must go through the timelock.
     */
    function proposalNeedsQueuing(uint256) public pure override returns (bool) {
        return true;
    }

    /**
     * @notice Get the state of a proposal.
     * @dev Extends the base states with Queued (from timelock).
     */
    function state(uint256 proposalId)
        public
        view
        override
        returns (ProposalState)
    {
        ProposalState baseState = super.state(proposalId);

        if (baseState == ProposalState.Succeeded) {
            // Check if already queued in timelock
            bytes32 timelockId = _timelockIds[proposalId];
            if (timelockId != bytes32(0)) {
                if (TIMELOCK.isOperationDone(timelockId)) {
                    return ProposalState.Executed;
                } else if (TIMELOCK.isOperationPending(timelockId)) {
                    return ProposalState.Queued;
                }
            }
        }

        return baseState;
    }

    /**
     * @notice Queue a proposal in the timelock after it succeeds.
     * @dev Called after a proposal passes voting. Starts the timelock delay.
     */
    function queue(
        uint256 proposalId
    ) public virtual returns (uint256) {
        ProposalState currentState = state(proposalId);
        require(
            currentState == ProposalState.Succeeded,
            "Governor: proposal not succeeded"
        );

        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            bytes32 descriptionHash
        ) = (_proposalData[proposalId].targets, _proposalData[proposalId].values, _proposalData[proposalId].calldatas, _proposalData[proposalId].descriptionHash);

        // Queue each operation in the timelock
        for (uint256 i = 0; i < targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            TIMELOCK.schedule(
                targets[i],
                values[i],
                calldatas[i],
                bytes32(0), // predecessor
                salt,
                TIMELOCK.getMinDelay()
            );
        }

        // Store the timelock ID for state tracking
        bytes32 timelockId = _computeSalt(proposalId, 0);
        _timelockIds[proposalId] = timelockId;

        emit ProposalTimelockQueued(proposalId, block.timestamp + TIMELOCK.getMinDelay());
        emit ProposalTimelocked(proposalId, timelockId);

        return proposalId;
    }

    /**
     * @notice Execute a proposal after the timelock delay has passed.
     * @dev Called after the timelock delay expires.
     */
    function execute(
        uint256 proposalId
    ) public virtual returns (uint256) {
        ProposalState currentState = state(proposalId);
        require(
            currentState == ProposalState.Queued,
            "Governor: proposal not queued"
        );

        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            bytes32 descriptionHash
        ) = (_proposalData[proposalId].targets, _proposalData[proposalId].values, _proposalData[proposalId].calldatas, _proposalData[proposalId].descriptionHash);

        // Execute each operation through the timelock
        for (uint256 i = 0; i < targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            TIMELOCK.execute(
                targets[i],
                values[i],
                calldatas[i],
                bytes32(0), // predecessor
                salt
            );
        }

        // Clean up
        delete _timelockIds[proposalId];

        emit ProposalExecuted(proposalId);

        return proposalId;
    }

    // ─── Internal Helpers ───────────────────────────────────────────────

    /**
     * @dev Compute a deterministic salt for timelock operations.
     */
    function _computeSalt(
        uint256 proposalId,
        uint256 index
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(proposalId, index));
    }

    /**
     * @dev Override to prevent direct execution — must go through timelock.
     */
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override {
        // This should never be called directly — use queue() + execute()
        // If somehow called, revert
        revert("Governor: use queue() and execute() for timelocked proposals");
    }

    /**
     * @dev Override to queue in timelock instead of direct execution.
     */
    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override returns (uint48) {
        // Queue each operation in the timelock
        for (uint256 i = 0; i < targets.length; ++i) {
            bytes32 salt = _computeSalt(proposalId, i);
            TIMELOCK.schedule(
                targets[i],
                values[i],
                calldatas[i],
                bytes32(0),
                salt,
                TIMELOCK.getMinDelay()
            );
        }

        bytes32 timelockId = _computeSalt(proposalId, 0);
        _timelockIds[proposalId] = timelockId;

        emit ProposalTimelockQueued(proposalId, block.timestamp + TIMELOCK.getMinDelay());

        return uint48(block.timestamp + TIMELOCK.getMinDelay());
    }

    // ─── View Overrides (Diamond Resolution) ─────────────────────────

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(0);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(Governor)
        returns (uint256)
    {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        _proposalData[proposalId] = ProposalData(
            targets,
            values,
            calldatas,
            keccak256(bytes(description))
        );
        return proposalId;
    }

    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override(Governor) returns (uint256) {
        return super.cancel(targets, values, calldatas, descriptionHash);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
