// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================
// TicketVerifier.sol
// Read-only utility contract for confirming a ticket is valid for an event.
// Useful at the venue door / for UI badges.
// ================================================

import "./Ticket.sol";
import "./EventManager.sol";

contract TicketVerifier {
    Ticket public immutable ticketContract;
    EventManager public immutable eventManager;

    constructor(address _ticketContractAddress, address _eventManagerAddress) {
        ticketContract = Ticket(_ticketContractAddress);
        eventManager = EventManager(_eventManagerAddress);
    }

    /// Returns true if `ticketId` exists and was minted for `eventId`, and that event is real.
    function verifyTicket(uint256 ticketId, uint256 eventId) external view returns (bool) {
        if (!ticketContract.exists(ticketId)) return false;
        if (ticketContract.ticketToEventId(ticketId) != eventId) return false;

        EventManager.Event memory ev = eventManager.getEvent(eventId);
        if (ev.organizer == address(0)) return false;
        return true;
    }

    /// Convenience: returns ownership + validity in one call.
    function ticketInfo(uint256 ticketId)
        external
        view
        returns (bool exists_, address owner, uint256 eventId)
    {
        exists_ = ticketContract.exists(ticketId);
        if (!exists_) return (false, address(0), 0);
        owner = ticketContract.ownerOf(ticketId);
        eventId = ticketContract.ticketToEventId(ticketId);
    }
}
