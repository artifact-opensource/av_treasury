// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Artifact
 * @dev Advanced NFT capable of storing digital audio hashes and multi-modal assets (3D/Animation).
 * Designed for the Artifact Virtual ecosystem.
 */
contract Artifact is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;

    struct ArtifactDetails {
        bytes32 audioHash;      // Immutable hash of the audio file for provenance
        string animationUri;    // URI for 3D graphic (GLB/USDZ) or Animation (MP4/Lottie)
        uint256 createdAt;      // Timestamp of creation
        bool isEvolving;        // Flag for assets that can change over time
    }

    // Mapping from token ID to its advanced digital properties
    mapping(uint256 => ArtifactDetails) public artifactRegistry;

    event ArtifactMinted(uint256 indexed tokenId, string uri, bytes32 audioHash, string animationUri);
    event ArtifactEvolved(uint256 indexed tokenId, string newAnimationUri);

    constructor() ERC721("Ava Artifact", "AVAART") Ownable(msg.sender) {}

    /**
     * @dev Mints a new advanced artifact.
     * @param to The recipient address.
     * @param uri The primary metadata URI (JSON).
     * @param _audioHash The SHA-256 hash of the audio file.
     * @param _animationUri The URI for the 3D/Animation asset.
     */
    function mintArtifact(
        address to, 
        string memory uri, 
        bytes32 _audioHash, 
        string memory _animationUri
    ) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newItemId = _tokenIds;

        _mint(to, newItemId);
        _setTokenURI(newItemId, uri);

        artifactRegistry[newItemId] = ArtifactDetails({
            audioHash: _audioHash,
            animationUri: _animationUri,
            createdAt: block.timestamp,
            isEvolving: true
        });

        emit ArtifactMinted(newItemId, uri, _audioHash, _animationUri);
        return newItemId;
    }

    /**
     * @dev Allows the owner to update the animation/3D asset of an existing artifact.
     */
    function evolveArtifact(uint256 tokenId, string memory newAnimationUri) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Artifact does not exist");
        artifactRegistry[tokenId].animationUri = newAnimationUri;
        
        emit ArtifactEvolved(tokenId, newAnimationUri);
    }

    /**
     * @dev Returns the full digital identity of the artifact.
     */
    function getArtifactIdentity(uint256 tokenId) public view returns (
        bytes32 audioHash, 
        string memory animationUri, 
        uint256 createdAt, 
        bool isEvolving
    ) {
        ArtifactDetails memory details = artifactRegistry[tokenId];
        return (details.audioHash, details.animationUri, details.createdAt, details.isEvolving);
    }
}
