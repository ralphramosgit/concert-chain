// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {EventManager} from "./EventManager.sol";
import {Ticket} from "./Ticket.sol";

contract TicketVerifier is Ownable {
    struct Verification {
        bool valid;
        bool checkedIn;
        address owner;
        address organizer;
        uint256 eventId;
        string reason;
    }

    Ticket public immutable ticket;
    EventManager public immutable eventManager;

    mapping(address account => bool authorized) public authorizedCheckers;

    event CheckerAuthorizationUpdated(address indexed checker, bool authorized);
    event TicketVerification(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed requester,
        bool valid,
        string reason
    );
    event TicketCheckIn(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed attendee,
        address operator
    );

    error InvalidAddress();
    error NotAuthorizedChecker(address account);
    error InvalidTicket(uint256 tokenId, uint256 eventId);
    error TicketAlreadyCheckedIn(uint256 tokenId);
    error EventCancelled(uint256 eventId);

    constructor(address ticketAddress, address eventManagerAddress, address initialOwner) Ownable(initialOwner) {
        if (ticketAddress == address(0) || eventManagerAddress == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }

        ticket = Ticket(ticketAddress);
        eventManager = EventManager(eventManagerAddress);
        authorizedCheckers[initialOwner] = true;

        emit CheckerAuthorizationUpdated(initialOwner, true);
    }

    function setCheckerAuthorization(address checker, bool authorized) external onlyOwner {
        if (checker == address(0)) revert InvalidAddress();
        authorizedCheckers[checker] = authorized;
        emit CheckerAuthorizationUpdated(checker, authorized);
    }

    function verifyTicket(uint256 tokenId, uint256 eventId) public view returns (Verification memory result) {
        (bool exists_, address owner, uint256 actualEventId,, bool checkedIn_) = ticket.ticketInfo(tokenId);
        if (!exists_) {
            return Verification(false, false, address(0), address(0), eventId, "TICKET_DOES_NOT_EXIST");
        }

        if (actualEventId != eventId) {
            return Verification(false, checkedIn_, owner, address(0), actualEventId, "WRONG_EVENT");
        }

        EventManager.EventData memory eventData = eventManager.getEvent(eventId);
        if (eventData.cancelled) {
            return Verification(false, checkedIn_, owner, eventData.organizer, eventId, "EVENT_CANCELLED");
        }

        if (checkedIn_) {
            return Verification(false, true, owner, eventData.organizer, eventId, "ALREADY_CHECKED_IN");
        }

        return Verification(true, false, owner, eventData.organizer, eventId, "VALID");
    }

    function verifyAndEmit(uint256 tokenId, uint256 eventId) external returns (Verification memory result) {
        result = verifyTicket(tokenId, eventId);
        emit TicketVerification(tokenId, eventId, msg.sender, result.valid, result.reason);
    }

    function checkIn(uint256 tokenId, uint256 eventId) external {
        Verification memory result = verifyTicket(tokenId, eventId);

        if (!result.valid) revert InvalidTicket(tokenId, eventId);
        if (result.checkedIn) revert TicketAlreadyCheckedIn(tokenId);
        if (!authorizedCheckers[msg.sender] && msg.sender != result.organizer && msg.sender != owner()) {
            revert NotAuthorizedChecker(msg.sender);
        }

        ticket.markCheckedIn(tokenId, eventId, msg.sender);

        emit TicketCheckIn(tokenId, eventId, result.owner, msg.sender);
    }
}
