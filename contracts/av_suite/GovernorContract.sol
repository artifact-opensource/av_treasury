// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";

/**
 * @title ArtifactGovernor — GovernorContract
 * @notice OpenZeppelin Governor v5 for AV Treasury v3 DAO.
 * @dev Inherits Governor, GovernorSettings, GovernorCountingSimple,
 *      GovernorVotes, GovernorVotesQuorumFraction.
 *      Stores proposal descriptions and emits detailed creation events.
 *      Executor is set via the _executor() override (timelock address).
 *
 * @author Artifact Virtual DAO
 *
 * @custom:compiler-version 0.8.26
 * @custom:optimizer-runs 200
 * @custom:evm-version cancun
 */
contract GovernorContract is
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction
{
    // ─── Constants ────────────────────────────────────────────────────

    /// @notice Initial voting delay: 1 block.
    uint256 public constant INITIAL_VOTING_DELAY = 1;

    /// @notice Initial voting period: 216,000 blocks (~30 days on Base).
    uint256 public constant INITIAL_VOTING_PERIOD = 216000;

    /// @notice Initial proposal threshold: 100,000 Ag (100000e18).
    uint256 public constant INITIAL_PROPOSAL_THRESHOLD = 100000e18;

    /// @notice Initial quorum: 4% of total supply (basis points).
    uint256 public constant INITIAL_QUORUM_BPS = 400;

    // ─── State ────────────────────────────────────────────────────────

    /// @notice Total number of proposals created.
    uint256 public proposalCount;

    /// @notice Mapping from proposal ID to its description string.
    mapping(uint256 => string) public proposalDescriptions;

    /// @notice Executor address for proposals (the timelock).
    address public executorAddress;

    // ─── Events ───────────────────────────────────────────────────────

    /// @notice Emitted when a proposal is created with full detail.
    event ProposalCreatedDetailed(
        uint256 indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 voteStart,
        uint256 voteEnd,
        string description
    );

    // ─── Constructor ──────────────────────────────────────────────────

    /**
     * @notice Deploys the governor contract.
     * @param _token The IVotes-compatible governance token (AgToken).
     * @param executorParam The timelock or executor address.
     */
    constructor(
        IVotes _token,
        address executorParam
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
        executorAddress = executorParam;
    }

    // ─── View Overrides ───────────────────────────────────────────────

    /// @notice Returns the current voting delay (in blocks).
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    /// @notice Returns the current voting period (in blocks).
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    /**
     * @notice Returns the quorum required for a proposal to pass.
     * @param blockNumber Unused — kept for interface compatibility.
     * @return The quorum as a fraction of total supply.
     */
    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(0);
    }

    /// @notice Returns the minimum voting power required to create a proposal.
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /// @notice Returns the address that executes proposals.
    function _executor() internal view override returns (address) {
        return executorAddress;
    }

    // ─── Proposal Lifecycle Overrides ─────────────────────────────────

    /**
     * @notice Returns the state of a proposal.
     * @return The proposal state as a ProposalState enum.
     */
    function state(uint256 proposalId)
        public
        view
        override(Governor)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    /**
     * @notice Creates a new governance proposal.
     * @dev Increments proposalCount and stores the description string.
     *      Emits ProposalCreatedDetailed with full proposal context.
     * @param targets The target addresses for proposal calls.
     * @param values The ETH values for proposal calls.
     * @param calldatas The calldata for proposal calls.
     * @param description The proposal description.
     * @return proposalId The ID of the newly created proposal.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(Governor)
        returns (uint256 proposalId)
    {
        proposalId = super.propose(targets, values, calldatas, description);

        proposalCount++;
        proposalDescriptions[proposalId] = description;

        emit ProposalCreatedDetailed(
            proposalId,
            _msgSender(),
            targets,
            values,
            new string[](targets.length),
            calldatas,
            proposalSnapshot(proposalId),
            proposalDeadline(proposalId),
            description
        );

        return proposalId;
    }

    // ─── Internal Overrides (Diamond Resolution) ─────────────────────

    /**
     * @notice Cancels a proposal.
     */
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(Governor)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    /**
     * @notice Queue proposal operations. Returns 0 (no queuing needed without timelock).
     */
    function _queueOperations(
        uint256,
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32
    )
        internal
        override(Governor)
        returns (uint48)
    {
        return 0;
    }

    /**
     * @notice Execute proposal operations immediately.
     */
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(Governor)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    /// @notice Whether a proposal needs to be queued.
    function proposalNeedsQueuing(uint256)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.proposalNeedsQueuing(0);
    }

    /**
     * @notice Checks if this contract supports a given interface.
     * @param interfaceId The ERC-165 interface identifier.
     * @return True if the interface is supported.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─── Public Helpers ───────────────────────────────────────────────

    /**
     * @notice Returns the description for a given proposal.
     * @return The proposal description string.
     */
    function getProposalDescription(uint256 proposalId)
        public
        view
        returns (string memory)
    {
        return proposalDescriptions[proposalId];
    }

    /// @notice Returns the total number of proposals created.
    function getProposalCount() public view returns (uint256) {
        return proposalCount;
    }
}
