// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PID_Emission_Controller_v3 is AccessControl {
    bytes32 public constant EMIT_ROLE = keccak256('EMIT_ROLE');
    bytes32 public constant AG_MINTER_ROLE = keccak256('AG_MINTER_ROLE');

    IERC20 public agToken;
    address public keeper;

    event EmissionTriggered(uint256 pid, uint256 amount);

    constructor(address _agToken, address _keeper, address _admin) {
        agToken = IERC20(_agToken);
        keeper = _keeper;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EMIT_ROLE, _keeper);
        _grantRole(AG_MINTER_ROLE, _keeper);
    }

    function triggerEmission(uint256 pid, uint256 amount) external onlyRole(EMIT_ROLE) {
        emit EmissionTriggered(pid, amount);
    }

    function updateKeeper(address _newKeeper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(EMIT_ROLE, _newKeeper);
        _grantRole(AG_MINTER_ROLE, _newKeeper);
        keeper = _newKeeper;
    }
}
