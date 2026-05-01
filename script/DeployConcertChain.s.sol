// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";

import {EventManager} from "../contracts/EventManager.sol";
import {Ticket} from "../contracts/Ticket.sol";
import {TicketMarketplace} from "../contracts/TicketMarketplace.sol";
import {TicketVerifier} from "../contracts/TicketVerifier.sol";

contract DeployConcertChain is Script {
    function run()
        external
        returns (
            Ticket ticket,
            EventManager eventManager,
            TicketMarketplace marketplace,
            TicketVerifier verifier
        )
    {
        address deployer = vm.envOr("DEPLOYER_ADDRESS", msg.sender);
        string memory baseURI = vm.envOr("TICKET_BASE_URI", string(""));

        vm.startBroadcast();

        ticket = new Ticket(deployer, baseURI);
        eventManager = new EventManager(address(ticket), deployer);
        marketplace = new TicketMarketplace(address(ticket), address(eventManager), deployer);
        verifier = new TicketVerifier(address(ticket), address(eventManager), deployer);

        ticket.grantRole(ticket.MINTER_ROLE(), address(eventManager));
        ticket.grantRole(ticket.CHECKIN_ROLE(), address(verifier));

        vm.stopBroadcast();
    }
}
