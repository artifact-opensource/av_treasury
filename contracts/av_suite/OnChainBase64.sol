// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title Base64
 * @notice On-chain Base64 encoding library
 */
library OnChainBase64 {
    bytes constant private _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        bytes memory table = _TABLE;
        uint256 len = data.length;
        uint256 fullChunks = len / 3;
        uint256 remainder = len % 3;
        uint256 outLen = fullChunks * 4;
        if (remainder != 0) outLen += 4;

        bytes memory result = new bytes(outLen);
        uint256 j = 0;

        for (uint256 i = 0; i < fullChunks * 3; ) {
            uint256 chunk = (uint256(uint8(data[i])) << 16) |
                (uint256(uint8(data[i + 1])) << 8) |
                uint256(uint8(data[i + 2]));
            result[j] = table[(chunk >> 18) & 0x3F];
            result[j + 1] = table[(chunk >> 12) & 0x3F];
            result[j + 2] = table[(chunk >> 6) & 0x3F];
            result[j + 3] = table[chunk & 0x3F];
            j += 4;
            unchecked { i += 3; }
        }

        if (remainder == 1) {
            uint256 chunk = uint256(uint8(data[len - 1])) << 16;
            result[j] = table[(chunk >> 18) & 0x3F];
            result[j + 1] = table[(chunk >> 12) & 0x3F];
            result[j + 2] = 0x3d;
            result[j + 3] = 0x3d;
        } else if (remainder == 2) {
            uint256 chunk =
                (uint256(uint8(data[len - 2])) << 16) |
                uint256(uint8(data[len - 1])) << 8;
            result[j] = table[(chunk >> 18) & 0x3F];
            result[j + 1] = table[(chunk >> 12) & 0x3F];
            result[j + 2] = table[(chunk >> 6) & 0x3F];
            result[j + 3] = 0x3d;
        }

        return string(result);
    }
}
