// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title ArtifactTimelock — v3
 * @notice 48-hour timelock for all governance transactions
 * @dev Wraps OpenZeppelin TimelockController with preset roles
 * @dev Deployed v2 on Base: 0xB51542d460DBb4336F011CFF3Cbf80faeB3453f7
 *
 * @author Artifact Virtual DAO
 *
 * @dev SECURITY NOTES:
 * - MIN_DELAY: 48 hours (community time to review)
 * - MAX_DELAY: 30 days
 * - GRACE_PERIOD: 14 days
 * - Proposer role → Governor contract only
 * - Executor role → Governor + multisig
 * - Canceler → emergency role
 *
 * @custom:compiler-version 0.8.26
 * @custom:optimizer-runs 200
 * @custom:evm-version cancun
 */
contract ArtifactTimelock is TimelockController
{
    uint256 public constant MIN_DELAY = 48 hours;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    // ============ ERRORS ============
    error Timelock_ZeroAddress();

    // ============ EVENTS ============
    event TimelockDeployed(
        address admin,
        address proposer,
        address executor,
        uint256 minDelay
    );

    // ============ CONSTRUCTOR ============
    /**
     * @notice Initialize ArtifactTimelock
     * @param _proposer Address that can propose operations (Governor)
     * @param _executor Address that can execute operations (Governor + multisig)
     * @param _canceler Address that can cancel operations (emergency role)
     */
    constructor(
        address _proposer,
        address _executor,
        address _canceler
    ) TimelockController(
        MIN_DELAY,
        _arr(_proposer),
        _arr(_executor),
        _canceler
    ) {
        if (_proposer == address(0)) revert Timelock_ZeroAddress();
        emit TimelockDeployed(_canceler, _proposer, _executor, MIN_DELAY);
    }

    // ============ HELPER ============
    function _arr(address a) internal pure returns (address[] memory) {
        address[] memory arr = new address[](1);
        arr[0] = a;
        return arr;
    }

    // ============ VIEW ============
    function getMinDelay() public view override returns (uint256) {
        return MIN_DELAY;
    }

    function getMaxDelay() public view returns (uint256) {
        return MAX_DELAY;
    }

    function getGracePeriod() public view returns (uint256) {
        return GRACE_PERIOD;
    }
}
