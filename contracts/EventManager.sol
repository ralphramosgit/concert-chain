// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Ticket} from "./Ticket.sol";

contract EventManager is Ownable, ReentrancyGuard {
    struct EventData {
        string name;
        string venue;
        string metadataURI;
        uint256 startsAt;
        uint256 totalTickets;
        uint256 ticketsSold;
        uint256 primaryPrice;
        address organizer;
        bool primarySaleActive;
        bool cancelled;
    }

    Ticket public immutable ticket;
    uint256 public nextEventId;
    uint256 public totalPendingWithdrawals;

    mapping(uint256 eventId => EventData) private _events;
    mapping(address organizer => bool authorized) public authorizedOrganizers;
    mapping(address account => uint256 amount) public pendingWithdrawals;

    event OrganizerAuthorizationUpdated(address indexed organizer, bool authorized);
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        string venue,
        uint256 startsAt,
        uint256 totalTickets,
        uint256 primaryPrice,
        string metadataURI
    );
    event PrimarySaleStatusUpdated(uint256 indexed eventId, bool active);
    event EventCancelled(uint256 indexed eventId, address indexed organizer);
    event PrimaryTicketPurchased(
        uint256 indexed eventId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );
    event Withdrawal(address indexed account, uint256 amount);
    event UnaccountedEthRescued(address indexed to, uint256 amount);

    error InvalidAddress();
    error NotAuthorizedOrganizer(address account);
    error NotEventOrganizer(uint256 eventId, address account);
    error InvalidEvent(uint256 eventId);
    error InvalidEventName();
    error InvalidTicketSupply();
    error InvalidEventDate();
    error EventCancelledError(uint256 eventId);
    error PrimarySaleClosed(uint256 eventId);
    error EventAlreadyStarted(uint256 eventId);
    error SoldOut(uint256 eventId);
    error IncorrectPayment(uint256 expected, uint256 actual);
    error NothingToWithdraw();
    error TransferFailed();
    error DirectEthNotAccepted();

    constructor(address ticketAddress, address initialOwner) Ownable(initialOwner) {
        if (ticketAddress == address(0) || initialOwner == address(0)) revert InvalidAddress();
        ticket = Ticket(ticketAddress);
        authorizedOrganizers[initialOwner] = true;
        emit OrganizerAuthorizationUpdated(initialOwner, true);
    }

    function setOrganizerAuthorization(address organizer, bool authorized) external onlyOwner {
        if (organizer == address(0)) revert InvalidAddress();
        authorizedOrganizers[organizer] = authorized;
        emit OrganizerAuthorizationUpdated(organizer, authorized);
    }

    function createEvent(
        string calldata name,
        string calldata venue,
        string calldata metadataURI,
        uint256 startsAt,
        uint256 totalTickets,
        uint256 primaryPrice
    ) external returns (uint256 eventId) {
        if (!authorizedOrganizers[msg.sender]) revert NotAuthorizedOrganizer(msg.sender);
        if (bytes(name).length == 0) revert InvalidEventName();
        if (totalTickets == 0) revert InvalidTicketSupply();
        if (startsAt <= block.timestamp) revert InvalidEventDate();

        eventId = nextEventId++;
        _events[eventId] = EventData({
            name: name,
            venue: venue,
            metadataURI: metadataURI,
            startsAt: startsAt,
            totalTickets: totalTickets,
            ticketsSold: 0,
            primaryPrice: primaryPrice,
            organizer: msg.sender,
            primarySaleActive: true,
            cancelled: false
        });

        emit EventCreated(
            eventId,
            msg.sender,
            name,
            venue,
            startsAt,
            totalTickets,
            primaryPrice,
            metadataURI
        );
    }

    function buyPrimaryTicket(uint256 eventId) external payable nonReentrant returns (uint256 tokenId) {
        EventData storage eventData = _existingEvent(eventId);

        if (eventData.cancelled) revert EventCancelledError(eventId);
        if (!eventData.primarySaleActive) revert PrimarySaleClosed(eventId);
        if (block.timestamp >= eventData.startsAt) revert EventAlreadyStarted(eventId);
        if (eventData.ticketsSold >= eventData.totalTickets) revert SoldOut(eventId);
        if (msg.value != eventData.primaryPrice) {
            revert IncorrectPayment(eventData.primaryPrice, msg.value);
        }

        eventData.ticketsSold += 1;
        pendingWithdrawals[eventData.organizer] += msg.value;
        totalPendingWithdrawals += msg.value;

        tokenId = ticket.mint(msg.sender, eventId, eventData.primaryPrice);

        emit PrimaryTicketPurchased(eventId, tokenId, msg.sender, msg.value);
    }

    function setPrimarySaleActive(uint256 eventId, bool active) external {
        EventData storage eventData = _existingEvent(eventId);
        _requireOrganizerOrOwner(eventId, eventData);

        if (eventData.cancelled) revert EventCancelledError(eventId);
        eventData.primarySaleActive = active;

        emit PrimarySaleStatusUpdated(eventId, active);
    }

    function cancelEvent(uint256 eventId) external {
        EventData storage eventData = _existingEvent(eventId);
        _requireOrganizerOrOwner(eventId, eventData);

        if (eventData.cancelled) revert EventCancelledError(eventId);
        eventData.cancelled = true;
        eventData.primarySaleActive = false;

        emit EventCancelled(eventId, eventData.organizer);
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

    function getEvent(uint256 eventId) external view returns (EventData memory) {
        return _existingEventView(eventId);
    }

    function getEvents(uint256 offset, uint256 limit)
        external
        view
        returns (EventData[] memory events_, uint256[] memory ids)
    {
        uint256 eventCount = nextEventId;
        if (offset >= eventCount || limit == 0) {
            return (new EventData[](0), new uint256[](0));
        }

        uint256 end = offset + limit;
        if (end > eventCount) end = eventCount;

        uint256 length = end - offset;
        events_ = new EventData[](length);
        ids = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 eventId = offset + i;
            events_[i] = _events[eventId];
            ids[i] = eventId;
        }
    }

    function remainingTickets(uint256 eventId) external view returns (uint256) {
        EventData memory eventData = _existingEventView(eventId);
        return eventData.totalTickets - eventData.ticketsSold;
    }

    function isOrganizerForEvent(uint256 eventId, address account) external view returns (bool) {
        EventData memory eventData = _existingEventView(eventId);
        return eventData.organizer == account;
    }

    receive() external payable {
        revert DirectEthNotAccepted();
    }

    fallback() external payable {
        revert DirectEthNotAccepted();
    }

    function _existingEvent(uint256 eventId) private view returns (EventData storage eventData) {
        eventData = _events[eventId];
        if (eventData.organizer == address(0)) revert InvalidEvent(eventId);
    }

    function _existingEventView(uint256 eventId) private view returns (EventData memory eventData) {
        eventData = _events[eventId];
        if (eventData.organizer == address(0)) revert InvalidEvent(eventId);
    }

    function _requireOrganizerOrOwner(uint256 eventId, EventData storage eventData) private view {
        if (msg.sender != eventData.organizer && msg.sender != owner()) {
            revert NotEventOrganizer(eventId, msg.sender);
        }
    }
}
