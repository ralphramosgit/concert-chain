// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================
// Ticket.sol
// ERC-721 NFT for concert tickets.
// Ownership of this contract is transferred to EventManager after deployment,
// so only EventManager can mint new tickets.
// Uses ERC721Enumerable so the frontend can easily list a user's tickets.
// ================================================

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Ticket is ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;

    // Each ticket is permanently linked to the event it was minted for.
    mapping(uint256 => uint256) public ticketToEventId;

    event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed to);

    constructor() ERC721("ConcertTicket", "TICK") Ownable(msg.sender) {}

    /// Mint a new ticket. Only callable by the owner (EventManager after transferOwnership).
    function mint(address to, uint256 eventId) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        ticketToEventId[tokenId] = eventId;
        emit TicketMinted(tokenId, eventId, to);
        return tokenId;
    }

    /// Total tickets ever minted across all events.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /// Returns true if the given tokenId has been minted.
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// Returns every tokenId owned by `owner`. Convenience for the frontend.
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    // Placeholder metadata — swap for IPFS later if desired.
    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        // tokenId is intentionally unused for now; same metadata for every ticket.
        tokenId;
        return "https://example.com/tickets/metadata.json";
    }
}
