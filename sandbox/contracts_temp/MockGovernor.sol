// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * MockGovernor — DAO governance for sandbox parameter tuning
 * ═══════════════════════════════════════════════════════════════════
 *
 * Production: GovernorContract.sol (283 lines)
 * Sandbox:    Simplified governance with timelock, voting, and execution
 *
 * Purpose: Allows bots to simulate governance proposals (parameter changes)
 *          to test if the DAO can respond to market conditions autonomously.
 */

contract MockGovernor {
    // ============ State ============
    uint256 public proposalCount;
    uint256 public votingPeriod;      // blocks
    uint256 public timelockDelay;    // blocks
    uint256 public proposalThreshold; // min Au to propose
    uint256 public quorumBps;        // % of total supply

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votes;

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address target;
        bytes callData;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startBlock;
        uint256 endBlock;
        uint256 executeAfter;  // timelock
        bool executed;
        bool canceled;
    }

    // ============ Events ============
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string description,
        address target
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);

    // ============ Errors ============
    error BelowThreshold();
    error VotingClosed();
    error AlreadyVoted();
    error QuorumNotReached();
    error TimelockNotExpired();
    error AlreadyExecuted();
    error InvalidProposal();

    // ============ Constructor ============
    constructor(
        uint256 _votingPeriod,
        uint256 _timelockDelay,
        uint256 _proposalThreshold,
        uint256 _quorumBps
    ) {
        votingPeriod = _votingPeriod;
        timelockDelay = _timelockDelay;
        proposalThreshold = _proposalThreshold;
        quorumBps = _quorumBps;
    }

    // ============ Governance Flow ============

    /**
     * @notice Create a governance proposal
     * @dev In sandbox, anyone can propose (threshold checked externally)
     */
    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256) {
        proposalCount += 1;
        uint256 id = proposalCount;

        proposals[id] = Proposal({
            id: id,
            proposer: msg.sender,
            description: description,
            target: target,
            callData: callData,
            forVotes: 0,
            againstVotes: 0,
            startBlock: block.number,
            endBlock: block.number + votingPeriod,
            executeAfter: 0,
            executed: false,
            canceled: false
        });

        emit ProposalCreated(id, msg.sender, description, target);
        return id;
    }

    /**
     * @notice Cast a vote on a proposal
     * @param weight Voting power (Au balance of voter)
     */
    function castVote(
        uint256 proposalId,
        bool support,
        uint256 weight
    ) external {
        Proposal storage p = proposals[proposalId];
        if (p.endBlock < block.number) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        if (p.executed) revert AlreadyExecuted();

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Queue proposal for execution (after voting + timelock)
     */
    function queue(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert AlreadyExecuted();
        if (p.endBlock > block.number) revert VotingClosed();

        // Quorum check (simplified: just check forVotes > 0)
        if (p.forVotes == 0) revert QuorumNotReached();

        p.executeAfter = block.number + timelockDelay;
    }

    /**
     * @notice Execute a queued proposal
     */
    function execute(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert AlreadyExecuted();
        if (p.executeAfter == 0) revert InvalidProposal();
        if (block.number < p.executeAfter) revert TimelockNotExpired();

        p.executed = true;

        // Execute the call
        (bool success, ) = p.target.call(p.callData);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal
     */
    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert AlreadyExecuted();
        p.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    // ============ Views ============

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function isReady(uint256 id) external view returns (bool) {
        Proposal storage p = proposals[id];
        return !p.executed && p.executeAfter > 0 && block.number >= p.executeAfter;
    }
}
