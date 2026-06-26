// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./QuasiCrystalSVG.sol";
import "./OnChainBase64.sol";

/**
 * @title QuasiCrystalLPNFT
 * @notice Dynamic LP position NFT with on-chain quasi-crystal visualization.
 * @dev Each mint gets a unique random seed ensuring unique SVG art.
 *      SVG + metadata generation delegated to QuasiCrystalSVG library.
 */
contract QuasiCrystalLPNFT is
    ERC721,
    ERC721URIStorage,
    ERC721Enumerable,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    using Strings for uint256;
    using OnChainBase64 for bytes;

    // ── Roles ──────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");
    bytes32 public constant GOVERNOR = keccak256("GOVERNOR");

    // ── Structs ────────────────────────────────────────────────────────

    struct PositionParams {
        uint128 agReserve;
        uint128 auReserve;
        uint128 liquidityAmount;
        uint32 volume24h;
        uint8 volatilityIndex;
        uint8 liquidityDepth;
        uint16 timeHeld;
        uint32 openedAt;
    }

    struct CachedMetrics {
        uint256 tvlUSD;
        uint256 healthScore;
        uint256 lastUpdated;
        bool valid;
    }

    struct RenderParams {
        uint8 maxSymmetry;
        uint8 maxLines;
        uint16 bleedFactor;
        uint16 targetSize;
        bool diagonalsEnabled;
        bool ringEchoEnabled;
    }

    // ── State ──────────────────────────────────────────────────────────

    uint256 private _nextTokenId;

    mapping(uint256 => PositionParams) public positions;
    mapping(uint256 => CachedMetrics) public metrics;
    mapping(uint256 => uint256) public mintSeed;
    mapping(address => bool) public authorizedSources;

    uint8 public maxSymmetry;
    uint8 public maxLines;
    uint16 public bleedFactor;
    uint16 public targetSize;
    bool public diagonalsEnabled;
    bool public ringEchoEnabled;

    // ── Events ─────────────────────────────────────────────────────────

    event PositionMinted(uint256 indexed tokenId, address indexed owner, PositionParams params, uint256 seed);
    event MetricsRefreshed(uint256 indexed tokenId, uint256 tvlUSD, uint256 healthScore);
    event RenderParamsUpdated(uint8 maxSymmetry, uint8 maxLines, uint16 bleedFactor);
    event SourceAuthorized(address indexed source, bool authorized);

    // ── Errors ─────────────────────────────────────────────────────────

    error InvalidPosition();
    error UnauthorizedSource();
    error TokenDoesNotExist();
    error InvalidParams();

    // ── Constructor ────────────────────────────────────────────────────

    constructor(
        string memory name_,
        string memory symbol_,
        address defaultAdmin,
        address minter,
        address governor
    ) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(GOVERNOR, governor);
        _grantRole(METADATA_ROLE, defaultAdmin);

        maxSymmetry = 13;
        maxLines = 21;
        bleedFactor = 13500;
        targetSize = 200;
        diagonalsEnabled = true;
        ringEchoEnabled = true;
    }

    // ── Minting ────────────────────────────────────────────────────────

    function mint(
        address to,
        PositionParams calldata params
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintWithParams(to, params);
    }

    function mintBatch(
        address[] calldata to,
        PositionParams[] calldata paramsArray
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        uint256 len = to.length;
        if (len != paramsArray.length || len == 0) revert InvalidParams();

        uint256[] memory tokenIds = new uint256[](len);
        for (uint256 i = 0; i < len; ) {
            tokenIds[i] = _mintWithParams(to[i], paramsArray[i]);
            unchecked { ++i; }
        }
        return tokenIds;
    }

    function _mintWithParams(address to, PositionParams calldata params) internal returns (uint256) {
        if (to == address(0)) revert InvalidPosition();
        if (params.agReserve == 0 && params.auReserve == 0) revert InvalidPosition();

        uint256 tokenId = _nextTokenId++;
        positions[tokenId] = params;

        // Unique randomization seed per token
        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            msg.sender,
            tokenId,
            block.timestamp,
            tx.gasprice
        )));
        mintSeed[tokenId] = seed;

        _mint(to, tokenId);
        emit PositionMinted(tokenId, to, params, seed);
        return tokenId;
    }

    // ── Metrics ────────────────────────────────────────────────────────

    function refreshMetrics(uint256 tokenId, uint256 tvlUSD, uint256 healthScore) external whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();

        if (msg.sender != _ownerOf(tokenId) && !hasRole(METADATA_ROLE, msg.sender)) {
            if (!authorizedSources[msg.sender]) revert UnauthorizedSource();
        }

        if (healthScore > 100) healthScore = 100;
        metrics[tokenId] = CachedMetrics(tvlUSD, healthScore, uint256(block.timestamp), true);
        emit MetricsRefreshed(tokenId, tvlUSD, healthScore);
    }

    function getMetrics(uint256 tokenId) external view returns (CachedMetrics memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return metrics[tokenId];
    }

    // ── ITvlSource Interface ───────────────────────────────────────────

    uint256 public accumulatedTvl;

    function getTvl() external view returns (uint256) {
        return accumulatedTvl;
    }

    function setAccumulatedTvl(uint256 newTvl) external onlyRole(METADATA_ROLE) {
        accumulatedTvl = newTvl;
    }

    // ── Rendering Params ───────────────────────────────────────────────

    function renderParams() external view returns (RenderParams memory) {
        return RenderParams(maxSymmetry, maxLines, bleedFactor, targetSize, diagonalsEnabled, ringEchoEnabled);
    }

    function setRenderParams(RenderParams calldata p) external onlyRole(METADATA_ROLE) {
        if (p.maxSymmetry > 21 || p.maxLines > 34) revert InvalidParams();
        maxSymmetry = p.maxSymmetry;
        maxLines = p.maxLines;
        bleedFactor = p.bleedFactor;
        targetSize = p.targetSize;
        diagonalsEnabled = p.diagonalsEnabled;
        ringEchoEnabled = p.ringEchoEnabled;
        emit RenderParamsUpdated(p.maxSymmetry, p.maxLines, p.bleedFactor);
    }

    // ── Source Authorization ───────────────────────────────────────────

    function authorizeSource(address source, bool authorized) external onlyRole(METADATA_ROLE) {
        authorizedSources[source] = authorized;
        emit SourceAuthorized(source, authorized);
    }

    // ── Token URI ──────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();

        PositionParams memory pos = positions[tokenId];
        CachedMetrics memory met = metrics[tokenId];

        // Generate SVG via library
        string memory svg = QuasiCrystalSVG.generateSVG(
            pos.agReserve, pos.auReserve, pos.liquidityAmount,
            pos.volume24h, pos.volatilityIndex, pos.liquidityDepth,
            pos.timeHeld, pos.openedAt,
            mintSeed[tokenId]
        );

        // Build metadata JSON via library
        string memory base64Json = QuasiCrystalSVG.buildJSON(
            tokenId, svg,
            uint256(pos.agReserve), uint256(pos.auReserve),
            uint256(pos.volume24h), uint256(pos.volatilityIndex),
            uint256(pos.liquidityDepth), uint256(pos.timeHeld),
            met.healthScore, met.valid
        );

        return string.concat("data:application/json;base64,", base64Json);
    }

    // ── Admin ──────────────────────────────────────────────────────────

    function pause() external onlyRole(GOVERNOR) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNOR) {
        _unpause();
    }

    // ── Required Overrides ──────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ── View Functions ─────────────────────────────────────────────────

    function getPosition(uint256 tokenId) external view returns (PositionParams memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return positions[tokenId];
    }

    function getTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function _traitStr(string memory t, string memory v) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', t, '","value":"', v, '"},');
    }

    function _traitLast(string memory t, string memory v) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', t, '","value":"', v, '"}');
    }
}
