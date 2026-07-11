// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * TreasurySafe — minimal 2-of-N multisig (Safe-style) for local testnet.
 * Owners execute via submit + confirm; threshold confirms required.
 * Provides execTransaction(recipient, value, data) for governance/treasury actions.
 */
contract TreasurySafe {
    address[] public owners;
    uint256 public threshold;
    uint256 public nonce;

    struct Tx { address to; uint256 value; bytes data; bool executed; }

    mapping(uint256 => Tx) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;

    event Submission(uint256 txId);
    event Confirmation(address owner, uint256 txId);
    event Execution(uint256 txId);

    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length >= _threshold && _threshold > 0, "bad cfg");
        for (uint256 i; i < _owners.length; i++) owners.push(_owners[i]);
        threshold = _threshold;
    }

    modifier onlyOwner() {
        bool ok;
        for (uint256 i; i < owners.length; i++) if (owners[i] == msg.sender) ok = true;
        require(ok, "not owner");
        _;
    }

    function submit(address to, uint256 value, bytes calldata data) external onlyOwner returns (uint256) {
        uint256 id = nonce++;
        transactions[id] = Tx(to, value, data, false);
        emit Submission(id);
        confirm(id);
        return id;
    }

    function confirm(uint256 txId) public onlyOwner {
        require(!confirmations[txId][msg.sender], "confirmed");
        confirmations[txId][msg.sender] = true;
        emit Confirmation(msg.sender, txId);
        if (isConfirmed(txId)) execute(txId);
    }

    function isConfirmed(uint256 txId) public view returns (bool) {
        uint256 c;
        for (uint256 i; i < owners.length; i++) if (confirmations[txId][owners[i]]) c++;
        return c >= threshold;
    }

    function execute(uint256 txId) public {
        Tx storage t = transactions[txId];
        require(!t.executed, "done");
        require(isConfirmed(txId), "not confirmed");
        t.executed = true;
        (bool ok, ) = t.to.call{value: t.value}(t.data);
        require(ok, "exec failed");
        emit Execution(txId);
    }
}
