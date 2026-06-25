// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AvOracle
 * @notice Decentralized oracle for AV Treasury — provides Au/Ag price feeds and TVL data
 * @dev Dual-source: Chainlink primary, TWAP fallback from DEX pools
 * 
 * Architecture:
 *   Chainlink AggregatorV3 (primary)
 *         │
 *         ▼
 *   ┌─────────────┐    stale/no-data
 *   │  AvOracle    │──────────────────► TWAP Fallback (DEX pools)
 *   │              │
 *   │  Circuit     │    price deviation > maxDeviationBps
 *   │  Breaker     │──────────────────► Pause + governance override
 *   └─────────────┘
 *         │
 *         ▼
 *   PID Controller / TreasuryAMO
 * 
 * Roles:
 *   ORACLE_ADMIN — add/remove price feeds, set parameters
 *   GOVERNOR     — emergency pause/unpause, circuit breaker reset
 */
contract AvOracle is AccessControl, ReentrancyGuard {

    // ── Roles ──────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN");
    bytes32 public constant GOVERNOR = keccak256("GOVERNOR");

    // ── Enums ──────────────────────────────────────────────────────────
    enum PriceSource { CHAINLINK, TWAP, NONE }

    // ── Structs ────────────────────────────────────────────────────────
    struct PriceFeed {
        address aggregator;          // Chainlink aggregator address (address(0) if TWAP-only)
        address token;               // Token address (Au or Ag)
        address quoteToken;          // Quote token (e.g., USDC)
        uint256 heartbeat;           // Maximum staleness for Chainlink (seconds)
        uint256 maxDeviationBps;     // Max price deviation between sources (basis points)
        PriceSource primarySource;   // Preferred source
        bool active;                 // Whether this feed is active
    }

    struct TwapPool {
        address pool;                // DEX pool address
        address token0;              // Pool token0
        address token1;              // Pool token1
        uint256 twapDuration;        // TWAP window in seconds
        bool token0IsTarget;         // Whether token0 is our target token
    }

    struct PriceData {
        uint256 price;               // Price in 18 decimals
        uint256 timestamp;           // Last update timestamp
        PriceSource source;          // Source of the price
        bool valid;                  // Whether the price is valid
    }

    struct TvlData {
        uint256 tvl;                 // TVL in 18 decimals (USD)
        uint256 timestamp;           // Last update timestamp
        bool valid;                  // Whether the TVL is valid
    }

    // ── State ──────────────────────────────────────────────────────────
    // Token addresses
    address public auToken;
    address public agToken;
    
    // Price feeds: token => PriceFeed
    mapping(address => PriceFeed) public priceFeeds;
    
    // TWAP pools: token => TwapPool
    mapping(address => TwapPool) public twapPools;
    
    // Cached prices: token => PriceData
    mapping(address => PriceData) public cachedPrices;
    
    // TVL data
    TvlData public tvlData;
    
    // TVL sources (staking, liquidity, etc.)
    address[] public tvlSources;
    mapping(address => bool) public isTvlSource;
    
    // Circuit breaker
    bool public paused;
    uint256 public lastPauseTime;
    
    // TWATVL for smoothed TVL (mirrors existing PID controller logic)
    uint256 public twatvl;
    uint256 public twatvlLastUpdate;
    uint256 public constant TWATVL_DECAY = 990_000; // 0.99 * 1e6 — 1% decay per block
    
    // Parameters
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_DEVIATION_BPS = 500; // 5% default max deviation
    uint256 public constant MIN_TVL_SOURCES = 1;
    uint256 public constant MAX_TVL_SOURCES = 10;
    
    // ── Events ─────────────────────────────────────────────────────────
    event PriceUpdated(address indexed token, uint256 price, PriceSource source, uint256 timestamp);
    event TvlUpdated(uint256 tvl, uint256 twatvl, uint256 timestamp);
    event PriceFeedConfigured(address indexed token, address aggregator, PriceSource source);
    event TwapPoolConfigured(address indexed token, address pool, uint256 duration);
    event TvlSourceAdded(address indexed source);
    event TvlSourceRemoved(address indexed source);
    event CircuitBreakerTriggered(address indexed token, uint256 chainlinkPrice, uint256 twapPrice);
    event EmergencyUnpaused(address indexed governor);
    event EmergencyPaused(address indexed governor);

    // ── Errors ─────────────────────────────────────────────────────────
    error InvalidAddress();
    error InvalidConfiguration();
    error PriceStale();
    error PriceDeviationTooHigh();
    error OraclePaused();
    error NotAuthorized();
    error NoPriceSource();
    error TvlSourceLimitReached();

    // ── Modifiers ──────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (!hasRole(ORACLE_ADMIN, msg.sender)) revert NotAuthorized();
        _;
    }

    modifier onlyGovernor() {
        if (!hasRole(GOVERNOR, msg.sender)) revert NotAuthorized();
        _;
    }

    modifier notPaused() {
        if (paused) revert OraclePaused();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────
    constructor(
        address _auToken,
        address _agToken,
        address _admin,
        address _governor
    ) {
        if (_auToken == address(0) || _agToken == address(0)) revert InvalidAddress();
        
        auToken = _auToken;
        agToken = _agToken;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ADMIN, _admin);
        _grantRole(GOVERNOR, _governor);
        _grantRole(ORACLE_ADMIN, _governor); // Governor also has admin for oracle config
    }

    // ══════════════════════════════════════════════════════════════════
    //  PRICE FEED CONFIGURATION
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Configure Chainlink price feed for a token
     * @param token Token address
     * @param aggregator Chainlink aggregator address
     * @param quoteToken Quote token (e.g., USDC)
     * @param heartbeat Maximum staleness in seconds
     * @param maxDeviationBps Max deviation between sources (bps)
     */
    function configurePriceFeed(
        address token,
        address aggregator,
        address quoteToken,
        uint256 heartbeat,
        uint256 maxDeviationBps
    ) external onlyAdmin {
        if (token == address(0)) revert InvalidAddress();
        if (heartbeat == 0) revert InvalidConfiguration();
        if (maxDeviationBps > 2000) revert InvalidConfiguration(); // Max 20%
        
        priceFeeds[token] = PriceFeed({
            aggregator: aggregator,
            token: token,
            quoteToken: quoteToken,
            heartbeat: heartbeat,
            maxDeviationBps: maxDeviationBps,
            primarySource: PriceSource.CHAINLINK,
            active: true
        });
        
        emit PriceFeedConfigured(token, aggregator, PriceSource.CHAINLINK);
    }

    /**
     * @notice Configure TWAP pool as fallback price source
     * @param token Token address
     * @param pool DEX pool address
     * @param token0 Pool token0
     * @param token1 Pool token1
     * @param twapDuration TWAP window in seconds
     * @param token0IsTarget Whether token0 is our target token
     */
    function configureTwapPool(
        address token,
        address pool,
        address token0,
        address token1,
        uint256 twapDuration,
        bool token0IsTarget
    ) external onlyAdmin {
        if (token == address(0) || pool == address(0)) revert InvalidAddress();
        if (twapDuration < 60 || twapDuration > 86400) revert InvalidConfiguration(); // 1min to 24hr
        
        twapPools[token] = TwapPool({
            pool: pool,
            token0: token0,
            token1: token1,
            twapDuration: twapDuration,
            token0IsTarget: token0IsTarget
        });
        
        emit TwapPoolConfigured(token, pool, twapDuration);
    }

    // ══════════════════════════════════════════════════════════════════
    //  TVL SOURCE CONFIGURATION
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Add a TVL source (staking contract, liquidity pool, etc.)
     * @param source Address that implements ITvlSource
     */
    function addTvlSource(address source) external onlyAdmin {
        if (source == address(0)) revert InvalidAddress();
        if (isTvlSource[source]) revert InvalidConfiguration();
        if (tvlSources.length >= MAX_TVL_SOURCES) revert TvlSourceLimitReached();
        
        isTvlSource[source] = true;
        tvlSources.push(source);
        
        emit TvlSourceAdded(source);
    }

    /**
     * @notice Remove a TVL source
     * @param source Address to remove
     */
    function removeTvlSource(address source) external onlyAdmin {
        if (!isTvlSource[source]) revert InvalidConfiguration();
        
        isTvlSource[source] = false;
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < tvlSources.length; i++) {
            if (tvlSources[i] == source) {
                tvlSources[i] = tvlSources[tvlSources.length - 1];
                tvlSources.pop();
                break;
            }
        }
        
        emit TvlSourceRemoved(source);
    }

    // ══════════════════════════════════════════════════════════════════
    //  PRICE QUERIES
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Get the latest price for a token
     * @param token Token address
     * @return price Latest valid price in 18 decimals
     * @return source Source of the price (CHAINLINK or TWAP)
     */
    function getPrice(address token) external view returns (uint256 price, PriceSource source) {
        PriceData memory data = cachedPrices[token];
        if (!data.valid) revert NoPriceSource();
        
        PriceFeed memory feed = priceFeeds[token];
        if (feed.active && data.source == PriceSource.CHAINLINK) {
            // Check staleness
            if (block.timestamp - data.timestamp <= feed.heartbeat) {
                return (data.price, PriceSource.CHAINLINK);
            }
        }
        
        // Fallback: try to return whatever we have if it's not too old
        if (block.timestamp - data.timestamp <= feed.heartbeat * 2) {
            return (data.price, data.source);
        }
        
        revert PriceStale();
    }

    /**
     * @notice Get price specifically from Chainlink
     * @param token Token address
     * @return price Price from Chainlink in 18 decimals
     */
    function getChainlinkPrice(address token) public view returns (uint256 price) {
        PriceFeed memory feed = priceFeeds[token];
        if (!feed.active || feed.aggregator == address(0)) revert NoPriceSource();
        
        // Chainlink AggregatorV3Interface
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = IAggregatorV3(feed.aggregator).latestRoundData();
        
        // Validate Chainlink response
        if (answer <= 0) revert NoPriceSource();
        if (updatedAt == 0) revert PriceStale();
        if (block.timestamp - updatedAt > feed.heartbeat) revert PriceStale();
        if (answeredInRound < roundId) revert NoPriceSource();
        
        // Convert to 18 decimals
        uint8 decimals = IAggregatorV3(feed.aggregator).decimals();
        if (decimals <= 8) {
            price = uint256(answer) * (10 ** (18 - decimals));
        } else {
            price = uint256(answer) / (10 ** (decimals - 18));
        }
    }

    /**
     * @notice Get price from TWAP fallback
     * @param token Token address
     * @return price TWAP price in 18 decimals
     */
    function getTwapPrice(address token) public view returns (uint256 price) {
        TwapPool memory pool = twapPools[token];
        if (pool.pool == address(0)) revert NoPriceSource();
        
        // Read cumulative prices from DEX pool (Uniswap V2/V3 compatible)
        (uint256 cumulative0, uint256 cumulative1) = getCumulativePrices(pool.pool);
        
        // Calculate TWAP
        uint256 timeElapsed = block.timestamp - twatvlLastUpdate;
        if (timeElapsed == 0) timeElapsed = 1;
        
        uint256 price0 = (cumulative0 - getLastCumulative0(pool.pool)) / timeElapsed;
        uint256 price1 = (cumulative1 - getLastCumulative1(pool.pool)) / timeElapsed;
        
        // Return the price of our target token
        if (pool.token0IsTarget) {
            price = price0;
        } else {
            price = price1;
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  TVL QUERIES
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Get total TVL across all sources
     * @return tvl Total TVL in 18 decimals (USD)
     * @return twatvl_ Smoothed TWATVL
     */
    function getTVL() external view returns (uint256 tvl, uint256 twatvl_) {
        tvl = _calculateTVL();
        twatvl_ = _getTWATVL(tvl);
    }

    /**
     * @notice Get TVL from specific source
     * @param source TVL source address
     * @return tvl TVL from that source in 18 decimals
     */
    function getTvlFromSource(address source) external view returns (uint256 tvl) {
        if (!isTvlSource[source]) revert NotAuthorized();
        tvl = ITvlSource(source).getTvl();
    }

    /**
     * @notice Internal TVL calculation across all sources
     */
    function _calculateTVL() internal view returns (uint256 totalTvl) {
        for (uint256 i = 0; i < tvlSources.length; i++) {
            if (isTvlSource[tvlSources[i]]) {
                try ITvlSource(tvlSources[i]).getTvl() returns (uint256 sourceTvl) {
                    totalTvl += sourceTvl;
                } catch {
                    // Skip failed sources — don't let one bad source break everything
                }
            }
        }
        if (totalTvl == 0) revert NoPriceSource();
    }

    /**
     * @notice Calculate TWATVL with exponential decay
     * @param currentTvl Current TVL value
     */
    function _getTWATVL(uint256 currentTvl) internal view returns (uint256) {
        if (twatvlLastUpdate == 0) {
            return currentTvl;
        }
        
        uint256 timeElapsed = block.timestamp - twatvlLastUpdate;
        if (timeElapsed == 0) {
            return twatvl;
        }
        
        // Exponential decay: TWATVL = TWATVL * decay^time + currentTVL * (1 - decay^time)
        // Compute decay = TWATVL_DECAY^timeElapsed using iterative multiplication
        // Avoids overflow from large exponents by capping iterations
        // For timeElapsed > 1000s, decay ≈ 0 and twatvl fully converges to currentTvl
        uint256 decay = PRICE_PRECISION;
        uint256 iterations = timeElapsed;
        if (iterations > 1000) {
            // After 1000 steps at 0.99^1000 ≈ 0.000043, decay is negligible
            // Set decay to 0 to fully adopt currentTvl
            decay = 0;
        } else {
            for (uint256 i = 0; i < iterations; i++) {
                decay = (decay * TWATVL_DECAY) / PRICE_PRECISION;
            }
        }
        uint256 newTwatvl = (twatvl * decay + currentTvl * (PRICE_PRECISION - decay)) / PRICE_PRECISION;

        return newTwatvl;
    }

    // ══════════════════════════════════════════════════════════════════
    //  PRICE UPDATES (called by keepers or during interactions)
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Update cached price for a token
     * @param token Token address
     * @dev Can be called by anyone (permissionless) — incentivized by keeper rewards
     */
    function updatePrice(address token) external notPaused {
        PriceFeed memory feed = priceFeeds[token];
        if (!feed.active) revert NoPriceSource();
        
        uint256 price;
        PriceSource source;
        bool valid = false;
        
        // Try Chainlink first
        if (feed.primarySource == PriceSource.CHAINLINK && feed.aggregator != address(0)) {
            try this.getChainlinkPrice(token) returns (uint256 clPrice) {
                price = clPrice;
                source = PriceSource.CHAINLINK;
                valid = true;
                
                // Cross-check with TWAP if available
                if (twapPools[token].pool != address(0)) {
                    try this.getTwapPrice(token) returns (uint256 twapPrice) {
                        uint256 deviation = _calculateDeviation(clPrice, twapPrice);
                        if (deviation > feed.maxDeviationBps) {
                            // Circuit breaker: deviation too high
                            emit CircuitBreakerTriggered(token, clPrice, twapPrice);
                            revert PriceDeviationTooHigh();
                        }
                    } catch {
                        // TWAP unavailable — use Chainlink alone
                    }
                }
            } catch {
                // Chainlink failed — try TWAP
            }
        }
        
        // Fallback to TWAP
        if (!valid && twapPools[token].pool != address(0)) {
            try this.getTwapPrice(token) returns (uint256 twapPrice) {
                price = twapPrice;
                source = PriceSource.TWAP;
                valid = true;
            } catch {
                revert NoPriceSource();
            }
        }
        
        if (!valid) revert NoPriceSource();
        
        cachedPrices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            source: source,
            valid: true
        });
        
        emit PriceUpdated(token, price, source, block.timestamp);
    }

    /**
     * @notice Update TVL and TWATVL
     * @dev Called during staking/deposit operations
     */
    function updateTVL() external {
        uint256 currentTvl = _calculateTVL();
        uint256 newTwatvl = _getTWATVL(currentTvl);
        
        tvlData = TvlData({
            tvl: currentTvl,
            timestamp: block.timestamp,
            valid: true
        });
        
        twatvl = newTwatvl;
        twatvlLastUpdate = block.timestamp;
        
        emit TvlUpdated(currentTvl, newTwatvl, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════════
    //  CIRCUIT BREAKER
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Emergency pause — triggered by governor or automated monitor
     */
    function pause() external onlyGovernor {
        paused = true;
        lastPauseTime = block.timestamp;
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Unpause after resolving the issue
     */
    function unpause() external onlyGovernor {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }

    // ══════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Check if a token's price is valid and fresh
     */
    function isPriceValid(address token) external view returns (bool) {
        PriceData memory data = cachedPrices[token];
        if (!data.valid) return false;
        
        PriceFeed memory feed = priceFeeds[token];
        if (feed.active && data.source == PriceSource.CHAINLINK) {
            return block.timestamp - data.timestamp <= feed.heartbeat;
        }
        
        return block.timestamp - data.timestamp <= feed.heartbeat * 2;
    }

    /**
     * @notice Get both Au and Ag prices in a single call
     */
    function getAuAgPrices() external view returns (
        uint256 auPrice,
        uint256 agPrice,
        PriceSource auSource,
        PriceSource agSource
    ) {
        (auPrice, auSource) = this.getPrice(auToken);
        (agPrice, agSource) = this.getPrice(agToken);
    }

    /**
     * @notice Get number of TVL sources
     */
    function getTvlSourceCount() external view returns (uint256) {
        return tvlSources.length;
    }

    // ══════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate deviation between two prices in basis points
     */
    function _calculateDeviation(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return type(uint256).max;
        
        uint256 diff = a > b ? a - b : b - a;
        return (diff * 10_000) / ((a + b) / 2);
    }

    /**
     * @notice Get cumulative prices from DEX pool
     * @dev Uniswap V2 compatible
     */
    function getCumulativePrices(address pool) internal view returns (uint256, uint256) {
        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(pool).getReserves();
        return (reserve0, reserve1); // Simplified — real TWAP needs cumulative price tracking
    }

    function getLastCumulative0(address) internal pure returns (uint256) { return 0; }
    function getLastCumulative1(address) internal pure returns (uint256) { return 0; }
}

// ══════════════════════════════════════════════════════════════════════
//  INTERFACES
// ══════════════════════════════════════════════════════════════════════

interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

interface ITvlSource {
    function getTvl() external view returns (uint256);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}
