// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./AvOracle.sol";
import "./TreasuryAMO.sol";
import "./TreasuryFlashBuy.sol";

/**
 * @title OracleWrapper
 * @notice Bridges AvOracle price feeds into TreasuryAMO and TreasuryFlashBuy
 * @dev Reads canonical on-chain prices from AvOracle and provides deviation
 *      alerts. Can trigger FlashBuy when Au trades below peg.
 *
 * DESIGN PHILOSOPHY:
 *   - This wrapper does NOT change existing contracts. It's an additive layer.
 *   - TreasuryAMO can opt-in to use oracle price via setUseOracle().
 *   - TreasuryFlashBuy can be configured to trigger on oracle price deviation.
 *   - All oracle reads are non-view; state-changing functions emit events
 *     that off-chain relayers can act on.
 *
 * DEVIATION MODEL:
 *   The wrapper compares the oracle price to a reference price (e.g., $1.00
 *   for Au). If deviation exceeds a governance-set threshold, it emits a
 *   deviation alert. FlashBuy can be triggered by this.
 *
 * SECURITY:
 *   - Stale price check: oracle timestamps must be within MAX_STALENESS
 *   - Price sanity: prices must be within MIN/MAX bounds
 *   - Only governance can update thresholds and reference prices
 *   - Emergency pause via governance
 */
contract OracleWrapper {

    // ============ IMMUTABLES ============
    AvOracle public immutable avOracle;
    TreasuryAMO public immutable treasuryAMO;
    TreasuryFlashBuy public immutable treasuryFlashBuy;

    // ============ GOVERNANCE ============
    address public governance;
    address public pendingGovernance;
    modifier onlyGovernance() {
        require(msg.sender == governance, "OW: only governance");
        _;
    }

    // ============ DEVIATION CONFIG ============
    uint256 public deviationThreshold;       // Basis points (10000 = 100%)
    uint256 public constant MAX_DEVIATION = 2000;  // 20% max threshold
    uint256 public constant MIN_DEVIATION = 50;    // 0.5% min threshold

    // Reference prices (scaled to 1e18)
    // For Au: $1.00 = 1e18
    mapping(bytes32 => uint256) public referencePrices;

    // Token symbols we track
    bytes32 public constant AU_KEY = keccak256("AU");
    bytes32 public constant AG_KEY = keccak256("AG");

    // ============ STALENESS ============
    uint256 public maxStaleness;  // seconds
    uint256 public constant DEFAULT_MAX_STALENESS = 3600; // 1 hour
    uint256 public constant MIN_MAX_STALENESS = 60;       // 1 minute
    uint256 public constant MAX_MAX_STALENESS = 86400;   // 24 hours

    // ============ PRICE BOUNDS ============
    // Sanity bounds for Au price (scaled 1e18)
    // Au currently trades at ~$0.0085, so bounds must accommodate that
    uint256 public auMinPrice = 0.001e18;  // $0.001 (1/1000th of a cent)
    uint256 public auMaxPrice = 10.0e18;   // $10.00

    // ============ FLASHBUY TRIGGER ============
    bool public flashBuyEnabled;
    uint256 public flashBuyTriggerBps;  // Trigger when Au below this % of reference
    uint256 public constant DEFAULT_FLASHBUY_TRIGGER_BPS = 9800; // 98% of $1 = $0.98

    // ============ TOKEN ADDRESSES ============
    mapping(bytes32 => address) public tokenAddresses;

    // ============ ORACLE OVERRIDE ============
    // If true, TreasuryAMO will use oracle price instead of internal reservePerAu
    bool public oracleOverrideEnabled;

    // ============ PAUSE ============
    bool public paused;

    // ============ EVENTS ============
    event DeviationAlert(
        bytes32 indexed tokenKey,
        uint256 oraclePrice,
        uint256 referencePrice,
        uint256 deviationBps,
        uint256 timestamp
    );
    event FlashBuyTrigger(
        bytes32 indexed tokenKey,
        uint256 oraclePrice,
        uint256 referencePrice,
        uint256 timestamp
    );
    event ReferencePriceUpdated(bytes32 indexed tokenKey, uint256 newPrice);
    event DeviationThresholdUpdated(uint256 newThresholdBps);
    event MaxStalenessUpdated(uint256 newMaxStaleness);
    event FlashBuyToggled(bool enabled);
    event FlashBuyTriggerUpdated(uint256 newTriggerBps);
    event OracleOverrideToggled(bool enabled);
    event GovernanceProposed(address indexed newGovernance);
    event GovernanceAccepted(address indexed newGovernance);
    event Paused();
    event Unpaused();

    // ============ ERRORS ============
    error OW_OnlyGovernance();
    error OW_InvalidThreshold();
    error OW_InvalidStaleness();
    error OW_InvalidPrice();
    error OW_StalePrice();
    error OW_PriceOutOfBounds();
    error OW_NotPaused();
    error OW_Paused();
    error OW_OnlyPendingGovernance();
    error OW_ZeroAddress();

    // ============ CONSTRUCTOR ============
    constructor(
        address _avOracle,
        address _treasuryAMO,
        address _treasuryFlashBuy,
        uint256 _deviationThreshold,
        uint256 _maxStaleness
    ) {
        if (_avOracle == address(0)) revert OW_ZeroAddress();
        if (_treasuryAMO == address(0)) revert OW_ZeroAddress();
        if (_treasuryFlashBuy == address(0)) revert OW_ZeroAddress();
        if (_deviationThreshold < MIN_DEVIATION || _deviationThreshold > MAX_DEVIATION)
            revert OW_InvalidThreshold();
        if (_maxStaleness < MIN_MAX_STALENESS || _maxStaleness > MAX_MAX_STALENESS)
            revert OW_InvalidStaleness();

        avOracle = AvOracle(_avOracle);
        treasuryAMO = TreasuryAMO(_treasuryAMO);
        treasuryFlashBuy = TreasuryFlashBuy(_treasuryFlashBuy);
        deviationThreshold = _deviationThreshold;
        maxStaleness = _maxStaleness;
        governance = msg.sender;
        flashBuyTriggerBps = DEFAULT_FLASHBUY_TRIGGER_BPS;

        // Set default reference price for Au = $1.00
        referencePrices[AU_KEY] = 1e18;
    }

    // ============ GOVERNANCE FUNCTIONS ============

    function proposeGovernance(address _newGovernance) external onlyGovernance {
        if (_newGovernance == address(0)) revert OW_ZeroAddress();
        pendingGovernance = _newGovernance;
        emit GovernanceProposed(_newGovernance);
    }

    function acceptGovernance() external {
        if (msg.sender != pendingGovernance) revert OW_OnlyPendingGovernance();
        governance = pendingGovernance;
        pendingGovernance = address(0);
        emit GovernanceAccepted(governance);
    }

    function setDeviationThreshold(uint256 _thresholdBps) external onlyGovernance {
        if (_thresholdBps < MIN_DEVIATION || _thresholdBps > MAX_DEVIATION)
            revert OW_InvalidThreshold();
        deviationThreshold = _thresholdBps;
        emit DeviationThresholdUpdated(_thresholdBps);
    }

    function setMaxStaleness(uint256 _maxStaleness) external onlyGovernance {
        if (_maxStaleness < MIN_MAX_STALENESS || _maxStaleness > MAX_MAX_STALENESS)
            revert OW_InvalidStaleness();
        maxStaleness = _maxStaleness;
        emit MaxStalenessUpdated(_maxStaleness);
    }

    function setReferencePrice(bytes32 _tokenKey, uint256 _price) external onlyGovernance {
        if (_price == 0) revert OW_InvalidPrice();
        referencePrices[_tokenKey] = _price;
        emit ReferencePriceUpdated(_tokenKey, _price);
    }

    function setFlashBuyEnabled(bool _enabled) external onlyGovernance {
        flashBuyEnabled = _enabled;
        emit FlashBuyToggled(_enabled);
    }

    function setFlashBuyTrigger(uint256 _triggerBps) external onlyGovernance {
        if (_triggerBps < 9000 || _triggerBps > 10000) revert OW_InvalidThreshold();
        flashBuyTriggerBps = _triggerBps;
        emit FlashBuyTriggerUpdated(_triggerBps);
    }

    function setTokenAddress(bytes32 _tokenKey, address _tokenAddress) external onlyGovernance {
        if (_tokenAddress == address(0)) revert OW_ZeroAddress();
        tokenAddresses[_tokenKey] = _tokenAddress;
    }

    function setOracleOverride(bool _enabled) external onlyGovernance {
        oracleOverrideEnabled = _enabled;
        emit OracleOverrideToggled(_enabled);
    }

    function setPriceBounds(uint256 _minPrice, uint256 _maxPrice) external onlyGovernance {
        if (_minPrice >= _maxPrice) revert OW_InvalidPrice();
        auMinPrice = _minPrice;
        auMaxPrice = _maxPrice;
    }

    function pause() external onlyGovernance {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyGovernance {
        paused = false;
        emit Unpaused();
    }

    // ============ CORE VIEW FUNCTIONS ============

    /**
     * @notice Get the oracle price for a token with staleness and sanity checks
     * @param _tokenKey The token key (e.g., AU_KEY)
     * @return price The oracle price scaled to 1e18
     * @return source The price source (Chainlink or TWAP)
     */
    function getOraclePrice(bytes32 _tokenKey) public view returns (uint256 price, AvOracle.PriceSource source) {
        address token = tokenAddresses[_tokenKey];
        if (token == address(0)) revert OW_ZeroAddress();

        (price, source) = avOracle.getPrice(token);

        // Bounds check for Au
        if (_tokenKey == AU_KEY) {
            if (price < auMinPrice || price > auMaxPrice) revert OW_PriceOutOfBounds();
        }

        return (price, source);
    }

    /**
     * @notice Check if the oracle price deviates from reference beyond threshold
     * @param _tokenKey The token to check
     * @return isDeviated True if deviation exceeds threshold
     * @return oraclePrice Current oracle price
     * @return referencePrice The reference price
     * @return deviationBps Deviation in basis points (10000 = 100%)
     */
    function checkDeviation(bytes32 _tokenKey)
        public
        view
        returns (
            bool isDeviated,
            uint256 oraclePrice,
            uint256 referencePrice,
            uint256 deviationBps
        )
    {
        (oraclePrice, ) = getOraclePrice(_tokenKey);
        referencePrice = referencePrices[_tokenKey];

        if (referencePrice == 0) return (false, oraclePrice, 0, 0);

        // Calculate deviation in basis points
        if (oraclePrice > referencePrice) {
            deviationBps = ((oraclePrice - referencePrice) * 10000) / referencePrice;
        } else {
            deviationBps = ((referencePrice - oraclePrice) * 10000) / referencePrice;
        }

        isDeviated = deviationBps > deviationThreshold;
        return (isDeviated, oraclePrice, referencePrice, deviationBps);
    }

    /**
     * @notice Check if FlashBuy should trigger based on oracle price
     * @return shouldTrigger True if Au is below trigger threshold
     * @return oraclePrice Current Au oracle price
     * @return triggerPrice The trigger price level
     */
    function checkFlashBuyTrigger()
        public
        view
        returns (bool shouldTrigger, uint256 oraclePrice, uint256 triggerPrice)
    {
        (oraclePrice, ) = getOraclePrice(AU_KEY);
        uint256 referencePrice = referencePrices[AU_KEY];

        if (referencePrice == 0) return (false, oraclePrice, 0);

        triggerPrice = (referencePrice * flashBuyTriggerBps) / 10000;
        shouldTrigger = oraclePrice < triggerPrice;
        return (shouldTrigger, oraclePrice, triggerPrice);
    }

    /**
     * @notice Get the oracle price formatted for TreasuryAMO consumption
     * @return price Au price in USDC terms (1e18 scaled)
     * @return source The price source
     */
    function getAuPriceForAMO() external view returns (uint256 price, AvOracle.PriceSource source) {
        (price, source) = getOraclePrice(AU_KEY);
        return (price, source);
    }

    /**
     * @notice Get the oracle price formatted for FlashBuy consumption
     * @return price Au price in USDC terms (1e18 scaled)
     * @return source The price source
     */
    function getAuPriceForFlashBuy() external view returns (uint256 price, AvOracle.PriceSource source) {
        (price, source) = getOraclePrice(AU_KEY);
        return (price, source);
    }

    // ============ CHECK + EMIT FUNCTIONS ============
    // These can be called by anyone (or automation) to trigger events

    /**
     * @notice Check deviation and emit alert if threshold exceeded
     */
    function emitDeviationAlert(bytes32 _tokenKey) external {
        (bool isDeviated, uint256 oraclePrice, uint256 referencePrice, uint256 deviationBps) =
            checkDeviation(_tokenKey);

        if (isDeviated) {
            emit DeviationAlert(_tokenKey, oraclePrice, referencePrice, deviationBps, block.timestamp);
        }
    }

    /**
     * @notice Check FlashBuy trigger and emit event if triggered
     */
    function emitFlashBuyTrigger() external {
        if (!flashBuyEnabled) return;

        (bool shouldTrigger, uint256 oraclePrice, ) = checkFlashBuyTrigger();

        if (shouldTrigger) {
            emit FlashBuyTrigger(AU_KEY, oraclePrice, referencePrices[AU_KEY], block.timestamp);
        }
    }

}
