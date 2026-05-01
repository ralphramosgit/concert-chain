# Concert Chain Smart Contracts

Solidity contracts for the Concert Chain ticketing lifecycle:

1. An authorized organizer creates an event in `EventManager`.
2. A fan buys a primary ticket with the exact ticket price.
3. `EventManager` mints an ERC-721 ticket through `Ticket`.
4. The organizer withdraws primary-sale proceeds with pull payments.
5. A ticket holder may escrow-list the ticket in `TicketMarketplace`.
6. A resale buyer purchases the escrowed ticket with exact payment.
7. The seller withdraws resale proceeds.
8. An organizer or authorized checker verifies and checks in the ticket through `TicketVerifier`.

## Contracts

| File | Purpose |
| --- | --- |
| `Ticket.sol` | ERC-721 ticket NFT with enumerable owner lookup, event linkage, role-gated minting, role-gated check-in state, and transfer prevention after check-in. |
| `EventManager.sol` | Event registry, organizer authorization, primary ticket sales, cancellation, and organizer withdrawals. |
| `TicketMarketplace.sol` | Escrow-based secondary market using safe ERC-721 transfers and seller withdrawals. |
| `TicketVerifier.sol` | Verification and check-in entry point for venue staff, organizers, and authorized checkers. |

## Foundry

Install dependencies:

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

Deploy locally:

```bash
anvil
forge script script/DeployConcertChain.s.sol:DeployConcertChain \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <ANVIL_PRIVATE_KEY> \
  --broadcast
```

The deployment script deploys all four contracts and grants:

- `Ticket.MINTER_ROLE` to `EventManager`
- `Ticket.CHECKIN_ROLE` to `TicketVerifier`

## Important Flow Changes From the Remix Prototype

- Event creation is limited to owner-authorized organizers.
- Primary and resale ETH uses pull withdrawals instead of forwarding during purchase.
- Resale listings escrow the NFT in the marketplace with `safeTransferFrom`.
- Checked-in tickets cannot be transferred or resold.
- Purchases require exact payment for cleaner frontend handling.
- Verification returns a structured result and check-in mutates state once.
