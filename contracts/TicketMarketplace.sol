// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {EventManager} from "./EventManager.sol";
import {Ticket} from "./Ticket.sol";

contract TicketMarketplace is ERC721Holder, Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    Ticket public immutable ticket;
    EventManager public immutable eventManager;
    uint256 public totalPendingWithdrawals;

    mapping(uint256 tokenId => Listing listing) public listings;
    mapping(address account => uint256 amount) public pendingWithdrawals;

    event TicketListed(uint256 indexed tokenId, uint256 indexed eventId, address indexed seller, uint256 price);
    event ListingPriceUpdated(uint256 indexed tokenId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    event ListingCancelled(uint256 indexed tokenId, uint256 indexed eventId, address indexed seller);
    event ResaleTicketPurchased(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed seller,
        address buyer,
        uint256 price
    );
    event Withdrawal(address indexed account, uint256 amount);
    event UnaccountedEthRescued(address indexed to, uint256 amount);

    error InvalidAddress();
    error InvalidPrice();
    error NotTicketOwner(uint256 tokenId, address account);
    error TicketAlreadyListed(uint256 tokenId);
    error ListingNotActive(uint256 tokenId);
    error NotListingSeller(uint256 tokenId, address account);
    error CannotBuyOwnListing(uint256 tokenId);
    error IncorrectPayment(uint256 expected, uint256 actual);
    error EventUnavailable(uint256 eventId);
    error TicketAlreadyCheckedIn(uint256 tokenId);
    error NothingToWithdraw();
    error TransferFailed();
    error DirectEthNotAccepted();

    constructor(address ticketAddress, address eventManagerAddress, address initialOwner) Ownable(initialOwner) {
        if (ticketAddress == address(0) || eventManagerAddress == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }
        ticket = Ticket(ticketAddress);
        eventManager = EventManager(eventManagerAddress);
    }

    function listTicket(uint256 tokenId, uint256 price) external nonReentrant {
        if (price == 0) revert InvalidPrice();
        if (ticket.ownerOf(tokenId) != msg.sender) revert NotTicketOwner(tokenId, msg.sender);
        if (listings[tokenId].active) revert TicketAlreadyListed(tokenId);

        uint256 eventId = ticket.ticketEventId(tokenId);
        _requireTradable(tokenId, eventId);

        listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        ticket.safeTransferFrom(msg.sender, address(this), tokenId);

        emit TicketListed(tokenId, eventId, msg.sender, price);
    }

    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        if (newPrice == 0) revert InvalidPrice();

        Listing storage listing = listings[tokenId];
        if (!listing.active) revert ListingNotActive(tokenId);
        if (listing.seller != msg.sender) revert NotListingSeller(tokenId, msg.sender);

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(tokenId, msg.sender, oldPrice, newPrice);
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert ListingNotActive(tokenId);
        if (listing.seller != msg.sender) revert NotListingSeller(tokenId, msg.sender);

        address seller = listing.seller;
        uint256 eventId = ticket.ticketEventId(tokenId);

        delete listings[tokenId];
        ticket.safeTransferFrom(address(this), seller, tokenId);

        emit ListingCancelled(tokenId, eventId, seller);
    }

    function buyTicket(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        if (!listing.active) revert ListingNotActive(tokenId);
        if (listing.seller == msg.sender) revert CannotBuyOwnListing(tokenId);
        if (msg.value != listing.price) revert IncorrectPayment(listing.price, msg.value);

        uint256 eventId = ticket.ticketEventId(tokenId);
        _requireTradable(tokenId, eventId);

        delete listings[tokenId];
        pendingWithdrawals[listing.seller] += msg.value;
        totalPendingWithdrawals += msg.value;

        ticket.safeTransferFrom(address(this), msg.sender, tokenId);

        emit ResaleTicketPurchased(tokenId, eventId, listing.seller, msg.sender, msg.value);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        totalPendingWithdrawals -= amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    function rescueUnaccountedEth(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();

        uint256 balance = address(this).balance;
        if (balance <= totalPendingWithdrawals) revert NothingToWithdraw();
        uint256 amount = balance - totalPendingWithdrawals;

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit UnaccountedEthRescued(to, amount);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].active;
    }

    receive() external payable {
        revert DirectEthNotAccepted();
    }

    fallback() external payable {
        revert DirectEthNotAccepted();
    }

    function _requireTradable(uint256 tokenId, uint256 eventId) private view {
        if (ticket.isCheckedIn(tokenId)) revert TicketAlreadyCheckedIn(tokenId);

        EventManager.EventData memory eventData = eventManager.getEvent(eventId);
        if (eventData.cancelled || block.timestamp >= eventData.startsAt) {
            revert EventUnavailable(eventId);
        }
    }
}
