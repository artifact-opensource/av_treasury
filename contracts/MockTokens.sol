// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ═══════════════════════════════════════════════════════════════════
 * Mock Tokens — Full Dual-Token Architecture (Au + Ag)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Lightweight mocks that replicate the real token economics:
 * - Au: 9bps transfer fee (4.5bps burned, 4.5bps to treasury), max tx/wallet
 * - Ag: elastic supply, mintable by authorized role (simulates PID)
 *
 * No proxy overhead — direct deployment for fast sandbox iteration.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockAuToken
 * @notice Sandbox Au with 9bps fee (4.5bps burn, 4.5bps treasury), max tx 1%, max wallet 1%
 */
contract MockAuToken is ERC20, Ownable {
    uint256 public constant FEE_DENOMINATOR = 100_000;
    uint256 public constant FEE_BPS = 9;           // 0.09%
    uint256 public constant FEE_BURN_PORTION = 5000; // 50% of fee burned
    uint256 public constant FEE_PORTION_DENOM = 10_000;
    uint256 public constant MAX_TX_BPS = 100;        // 1% of supply
    uint256 public constant MAX_WALLET_BPS = 100;    // 1% of supply

    address public treasury;
    uint256 public accumulatedFees;
    uint256 public totalBurned;

    mapping(address => bool) public isBlocked;

    event TransferFee(address indexed from, address indexed to, uint256 fee, uint256 burned);

    constructor(address _treasury) ERC20("Artifact Utility", "Au") Ownable(msg.sender) {
        treasury = _treasury;
        // Initial supply: 1M Au to deployer (governance)
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Skip fee on mint (from == address(0)) and burn (to == address(0))
        if (from != address(0) && to != address(0) && !isBlocked[from]) {
            uint256 fee = (value * FEE_BPS) / FEE_DENOMINATOR;
            uint256 burned = (fee * FEE_BURN_PORTION) / FEE_PORTION_DENOM;
            uint256 toTreasury = fee - burned;

            super._update(from, address(0), burned);  // burn
            totalBurned += burned;
            accumulatedFees += toTreasury;

            // Transfer net amount after fee
            super._update(from, to, value - fee);
            emit TransferFee(from, to, fee, burned);
            return;
        }
        super._update(from, to, value);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!isBlocked[msg.sender], "Au: blocked");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!isBlocked[from], "Au: blocked");
        return super.transferFrom(from, to, amount);
    }

    function blockAddress(address addr) external onlyOwner {
        isBlocked[addr] = true;
    }

    function unblockAddress(address addr) external onlyOwner {
        isBlocked[addr] = false;
    }
}

/**
 * @title MockAgToken
 * @notice Sandbox Ag with elastic supply, mintable by PID (simulated)
 */
contract MockAgToken is ERC20, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    mapping(bytes32 => mapping(address => bool)) public _roles;

    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    constructor() ERC20("Artifact Governance", "Ag") Ownable(msg.sender) {
        _roles[MINTER_ROLE][msg.sender] = true; // Owner is initial minter
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) external onlyOwner {
        _roles[role][account] = true;
    }

    function mint(address to, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Ag: not minter");
        require(totalSupply() + amount <= MAX_SUPPLY, "Ag: max supply");
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Ag: not burner");
        _burn(from, amount);
        emit Burn(from, amount);
    }
}

/**
 * @title MockTokens
 * @notice Deployer + faucet for the dual-token sandbox
 */
contract MockTokens {
    MockAuToken public auToken;
    MockAgToken public agToken;
    address public treasury;

    constructor(address _treasury) {
        treasury = _treasury;
        auToken = new MockAuToken(_treasury);
        agToken = new MockAgToken();
        // Grant this contract minter role on Ag
        agToken.grantRole(keccak256("MINTER_ROLE"), address(this));
    }

    /**
     * @notice Fund a bot with both tokens
     */
    function fundBot(address bot, uint256 auAmount, uint256 agAmount) external {
        // Au: transfer from owner (deployer) to bot
        require(
            auToken.transferFrom(msg.sender, bot, auAmount),
            "Au transfer failed"
        );
        // Ag: mint to bot (simulating PID emission)
        if (agAmount > 0) {
            agToken.mint(bot, agAmount);
        }
    }

    /**
     * @notice Mint Ag (simulates PID emission)
     */
    function mintAg(address to, uint256 amount) external {
        agToken.mint(to, amount);
    }

    /**
     * @notice Get Au supply (accounting for burns)
     */
    function totalAuSupply() external view returns (uint256) {
        return auToken.totalSupply();
    }

    /**
     * @notice Get Ag supply
     */
    function totalAgSupply() external view returns (uint256) {
        return agToken.totalSupply();
    }
}
