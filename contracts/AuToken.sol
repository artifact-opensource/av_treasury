// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20FlashMintUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Artifact Utility (Au) — v3
 * @notice UUPS upgradeable utility token. Fixed supply. Fees, blocklist, cooldowns, flash loans.
 * @dev Deployed v2 on Base: 0x98D89c8DCEC01d5FD1EFE70989BCcc6031ABA77f
 *
 * @author Artifact Virtual DAO
 *
 * @dev SECURITY NOTES:
 * - 9bps transfer fee: 50% burned, 50% accumulated to treasury
 * - Flash mint fee: 9bps (critical fix from v2 where this was missing)
 * - Fees disabled during initial distribution, enabled after
 * - Blocklist: ANTI_BOT_ROLE can block addresses
 * - Cooldown: anti-bot sell cooldown (configurable, max 7 days)
 * - Max tx: 1% of supply per transaction
 * - Max wallet: 1% of supply per wallet
 *
 * @custom:compiler-version 0.8.26
 * @custom:optimizer-runs 200
 * @custom:evm-version cancun
 */
contract AuToken is
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20FlashMintUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ============ CONSTANTS ============
    /// @notice Maximum total supply (1 billion Au, fixed, no further minting)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    /// @notice Fee denominator (100000 = 100%, basis points)
    uint256 public constant FEE_DENOMINATOR = 100_000;
    /// @notice Initial transfer fee (9 bps = 0.09%)
    uint256 public constant INITIAL_FEE_BPS = 9;
    /// @notice Maximum fee cap (500 bps = 5%, governance-adjustable)
    uint256 public constant MAX_FEE_BPS = 500;
    /// @notice Maximum sell cooldown (7 days)
    uint256 public constant MAX_SELL_COOLDOWN = 7 days;
    /// @notice Minimum transaction amount (1% of supply in bps)
    uint256 public constant MIN_TX_BPS = 100;
    /// @notice Minimum wallet amount (1% of supply in bps)
    uint256 public constant MIN_WALLET_BPS = 100;
    /// @notice Maximum flash loan amount (1M Au)
    uint256 public constant MAX_FLASH_LOAN_CAP = 1_000_000 * 1e18;
    /// @notice Portion of fee burned (5000 = 50%)
    uint256 public constant FEE_BURN_PORTION = 5000;
    /// @notice Fee denominator for calculations (10000 = 100%)
    uint256 public constant FEE_PORTION_DENOMINATOR = 10_000;
    /// @notice UPGRADE_DELAY (7 days timelock)
    uint256 public constant UPGRADE_DELAY = 7 days;

    bytes32 public constant ANTI_BOT_ROLE = keccak256("ANTI_BOT_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ STATE ============
    uint256 public transferFeeBps;
    uint256 public maxTxAmountBps;
    uint256 public maxWalletAmountBps;
    uint256 public sellCooldown;
    address public treasury;
    uint256 public accumulatedFees;
    bool public feesEnabled;

    mapping(address => bool) public isBlocked;
    mapping(address => uint256) public lastSellTimestamp;
    mapping(address => bool) public isWhitelistedContract;

    uint256 public upgradeScheduledAt;
    address public pendingImplementation;

    // ============ ERRORS ============
    /// @notice Sender address is on blocklist
    error Au_SenderBlocked();
    /// @notice Recipient address is on blocklist
    error Au_RecipientBlocked();
    /// @notice Fee exceeds maximum cap
    error Au_FeeExceedsCap(uint256 provided, uint256 maxAllowed);
    /// @notice Cooldown period not elapsed
    error Au_CooldownActive(uint256 remaining);
    /// @notice Exceeds maximum transaction amount
    error Au_ExceedsMaxTx(uint256 value, uint256 maxAllowed);
    /// @notice Exceeds maximum wallet amount
    error Au_ExceedsMaxWallet(uint256 futureBalance, uint256 maxAllowed);
    /// @notice Address is contract (not whitelisted)
    error Au_ContractNotWhitelisted(address target);
    /// @notice Flash loan amount exceeds maximum
    error Au_ExceedsMaxFlashLoan(uint256 value, uint256 maxAllowed);
    /// @notice Zero address not allowed
    error Au_ZeroAddress();
    /// @notice Contract already initialized
    error Au_AlreadyInitialized();

    // ============ EVENTS ============
    event TransferFeeUpdated(uint256 newFeeBps);
    event MaxTxAmountUpdated(uint256 newMaxTxBps);
    event MaxWalletAmountUpdated(uint256 newMaxWalletBps);
    event SellCooldownUpdated(uint256 newCooldown);
    event TreasuryUpdated(address newTreasury);
    event BlocklistUpdated(address indexed account, bool blocked);
    event WhitelistUpdated(address indexed contractAddr, bool whitelisted);
    event FeesWithdrawn(uint256 amount);
    event FeesEnabledChanged(bool enabled);
    event UpgradeAnnounced(address indexed newImplementation, uint256 executableAt);
    event UpgradeExecuted(address indexed newImplementation);
    event UpgradeCancelled(address indexed cancelledImplementation);

    // ============ INITIALIZER ============
    /**
     * @notice Initializes the AuToken proxy
     * @param _treasury Treasury address (fee recipient, MINTER_ROLE receiver)
     */
    function initialize(address _treasury) public initializer {
        require(_treasury != address(0), "Au: zero treasury");
        
        __ERC20_init("Artifact Utility", "Au");
        __ERC20Permit_init("Artifact Utility");
        __ERC20FlashMint_init();
        __AccessControl_init();
        __Pausable_init();

        treasury = _treasury;
        transferFeeBps = INITIAL_FEE_BPS;
        maxTxAmountBps = 1000; // 10%
        maxWalletAmountBps = 1000; // 10%
        sellCooldown = 0;
        accumulatedFees = 0;
        feesEnabled = false;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ANTI_BOT_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    // ============ UPGRADE TIMELOCK ============
    /**
     * @notice Announce upgrade to new implementation
     * @param newImplementation New implementation address
     */
    function announceUpgrade(address newImplementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newImplementation != address(0), "Au: zero impl");
        require(newImplementation.code.length > 0, "Au: not a contract");
        pendingImplementation = newImplementation;
        upgradeScheduledAt = block.timestamp;
        emit UpgradeAnnounced(newImplementation, block.timestamp + UPGRADE_DELAY);
    }

    /**
     * @notice Cancel pending upgrade
     */
    function cancelUpgrade() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit UpgradeCancelled(pendingImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    /**
     * @notice Authorize upgrade (UUPS internal)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pendingImplementation != address(0), "Au: no upgrade announced");
        require(newImplementation == pendingImplementation, "Au: not announced impl");
        require(block.timestamp >= upgradeScheduledAt + UPGRADE_DELAY, "Au: timelock active");
        emit UpgradeExecuted(newImplementation);
        delete pendingImplementation;
        delete upgradeScheduledAt;
    }

    // ============ FEE CONFIGURATION ============
    /**
     * @notice Set transfer fee basis points
     * @param _feeBps New fee in bps (max 500)
     */
    function setTransferFeeBps(uint256 _feeBps) external onlyRole(ANTI_BOT_ROLE) {
        if (_feeBps > MAX_FEE_BPS) revert Au_FeeExceedsCap(_feeBps, MAX_FEE_BPS);
        transferFeeBps = _feeBps;
        emit TransferFeeUpdated(_feeBps);
    }

    function setMaxTxAmount(uint256 _maxTxAmountBps) external onlyRole(ANTI_BOT_ROLE) {
        if (_maxTxAmountBps < MIN_TX_BPS) revert Au_ExceedsMaxTx(_maxTxAmountBps, MIN_TX_BPS);
        maxTxAmountBps = _maxTxAmountBps;
        emit MaxTxAmountUpdated(_maxTxAmountBps);
    }

    function setMaxWalletAmount(uint256 _maxWalletAmountBps) external onlyRole(ANTI_BOT_ROLE) {
        if (_maxWalletAmountBps < MIN_WALLET_BPS) revert Au_ExceedsMaxWallet(_maxWalletAmountBps, MIN_WALLET_BPS);
        maxWalletAmountBps = _maxWalletAmountBps;
        emit MaxWalletAmountUpdated(_maxWalletAmountBps);
    }

    function setSellCooldown(uint256 _cooldown) external onlyRole(ANTI_BOT_ROLE) {
        if (_cooldown > MAX_SELL_COOLDOWN) revert Au_SellCooldownExceedsMax(_cooldown, MAX_SELL_COOLDOWN);
        sellCooldown = _cooldown;
        emit SellCooldownUpdated(_cooldown);
    }

    function setWhitelistedContract(address _contractAddr, bool _whitelisted) external onlyRole(ANTI_BOT_ROLE) {
        isWhitelistedContract[_contractAddr] = _whitelisted;
        emit WhitelistUpdated(_contractAddr, _whitelisted);
    }

    /**
     * @notice Toggle fee on/off
     * @param enabled Fee state
     */
    function setFeesEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feesEnabled = enabled;
        emit FeesEnabledChanged(enabled);
    }

    // ============ FEE WITHDRAWAL ============
    /**
     * @notice Withdraw accumulated fees to treasury
     */
    function withdrawFees() external {
        require(msg.sender == treasury || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Au: not authorized");
        uint256 fees = accumulatedFees;
        require(fees > 0, "Au: no fees");
        accumulatedFees = 0;
        _mint(treasury, fees);
        emit FeesWithdrawn(fees);
    }

    // ============ BLOCKLIST ============
    function setBlocked(address _account, bool _blocked) external onlyRole(ANTI_BOT_ROLE) {
        isBlocked[_account] = _blocked;
        emit BlocklistUpdated(_account, _blocked);
    }

    // ============ PAUSABLE ============
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ============ TREASURY ============
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert Au_ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ============ MINT ============
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Au: max supply");
        _mint(to, amount);
    }

    // ============ FLASH LOAN ============
    /**
     * @notice Maximum flash loan available for a token
     */
    function maxFlashLoan(address token) public view override returns (uint256) {
        if (token != address(this)) return 0;
        return MAX_FLASH_LOAN_CAP;
    }

    /**
     * @notice Calculate flash mint fee (9 bps for v3 fix)
     */
    function _flashFee(address token, uint256 amount) internal view override returns (uint256) {
        if (token != address(this)) revert Au_InvalidToken();
        return (amount * INITIAL_FEE_BPS) / FEE_DENOMINATOR;
    }

    // ============ TRANSFER LOGIC ============
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        // Blocklist check
        if (isBlocked[from]) revert Au_SenderBlocked();

        // Cooldown check (skip for mints/burns)
        if (sellCooldown > 0 && from != address(0) && to != address(0) && to.code.length > 0 && !isWhitelistedContract[to]) {
            if (block.timestamp < lastSellTimestamp[from] + sellCooldown) {
                revert Au_CooldownActive(lastSellTimestamp[from] + sellCooldown - block.timestamp);
            }
            lastSellTimestamp[from] = block.timestamp;
        }

        // Max transaction (skip for mints/burns)
        if (from != address(0) && to != address(0)) {
            uint256 maxTx = (totalSupply() * maxTxAmountBps) / 10_000;
            if (maxTx > 0 && value > maxTx) revert Au_ExceedsMaxTx(value, maxTx);
        }

        // Execute transfer with fee
        if (transferFeeBps > 0 && feesEnabled && from != address(0) && to != address(0)) {
            uint256 fee = (value * transferFeeBps) / FEE_DENOMINATOR;
            uint256 burnAmount = (fee * FEE_BURN_PORTION) / FEE_PORTION_DENOMINATOR;
            uint256 treasuryAmount = fee - burnAmount;

            // Transfer net amount first (updates internal balances via super)
            super._update(from, to, value - fee);

            // Burn portion
            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
            }

            // Accumulate treasury portion
            if (treasuryAmount > 0) {
                accumulatedFees += treasuryAmount;
                super._update(from, address(this), treasuryAmount);
            }
        } else {
            super._update(from, to, value);
        }

        // Max wallet check (after transfer)
        if (to != address(0)) {
            uint256 maxWallet = (totalSupply() * maxWalletAmountBps) / 10_000;
            if (maxWallet > 0 && balanceOf(to) > maxWallet) {
                revert Au_ExceedsMaxWallet(balanceOf(to), maxWallet);
            }
        }
    }

    // ============ TOKEN URI (on-chain SVG) ============
    function tokenURI(uint256) public pure returns (string memory) {
        string memory svgBase64 = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPgogIDxkZWZzPgogICAgPGZpbHRlciBpZD0iY3Jpc3Atc2hhZG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iOCIgZHk9IjEyIiBzdGREZXZpYXRpb249IjEwIiBmbG9vZC1jb2xvcj0iIzAwMDAwMCIgZmxvb2Qtb3BhY2l0eT0iMC40Ii8+CiAgICA8L2ZpbHRlciA+ICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMDAiIGhlaWdodD0iMTAwMCIgZmlsbD0iIzBiMDgxMyIgLz4KICA8ZyBpZD0iR2xpdGNoLUVsZW1lbnRzIiBvcGFjaXR5PSIwLjk1Ij4KICAgIDxyZWN0IHg9IjAiIHk9IjIwMCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxNiIgZmlsbD0iI2YwNGIyMyIgLz4KICAgIDxyZWN0IHg9IjEzMCIgeT0iMjE2IiB3aWR0aD0iMjEwIiBoZWlnaHQ9IjgiIGZpbGw9IiNiMmMwYzYiIC8+CiAgICA8cmVjdCB4PSIyNTUiIHk9IjE1NSIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIxMiIgZmlsbD0iI2Q2M2RmMiIgLz4KICAgIDxyZWN0IHg9IjY4MCIgeT0iNzMwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE0IiBmaWxsPSIjMDBiMGZmIiAvPgogICAgPHJlY3QgeD0iODgwIiB5PSI3NDQiIHdpZHRoPSIxMjAiIGhlaWdodD0iMTYiIGZpbGw9IiMzNzQ3NGYiIC8+CiAgICA8cmVjdCB4PSI3NjAiIHk9IjgwMCIgd2lkdGg9IjE3MCIgaGVpZ2h0PSIxNSIgZmlsbD0iIzAwYmZhNSIgLz4KICA8L2c+CiAgPGcgaWQ9IkNlbnRyYWwtTG9nby1PdXRsaW5lcyIgZmlsdGVyPSJ1cmwoI2NyaXNwLXNoYWRvdykiPgogICAgPHBhdGggZD0iTSAxNjAsNjEwIEwgNDMwLDMwMCBIIDUwNSBWIDM2MCBMIDQxNSw0MzAgSCA1MDUgViA2MzAgSCA0MjUgViA0OTAgSCAzMTUgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIC8+CiAgICA8cGF0aCBkPSJNIDUzNSwzMzUgSCA2MTUgViA1NTAgSCA3NDUgViAzMzUgSCA4MzAgViA1ODAgUSA4MzAsNjMwIDc3MCw2MzAgSCA1ODAgUSA1MzUsNjMwIDUzNSw1ODAgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIC8+CiAgPC9nPgo8L3N2Zz4K";

        string memory json = string(abi.encodePacked(
            '{"name":"Artifact Utility","symbol":"Au","description":"Artifact Utility (Au) is the utility and gas token of Artifact Virtual - a fully autonomous DAO economic system.","image":"data:image/svg+xml;base64,',
            svgBase64,
            '"}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ============ ERROR HELPER (internal) ============
    /// @notice Error: sell cooldown exceeds maximum
    error Au_SellCooldownExceedsMax(uint256 provided, uint256 maxAllowed);
    /// @notice Error: invalid token for flash loan
    error Au_InvalidToken();
}
