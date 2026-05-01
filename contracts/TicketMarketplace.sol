// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================
// TicketMarketplace.sol
// Secondary market: ticket owners list their NFTs for resale, buyers pay in ETH.
// IMPORTANT: before calling listTicket, the seller must approve this contract to
// transfer the ticket. The frontend should call:
//     ticketContract.approve(marketplaceAddress, ticketId)
//   OR (one-time)
//     ticketContract.setApprovalForAll(marketplaceAddress, true)
// ================================================

import "./Ticket.sol";

contract TicketMarketplace {
    struct Listing {
        address seller;
        uint256 price;     // wei
        bool isListed;
    }

    Ticket public immutable ticketContract;

    mapping(uint256 => Listing) public listings;

    event TicketListed(uint256 indexed ticketId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed ticketId, address indexed seller);
    event TicketSold(uint256 indexed ticketId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address _ticketContractAddress) {
        ticketContract = Ticket(_ticketContractAddress);
    }

    /// Seller lists a ticket. Seller must have approved this contract beforehand.
    function listTicket(uint256 ticketId, uint256 price) external {
        require(price > 0, "Price must be > 0");
        require(ticketContract.ownerOf(ticketId) == msg.sender, "Not the ticket owner");

        // Confirm we're authorized to move the token at sale time.
        require(
            ticketContract.getApproved(ticketId) == address(this) ||
                ticketContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        listings[ticketId] = Listing({seller: msg.sender, price: price, isListed: true});
        emit TicketListed(ticketId, msg.sender, price);
    }

    /// Update the price of an existing listing.
    function updatePrice(uint256 ticketId, uint256 newPrice) external {
        Listing storage l = listings[ticketId];
        require(l.isListed, "Not listed");
        require(l.seller == msg.sender, "Not the seller");
        require(newPrice > 0, "Price must be > 0");
        l.price = newPrice;
        emit TicketListed(ticketId, msg.sender, newPrice);
    }

    /// Seller cancels their listing.
    function cancelListing(uint256 ticketId) external {
        Listing storage l = listings[ticketId];
        require(l.isListed, "Not listed");
        require(l.seller == msg.sender, "Not the seller");
        l.isListed = false;
        emit ListingCancelled(ticketId, msg.sender);
    }

    /// Buyer purchases a listed ticket. Excess ETH is refunded.
    function buyTicket(uint256 ticketId) external payable {
        Listing memory listing = listings[ticketId];
        require(listing.isListed, "Ticket not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        require(ticketContract.ownerOf(ticketId) == listing.seller, "Seller no longer owns ticket");
        require(listing.seller != msg.sender, "Cannot buy your own listing");

        // Mark sold first (effects before interactions).
        listings[ticketId].isListed = false;

        // Transfer the NFT (we were approved by the seller).
        ticketContract.transferFrom(listing.seller, msg.sender, ticketId);

        // Pay the seller.
        (bool paid, ) = payable(listing.seller).call{value: listing.price}("");
        require(paid, "Payment to seller failed");

        // Refund overpayment.
        uint256 refund = msg.value - listing.price;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            require(refunded, "Refund failed");
        }

        emit TicketSold(ticketId, listing.seller, msg.sender, listing.price);
    }

    function getListing(uint256 ticketId) external view returns (Listing memory) {
        return listings[ticketId];
    }
}
