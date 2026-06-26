// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./OnChainBase64.sol";

/**
 * @title QuasiCrystalSVG
 * @notice Library for generating quasi-crystal SVG + metadata JSON
 * @dev Deployed separately, called via DELEGATECALL
 */
library QuasiCrystalSVG {
    using Strings for uint256;
    using OnChainBase64 for bytes;

    function generateSVG(
        uint128 agReserve,
        uint128 auReserve,
        uint128 liquidityAmount,
        uint32 volume24h,
        uint8 volatilityIndex,
        uint8 liquidityDepth,
        uint16 timeHeld,
        uint32 openedAt,
        uint256 seed
    ) external pure returns (string memory) {
        uint256 health = _computeHealth(volatilityIndex, liquidityDepth, timeHeld);
        string memory accent = _healthColor(health);
        uint256 tvl = uint256(agReserve) + uint256(auReserve) * 20;
        (uint8 symmetry, uint8 lines) = _computeSymmetryLines(seed, agReserve, auReserve, tvl);
        return _buildSVG(symmetry, lines, seed, accent, health, tvl);
    }

    function buildJSON(
        uint256 tokenId,
        string memory svg,
        uint256 agReserve,
        uint256 auReserve,
        uint256 volume24h,
        uint256 volatilityIndex,
        uint256 liquidityDepth,
        uint256 timeHeld,
        uint256 healthScore,
        bool metricsValid
    ) external pure returns (string memory) {
        // Encode SVG to base64 first (use abi.encodePacked for correct string handling)
        bytes memory svgBytes = abi.encodePacked(svg);
        string memory svgB64 = svgBytes.encode();

        // Build JSON using only string.concat with string arguments
        // Split into 3 parts to avoid any null byte issues
        string memory part1 = string.concat('{"name":"QuasiCrystal LP #', tokenId.toString());
        string memory part2 = string.concat('","image":"data:image/svg+xml;base64,', svgB64);
        string memory part3 = string.concat('","attributes":[',
            '{"trait_type":"Ag","value":"', agReserve.toString(), '"},',
            '{"trait_type":"Au","value":"', auReserve.toString(), '"},',
            '{"trait_type":"Vol","value":"', volume24h.toString(), '"},',
            '{"trait_type":"Vola","value":"', volatilityIndex.toString(), '"},',
            '{"trait_type":"Liq","value":"', liquidityDepth.toString(), '"},',
            '{"trait_type":"Age","value":"', timeHeld.toString(), '"},',
            '{"trait_type":"HP","value":"', metricsValid ? healthScore.toString() : '0', '"}]}');
        string memory json = string.concat(part1, part2, part3);

        // Base64 encode
        return bytes(json).encode();
    }

    function _buildSVG(
        uint8 symmetry,
        uint8 lines,
        uint256 seed,
        string memory accent,
        uint256 health,
        uint256 tvl
    ) internal pure returns (string memory) {
        if (symmetry == 0) symmetry = 3;
        if (lines == 0) lines = 3;
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 480"><rect width="340" height="480" fill="#030303"/>',
            _svgRings(accent),
            _svgCrystalLines(symmetry, lines, seed, accent),
            _svgParams(symmetry, lines, seed, health, tvl),
            _svgBorder(accent),
            "</svg>"
        );
    }

    function _svgRings(string memory accent) internal pure returns (string memory) {
        return string.concat(
            '<circle cx="170" cy="240" r="120" fill="none" stroke="', accent, '" stroke-width="0.5" opacity="0.12"/>',
            '<circle cx="170" cy="240" r="80" fill="none" stroke="', accent, '" stroke-width="0.3" opacity="0.08"/>',
            '<circle cx="170" cy="240" r="40" fill="none" stroke="', accent, '" stroke-width="0.2" opacity="0.05"/>'
        );
    }

    function _svgBorder(string memory accent) internal pure returns (string memory) {
        return string.concat(
            '<rect x="1" y="1" width="338" height="478" rx="19" fill="none" stroke="',
            accent, '" stroke-width="0.5" opacity="0.3"/>'
        );
    }

    function _svgParams(
        uint8 symmetry,
        uint8 lines,
        uint256 seed,
        uint256 health,
        uint256 tvl
    ) internal pure returns (string memory) {
        return string.concat(
            '<text x="170" y="236" text-anchor="middle" font-family="monospace" font-size="9" fill="#fff" opacity="0.5">',
            'sym=', uint256(symmetry).toString(),
            ' ln=', uint256(lines).toString(),
            ' sd=', (seed % 1000000).toString(),
            ' hp=', uint256(health).toString(),
            ' tv=', uint256(tvl).toString(),
            '</text>'
        );
    }

    function _svgCrystalLines(
        uint8 symmetry,
        uint8 lines,
        uint256 seed,
        string memory accent
    ) internal pure returns (string memory) {
        uint256 angleStep = 360 / symmetry;
        string memory result = "";

        for (uint256 i = 0; i < lines; ) {
            uint256 angle = (i * angleStep + (seed % angleStep)) % 360;
            (int256 radX, int256 radY) = _toCartesian(angle);
            uint256 ex = uint256(int256(170) + radX * 110 / 1e6);
            uint256 ey = uint256(int256(240) + radY * 110 / 1e6);
            uint256 op = 15 + (i * 35 / lines);

            result = string.concat(
                result,
                '<line x1="170" y1="240" x2="', ex.toString(),
                '" y2="', ey.toString(),
                '" stroke="', accent,
                '" stroke-width="0.5" opacity="', op.toString(), '%"/>'
            );

            unchecked { ++i; }
        }

        return result;
    }

    function _toCartesian(uint256 angle) internal pure returns (int256 cosVal, int256 sinVal) {
        angle = angle % 360;

        bool sinNeg;
        if (angle > 180) {
            angle = 360 - angle;
            sinNeg = true;
        } else {
            sinNeg = false;
        }

        bool cosNeg;
        if (angle > 90) {
            angle = 180 - angle;
            cosNeg = true;
        } else {
            cosNeg = false;
        }

        cosVal = int256(1e6 - (angle * 1e6 / 90));
        if (cosNeg) cosVal = -cosVal;

        uint256 sinAngle = 90 - angle;
        sinVal = int256(1e6 - (sinAngle * 1e6 / 90));
        if (sinNeg) sinVal = -sinVal;

        return (cosVal, sinVal);
    }

    function _computeSymmetryLines(
        uint256 seed,
        uint128 agReserve,
        uint128 auReserve,
        uint256 tvl
    ) internal pure returns (uint8 symmetry, uint8 lines) {
        uint256 ratio = uint256(auReserve) * 1e18 / (agReserve == 0 ? 1 : uint256(agReserve));
        uint256 bal = _balanceScore(ratio);

        uint256 rawSym = 3 + (bal * 10 / 1e18);
        uint256 r1 = seed % 1000;
        if (r1 < 333 && rawSym < 13) rawSym += 2;
        else if (r1 < 666 && rawSym > 3) rawSym -= 1;
        if (rawSym > 13) rawSym = 13;
        if (rawSym < 3) rawSym = 3;

        uint256 rawLines = tvl > 200000e6 ? 21 : tvl > 50000e6 ? 13 : 8;
        uint256 r2 = (seed >> 10) % 1000;
        if (r2 < 250 && rawLines < 21) rawLines += 4;
        else if (r2 < 500 && rawLines > 8) rawLines += 2;
        else if (r2 < 750 && rawLines > 10) rawLines -= 2;
        if (rawLines > 21) rawLines = 21;
        if (rawLines < 3) rawLines = 3;

        return (uint8(rawSym), uint8(rawLines));
    }

    function _computeHealth(
        uint8 volatilityIndex,
        uint8 liquidityDepth,
        uint16 timeHeld
    ) internal pure returns (uint256) {
        uint256 stab = (100 - uint256(volatilityIndex)) * 40;
        uint256 depth = uint256(liquidityDepth) * 40;
        uint256 age = timeHeld > 180 ? 2000 : (uint256(timeHeld) * 2000 / 180);
        return (stab + depth + age) / 100;
    }

    function _healthColor(uint256 health) internal pure returns (string memory) {
        if (health >= 80) return "#39FF14";
        if (health >= 60) return "#00F0FF";
        if (health >= 40) return "#FFD700";
        if (health >= 20) return "#FF6600";
        return "#FF0055";
    }

    function _balanceScore(uint256 ratio) internal pure returns (uint256) {
        uint256 ideal = 0.2e18;
        uint256 diff = ratio > ideal ? ratio - ideal : ideal - ratio;
        uint256 score = 1e18 > diff ? 1e18 - diff : 0;
        return score > 1e18 ? 1e18 : score;
    }

    function _traitStr(string memory t, string memory v) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', t, '","value":"', v, '"},');
    }

    function _traitLast(string memory t, string memory v) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', t, '","value":"', v, '"}');
    }
}
