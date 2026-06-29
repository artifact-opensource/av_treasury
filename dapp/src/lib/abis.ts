import { parseAbi } from 'viem'

// AV Treasury Contract ABIs — extracted from Solidity source

// ─── AuToken (Artifact Utility) ──────────────────────────────────
export const AU_TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function transferFeeBps() view returns (uint256)',
  'function maxTxAmountBps() view returns (uint256)',
  'function maxWalletAmountBps() view returns (uint256)',
  'function sellCooldown() view returns (uint256)',
  'function treasury() view returns (address)',
  'function accumulatedFees() view returns (uint256)',
  'function feesEnabled() view returns (bool)',
  'function isBlocked(address) view returns (bool)',
  'function flashFee(address token, uint256 amount) view returns (uint256)',
  'function maxFlashLoan(address token) view returns (uint256)',
  'function burn(uint256 amount)',
  'function pause()',
  'function unpause()',
  'function paused() view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// ─── AgToken (Artifact Governance) ────────────────────────────────
export const AG_TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function delegates(address) view returns (address)',
  'function delegate(address)',
  'function getVotes(address) view returns (uint256)',
  'function getPastVotes(address, uint256) view returns (uint256)',
  'function nonces(address) view returns (uint256)',
  'function permit(address, address, uint256, uint256, uint8, bytes32, bytes32)',
  'function paused() view returns (bool)',
  'event Mint(address indexed to, uint256 amount)',
  'event Burn(address indexed from, uint256 amount)',
])

// ─── AvOracle ─────────────────────────────────────────────────────
export const AV_ORACLE_ABI = parseAbi([
  'function auToken() view returns (address)',
  'function agToken() view returns (address)',
  'function getPrice(address token) view returns (uint256 price, uint8 source)',
  'function getTvl() view returns (uint256 tvl, uint256 twatvl, uint256 timestamp, bool valid)',
  'function priceFeeds(address) view returns (address aggregator, address token, address quoteToken, uint256 heartbeat, uint256 maxDeviationBps, uint8 primarySource, bool active)',
  'function twapPools(address) view returns (address pool, address token0, address token1, uint256 twapDuration, bool token0IsTarget)',
  'function cachedPrices(address) view returns (uint256 price, uint256 timestamp, uint8 source, bool valid)',
  'function paused() view returns (bool)',
  'function twatvl() view returns (uint256)',
  'function tvlData() view returns (uint256 tvl, uint256 timestamp, bool valid)',
  'event PriceUpdated(address indexed token, uint256 price, uint8 source, uint256 timestamp)',
  'event TvlUpdated(uint256 tvl, uint256 twatvl, uint256 timestamp)',
  'event CircuitBreakerTriggered(address indexed token, uint256 chainlinkPrice, uint256 twapPrice)',
])

// ─── PID Emission Controller v2 ───────────────────────────────────
export const PID_CONTROLLER_ABI = parseAbi([
  'function kp() view returns (uint256)',
  'function ki() view returns (uint256)',
  'function kd() view returns (uint256)',
  'function targetTVL() view returns (uint256)',
  'function dailyEmissionCap() view returns (uint256)',
  'function perEmissionCap() view returns (uint256)',
  'function emittedToday() view returns (uint256)',
  'function lastEmissionTimestamp() view returns (uint256)',
  'function totalEmissions() view returns (uint256)',
  'function executeEmission() returns (uint256)',
  'function scheduleGainsChange(uint256 _kp, uint256 _ki, uint256 _kd)',
  'function executeGainsChange()',
  'function pendingKp() view returns (uint256)',
  'function pendingKi() view returns (uint256)',
  'function pendingKd() view returns (uint256)',
  'function gainsChangeTimestamp() view returns (uint256)',
  'function emergencyStop() view returns (bool)',
  'function triggerEmergencyStop()',
  'function resumeFromEmergency()',
  'function paused() view returns (bool)',
  'function agToken() view returns (address)',
  'function staking() view returns (address)',
])

// ─── TreasuryAMO ──────────────────────────────────────────────────
export const TREASURY_AMO_ABI = parseAbi([
  'function executeBuyback() returns (uint256 auBought, uint256 reserveUsed)',
  'function computeBuybackSize() view returns (uint256)',
  'function reserveBalance() view returns (uint256)',
  'function auBalance() view returns (uint256)',
  'function totalBuybacks() view returns (uint256)',
  'function totalAuBought() view returns (uint256)',
  'function totalReserveUsed() view returns (uint256)',
  'function lastBuybackTimestamp() view returns (uint256)',
  'function buybackCooldown() view returns (uint256)',
  'function auToken() view returns (address)',
  'function reserveToken() view returns (address)',
  'function treasury() view returns (address)',
  'function oracle() view returns (address)',
  'function dexRouter() view returns (address)',
  'function AMO_BUYBACK_PCT() view returns (uint256)',
  'function AMO_RESERVE_RUNWAY_MONTHS() view returns (uint256)',
  'function paused() view returns (bool)',
  'event BuybackExecuted(uint256 auBought, uint256 reserveUsed, uint256 timestamp)',
])

// ─── AVLPStaking v2 ──────────────────────────────────────────────
export const STAKING_ABI = parseAbi([
  'function stake(uint256 tokenId)',
  'function unstake(uint256 tokenId)',
  'function claimRewards(uint256[] tokenIds)',
  'function pendingAu(uint256 tokenId) view returns (uint256)',
  'function pendingAg(uint256 tokenId) view returns (uint256)',
  'function auRewardPerBlock() view returns (uint256)',
  'function agRewardPerBlock() view returns (uint256)',
  'function totalWeights() view returns (uint256)',
  'function totalStakedNFTs() view returns (uint256)',
  'function agThreshold() view returns (uint256)',
  'function getAgMultiplier(address staker) view returns (uint256)',
  'function _stakedWeights(uint256) view returns (uint256)',
  'function _stakeOwner(uint256) view returns (address)',
  'function _ownerStakes(address) view returns (uint256[])',
  'function _stakedAt(uint256) view returns (uint256)',
  'function minStakeDuration() view returns (uint256)',
  'function auToken() view returns (address)',
  'function agToken() view returns (address)',
  'function lpNFT() view returns (address)',
  'function paused() view returns (bool)',
  'event Staked(address indexed user, uint256 indexed tokenId, uint256 weight)',
  'event Unstaked(address indexed user, uint256 indexed tokenId)',
  'event RewardsClaimed(address indexed user, uint256 auAmount, uint256 agAmount)',
])

// ─── GovernorContract ─────────────────────────────────────────────
export const GOVERNOR_ABI = parseAbi([
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)',
  'function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash)',
  'function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalThreshold() view returns (uint256)',
  'function votingDelay() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function quorum(uint256 blockNumber) view returns (uint256)',
  'function getVotes(address account, uint256 blockNumber) view returns (uint256)',
  'function proposalCount() view returns (uint256)',
  'function proposalDescriptions(uint256) view returns (string)',
  'function executorAddress() view returns (address)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
])

// ─── Aerodrome Router ─────────────────────────────────────────────
export const AERODROME_ROUTER_ABI = parseAbi([
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[])',
  'function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, bool stable, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)',
  'function quoteAddLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired) view returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function quoteRemoveLiquidity(address tokenA, address tokenB, bool stable, uint256 liquidity) view returns (uint256 amountA, uint256 amountB)',
])

// ─── Aerodrome Pool (Uniswap V2 compatible pair) ─────────────────
export const AERODROME_POOL_ABI = parseAbi([
  'function getReserves() view returns (uint256, uint256, uint256)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function stable() view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function transfer(address, uint256) returns (bool)',
  'function skim(address)',
  'function sync()',
])

// ─── Aerodrome Gauge ──────────────────────────────────────────────
export const AERODROME_GAUGE_ABI = parseAbi([
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function getReward()',
  'function earned(address account) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function stakingToken() view returns (address)',
  'function rewardToken() view returns (address)',
  'function isAlive() view returns (bool)',
])

// ─── Aerodrome Voter ──────────────────────────────────────────────
export const AERODROME_VOTER_ABI = parseAbi([
  'function vote(uint256 poolId, int256 weight)',
  'function pools(uint256) view returns (address)',
  'function poolForGauge(address) view returns (address)',
  'function gaugeForPool(address) view returns (address)',
  'function gauges(address) view returns (address)',
  'function length() view returns (uint256)',
  'function totalWeight() view returns (uint256)',
  'function usedWeights(address) view returns (uint256)',
  'function lastVoted(address) view returns (uint256)',
])

// ─── ERC20 (minimal for balance/allowance) ────────────────────────
export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// ─── AnvilWallet (Hardware Wallet / Cold Storage) ─────────────────
export const ANVIL_WALLET_ABI = parseAbi([
  'function owner() view returns (address)',
  'function hardwareWallet() view returns (address)',
  'function setHardwareWallet(address _hw)',
  'function isHardwareWalletSet() view returns (bool)',
  'function getColdBalance() view returns (uint256)',
  'function sendFromCold(address to, uint256 amount)',
  'function coldTransferEnabled() view returns (bool)',
  'function enableColdTransfer()',
  'function disableColdTransfer()',
  'event HardwareWalletSet(address indexed owner, address indexed hardwareWallet)',
  'event ColdTransfer(address indexed from, address indexed to, uint256 amount)',
])

// ─── Chainlink Aggregator ─────────────────────────────────────────
export const CHAINLINK_AGGREGATOR_ABI = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
])
