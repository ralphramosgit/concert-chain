// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================
// EventManager.sol
// - Anyone can create an event (acts as that event's organizer).
// - Fans call buyPrimaryTicket(eventId) with ETH to mint a ticket directly.
// - Payment is forwarded to the event's organizer.
// - Resales happen in TicketMarketplace.sol (separate contract).
// ================================================

import "./Ticket.sol";

contract EventManager {
    struct Event {
        string name;
        uint256 date;          // Unix timestamp
        uint256 totalTickets;
        uint256 ticketsMinted;
        uint256 initialPrice;  // wei — required payment for primary purchase
        address organizer;     // receives the ETH from primary sales
    }

    Ticket public immutable ticketContract;

    mapping(uint256 => Event) private _events;
    uint256 public nextEventId;

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint256 date,
        uint256 totalTickets,
        uint256 initialPrice
    );

    event PrimaryTicketSold(
        uint256 indexed eventId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 pricePaid
    );

    constructor(address _ticketContractAddress) {
        ticketContract = Ticket(_ticketContractAddress);
    }

    /// Anyone can create an event. The caller becomes the organizer who receives primary-sale payments.
    function createEvent(
        string calldata name,
        uint256 date,
        uint256 totalTickets,
        uint256 initialPrice
    ) external returns (uint256 eventId) {
        require(bytes(name).length > 0, "Name required");
        require(totalTickets > 0, "Must have tickets");
        require(date > block.timestamp, "Date must be in the future");

        eventId = nextEventId++;
        _events[eventId] = Event({
            name: name,
            date: date,
            totalTickets: totalTickets,
            ticketsMinted: 0,
            initialPrice: initialPrice,
            organizer: msg.sender
        });

        emit EventCreated(eventId, msg.sender, name, date, totalTickets, initialPrice);
    }

    /// Fan-facing primary purchase: mints a new ticket to the buyer and forwards ETH to the organizer.
    /// Excess ETH is refunded.
    function buyPrimaryTicket(uint256 eventId) external payable returns (uint256 tokenId) {
        Event storage ev = _events[eventId];
        require(ev.organizer != address(0), "Event does not exist");
        require(block.timestamp < ev.date, "Event has already started");
        require(ev.ticketsMinted < ev.totalTickets, "Sold out");
        require(msg.value >= ev.initialPrice, "Insufficient payment");

        ev.ticketsMinted += 1;
        tokenId = ticketContract.mint(msg.sender, eventId);

        // Forward payment to organizer.
        if (ev.initialPrice > 0) {
            (bool ok, ) = payable(ev.organizer).call{value: ev.initialPrice}("");
            require(ok, "Payment to organizer failed");
        }

        // Refund any overpayment.
        uint256 refund = msg.value - ev.initialPrice;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            require(refunded, "Refund failed");
        }

        emit PrimaryTicketSold(eventId, tokenId, msg.sender, ev.initialPrice);
    }

    // -------- Views --------

    function getEvent(uint256 eventId) external view returns (Event memory) {
        return _events[eventId];
    }

    /// Returns every event ever created. Cheap convenience for the frontend.
    function getAllEvents() external view returns (Event[] memory all, uint256[] memory ids) {
        uint256 n = nextEventId;
        all = new Event[](n);
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            all[i] = _events[i];
            ids[i] = i;
        }
    }
}
