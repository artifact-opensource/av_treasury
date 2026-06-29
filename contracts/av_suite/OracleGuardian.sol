// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import "./AvOracle.sol";
import "./TreasuryAMO.sol";

/**
 * @title OracleGuardian
 * @notice Governance-controlled oracle integration layer for AV Treasury
 *
 * Sits between AvOracle and consumer contracts (TreasuryAMO, PIDController, FlashBuy).
 * Since core contracts are non-upgradeable, this guardian provides oracle
 * services through a governance-controlled adapter.
 *
 * Key Functions:
 *   - getAuPrice() / getValidatedAuPrice() — read oracle prices
 *   - validateTwapPrice() — circuit breaker for TreasuryAMO
 *   - isAuBelowPeg() — trigger for FlashBuy
 *   - calculateAuTVL() — USD-denominated TVL for PID controller
 *
 * Governance: All parameter changes go through DEFAULT_ADMIN_ROLE (Timelock)
 * Emergency: GUARDIAN_ROLE can pause oracle without governance delay
 */
contract OracleGuardian is AccessControl, Pausable {
    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // =========================================================================
    //                            STATE VARIABLES
    // =========================================================================

    /// @notice The oracle contract (AvOracle)
    address public oracle;

    /// @notice Au token address
    address public auToken;

    /// @notice USDC token address
    address public usdcToken;

    /// @notice TreasuryAMO contract address
    address public treasuryAMO;

    /// @notice PID controller address
    address public pidController;

    /// @notice FlashBuy contract address
    address public flashBuy;

    /// @notice Max deviation between TWAP and oracle (basis points, 10000 = 100%)
    uint256 public maxDeviationBps;

    /// @notice Oracle price staleness threshold in seconds
    uint256 public staleThreshold;

    /// @notice Max price change per recording (basis points)
    uint256 public maxPriceChangeBps;

    /// @notice Deviation threshold to trigger FlashBuy (basis points below peg)
    uint256 public buybackTriggerBps;

    /// @notice Au peg price (18 decimals, e.g., 1e18 = $1.00)
    uint256 public auPeg;

    /// @notice Whether oracle integration is active
    bool public oracleActive;

    /// @notice Last recorded Au price (for change tracking)
    uint256 public lastRecordedPrice;

    /// @notice Timestamp of last price update
    uint256 public lastPriceTimestamp;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event MaxDeviationUpdated(uint256 oldBps, uint256 newBps);
    event StaleThresholdUpdated(uint256 oldSeconds, uint256 newSeconds);
    event MaxPriceChangeUpdated(uint256 oldBps, uint256 newBps);
    event OracleActiveToggled(bool active);
    event PriceRecorded(address indexed token, uint256 price, uint256 timestamp);
    event DeviationExceeded(uint256 twapPrice, uint256 oraclePrice, uint256 deviationBps);
    event TreasuryAMOUpdated(address indexed newAMO);
    event PIDControllerUpdated(address indexed newPID);
    event FlashBuyUpdated(address indexed newFlashBuy);
    event BuybackTriggerUpdated(uint256 oldBps, uint256 newBps);
    event AuPegUpdated(uint256 oldPeg, uint256 newPeg);

    // =========================================================================
    //                              ERRORS
    // =========================================================================

    error InvalidAddress();
    error InvalidBps();
    error OracleStale();
    error PriceChangeTooHigh();

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    /**
     * @notice Deploy OracleGuardian
     * @param _oracle Address of AvOracle
     * @param _auToken Address of Au token
     * @param _usdcToken Address of USDC token
     * @param _admin Admin address (Timelock/Governance)
     */
    constructor(
        address _oracle,
        address _auToken,
        address _usdcToken,
        address _treasuryAMO,
        address _admin,
        uint256 _auPeg,
        uint256 _buybackTriggerBps
    ) {
        require(_oracle != address(0), "OG: zero oracle");
        require(_auToken != address(0), "OG: zero auToken");
        require(_usdcToken != address(0), "OG: zero usdcToken");
        require(_admin != address(0), "OG: zero admin");
        require(_auPeg > 0, "OG: zero auPeg");
        require(_buybackTriggerBps > 0 && _buybackTriggerBps <= 5000, "OG: invalid triggerBps");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PARAM_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);

        oracle = _oracle;
        auToken = _auToken;
        usdcToken = _usdcToken;
        treasuryAMO = _treasuryAMO;

        maxDeviationBps = 500;       // 5%
        staleThreshold = 3600;       // 1 hour
        maxPriceChangeBps = 1000;    // 10%
        auPeg = _auPeg;
        buybackTriggerBps = _buybackTriggerBps;
        oracleActive = true;
    }

    // =========================================================================
    //                         PRICE QUERY FUNCTIONS
    // =========================================================================

    /**
     * @notice Get Au price from oracle
     * @return price Au price (18 decimals)
     */
    function getAuPrice() public view returns (uint256) {
        return _queryOracle(auToken);
    }

    /**
     * @notice Get Au price with validation (reverts if oracle returns 0)
     * @return price Validated Au price
     */
    function getValidatedAuPrice() external view returns (uint256 price) {
        price = getAuPrice();
        if (price == 0) revert OracleStale();
        return price;
    }

    /**
     * @notice Get USDC price from oracle
     * @return price USDC price (18 decimals)
     */
    function getUsdcPrice() public view returns (uint256) {
        return _queryOracle(usdcToken);
    }

    /**
     * @notice Calculate USD-denominated Au TVL for PID controller
     * @param totalAu Total Au tokens in staking contract
     * @return tvl USD TVL (18 decimals)
     */
    function calculateAuTVL(uint256 totalAu) external view returns (uint256 tvl) {
        uint256 auPrice = getAuPrice();
        if (auPrice == 0) revert OracleStale();
        tvl = (totalAu * auPrice) / 1e18;
    }

    /**
     * @notice Check if Au is below peg (used by FlashBuy)
     * @param thresholdBps Below-peg threshold in basis points
     * @return belowPeg True if Au market price < $1 - threshold
     * @return currentPrice Current Au price
     */
    function isAuBelowPeg(uint256 thresholdBps) external view returns (bool belowPeg, uint256 currentPrice) {
        currentPrice = getAuPrice();
        uint256 pegValue = 1e18; // $1.00
        uint256 threshold = (pegValue * thresholdBps) / 10000;
        belowPeg = currentPrice < (pegValue - threshold);
    }

    // =========================================================================
    //                      TREASURY AMO INTEGRATION
    // =========================================================================

    /**
     * @notice Validate TWAP price against oracle (circuit breaker)
     * @param twapPrice The internal TWAP price from TreasuryAMO
     * @return valid True if deviation is within acceptable range
     * @return deviationBps The actual deviation in basis points
     */
    function validateTwapPrice(uint256 twapPrice) external view returns (bool valid, uint256 deviationBps) {
        if (!oracleActive) {
            return (true, 0);
        }

        uint256 oraclePrice = getAuPrice();
        if (oraclePrice == 0) {
            return (true, 0);
        }

        deviationBps = _calcDeviation(twapPrice, oraclePrice);
        valid = deviationBps <= maxDeviationBps;
    }

    /**
     * @notice Record price for change tracking
     * @dev Callable by anyone. Reverts if price change exceeds max.
     */
    function recordPrice() external whenNotPaused {
        uint256 price = getAuPrice();
        if (price == 0) revert OracleStale();

        if (lastRecordedPrice > 0) {
            uint256 change = _calcDeviation(price, lastRecordedPrice);
            if (change > maxPriceChangeBps) {
                revert PriceChangeTooHigh();
            }
        }

        lastRecordedPrice = price;
        lastPriceTimestamp = block.timestamp;
        emit PriceRecorded(auToken, price, block.timestamp);
    }

    // =========================================================================
    //                         GOVERNANCE FUNCTIONS
    // =========================================================================

    /**
     * @notice Set oracle address
     */
    function setOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_oracle != address(0), "OG: zero oracle");
        emit OracleUpdated(oracle, _oracle);
        oracle = _oracle;
    }

    /**
     * @notice Set Au token address
     */
    function setAuToken(address _auToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_auToken != address(0), "OG: zero auToken");
        auToken = _auToken;
    }

    /**
     * @notice Set USDC token address
     */
    function setUsdcToken(address _usdcToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_usdcToken != address(0), "OG: zero usdcToken");
        usdcToken = _usdcToken;
    }

    /**
     * @notice Set TreasuryAMO address
     */
    function setTreasuryAMO(address _treasuryAMO) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit TreasuryAMOUpdated(_treasuryAMO);
        treasuryAMO = _treasuryAMO;
    }

    /**
     * @notice Set PID controller address
     */
    function setPidController(address _pidController) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit PIDControllerUpdated(_pidController);
        pidController = _pidController;
    }

    /**
     * @notice Set FlashBuy address
     */
    function setFlashBuy(address _flashBuy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit FlashBuyUpdated(_flashBuy);
        flashBuy = _flashBuy;
    }

    /**
     * @notice Set max deviation threshold
     * @param _maxDeviationBps Max deviation in basis points
     */
    function setMaxDeviation(uint256 _maxDeviationBps) external onlyRole(PARAM_ROLE) {
        require(_maxDeviationBps > 0 && _maxDeviationBps <= 5000, "OG: invalid bps");
        emit MaxDeviationUpdated(maxDeviationBps, _maxDeviationBps);
        maxDeviationBps = _maxDeviationBps;
    }

    /**
     * @notice Set staleness threshold
     */
    function setStaleThreshold(uint256 _staleThreshold) external onlyRole(PARAM_ROLE) {
        emit StaleThresholdUpdated(staleThreshold, _staleThreshold);
        staleThreshold = _staleThreshold;
    }

    /**
     * @notice Set max price change threshold
     */
    function setMaxPriceChange(uint256 _maxPriceChangeBps) external onlyRole(PARAM_ROLE) {
        require(_maxPriceChangeBps > 0 && _maxPriceChangeBps <= 5000, "OG: invalid bps");
        emit MaxPriceChangeUpdated(maxPriceChangeBps, _maxPriceChangeBps);
        maxPriceChangeBps = _maxPriceChangeBps;
    }

    /**
     * @notice Set FlashBuy trigger threshold (basis points below peg)
     * @param _buybackTriggerBps Threshold in bps (e.g., 500 = 5% below peg)
     */
    function setBuybackTriggerBps(uint256 _buybackTriggerBps) external onlyRole(PARAM_ROLE) {
        require(_buybackTriggerBps > 0 && _buybackTriggerBps <= 5000, "OG: invalid bps");
        emit BuybackTriggerUpdated(buybackTriggerBps, _buybackTriggerBps);
        buybackTriggerBps = _buybackTriggerBps;
    }

    /**
     * @notice Set Au peg price for FlashBuy calculations
     * @param _auPeg Peg price in 18 decimals (e.g., 1e18 = $1.00)
     */
    function setAuPeg(uint256 _auPeg) external onlyRole(PARAM_ROLE) {
        require(_auPeg > 0, "OG: invalid peg");
        emit AuPegUpdated(auPeg, _auPeg);
        auPeg = _auPeg;
    }

    /**
     * @notice Toggle oracle integration on/off
     */
    function setOracleActive(bool _active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracleActive = _active;
        emit OracleActiveToggled(_active);
    }

    /**
     * @notice Emergency pause oracle integration
     */
    function setEmergencyPause(bool _paused) external onlyRole(GUARDIAN_ROLE) {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
     * @notice Grant PARAM_ROLE to an address
     */
    function grantParamRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(PARAM_ROLE, account);
    }

    /**
     * @notice Grant GUARDIAN_ROLE to an address
     */
    function grantGuardianRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(GUARDIAN_ROLE, account);
    }

    // =========================================================================
    //                    FLASHBUY INTERFACE FUNCTIONS
    // =========================================================================

    /**
     * @notice Check if FlashBuy trigger condition is met
     * @dev Called by TreasuryFlashBuy_v2 via staticcall
     * @param trigger Whether buyback should be triggered
     * @param oraclePrice Oracle-reported Au price (18 decimals)
     * @param twapPrice TWAP price (18 decimals)
     */
    function checkFlashBuyTrigger()
        external
        view
        returns (bool trigger, uint256 oraclePrice, uint256 twapPrice)
    {
        // Get oracle price for Au (aggregates TWAP + oracle sources)
        (oraclePrice, ) = AvOracle(oracle).getPrice(auToken);

        // Use AMO's TWAP if available, else fall back to oracle price
        if (address(treasuryAMO) != address(0)) {
            twapPrice = TreasuryAMO(treasuryAMO).twapPrice();
        } else {
            twapPrice = oraclePrice;
        }

        // Trigger if Au price is below peg threshold
        uint256 pegThreshold = (auPeg * (10000 - buybackTriggerBps)) / 10000;
        trigger = oraclePrice < pegThreshold && oraclePrice > 0;
    }

    /**
     * @notice Get Au price specifically for FlashBuy operations
     * @dev Called by TreasuryFlashBuy_v2 via staticcall
     * @return price Au price in USD (18 decimals)
     * @return source Price source identifier (0=none, 1=TWAP, 2=oracle, 3=both)
     */
    function getAuPriceForFlashBuy()
        external
        view
        returns (uint256 price, uint8 source)
    {
        try AvOracle(oracle).getPrice(auToken) returns (uint256 _price, AvOracle.PriceSource _source) {
            price = _price;
            source = uint8(_source);
        } catch {
            price = 0;
            source = 0;
        }
    }

    // =========================================================================
    //                         INTERNAL FUNCTIONS
    // =========================================================================

    /**
     * @notice Query the oracle for a token's price
     * @param token Token address
     * @return price Token price (18 decimals)
     */
    function _queryOracle(address token) private view returns (uint256) {
        (bool success, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("getPrice(address)", token)
        );
        if (!success) return 0;
        return abi.decode(data, (uint256));
    }

    /**
     * @notice Calculate deviation between two prices in basis points
     * @param priceA First price
     * @param priceB Second price
     * @return deviationBps Deviation in basis points (100 = 1%)
     */
    function _calcDeviation(uint256 priceA, uint256 priceB) private pure returns (uint256) {
        if (priceA == 0 || priceB == 0) return 0;

        uint256 larger = priceA > priceB ? priceA : priceB;
        uint256 smaller = priceA > priceB ? priceB : priceA;
        uint256 diff = larger - smaller;

        return (diff * 10000) / larger;
    }
}
