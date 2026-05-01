# Concert Chain — Smart Contracts

All Solidity source for Concert Chain. Designed to be edited and tested in **Remix IDE**, then deployed to the **Sepolia** testnet.

## Files

| File                    | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `Ticket.sol`            | ERC-721 NFT (one token = one ticket). Owned by `EventManager`.       |
| `EventManager.sol`      | Creates events; handles primary ticket sales (mint + pay organizer). |
| `TicketMarketplace.sol` | Secondary market — list, update, cancel, and buy resold tickets.     |
| `TicketVerifier.sol`    | Read-only checks for ticket validity.                                |

## Architecture

```
                        ┌────────────────────┐
   creates event ──▶    │   EventManager     │  ─── owns ──▶  Ticket (ERC-721)
   buyPrimaryTicket ─▶  │  (primary market)  │                       ▲
                        └────────────────────┘                       │
                                                                     │ approve + transferFrom
                        ┌────────────────────┐                       │
   listTicket ─────────▶│ TicketMarketplace  │ ──────────────────────┘
   buyTicket ──────────▶│ (secondary market) │
                        └────────────────────┘

                        ┌────────────────────┐
   verifyTicket ───────▶│  TicketVerifier    │  (reads from Ticket + EventManager)
                        └────────────────────┘
```

## Workflow (high level)

1. **Manager creates an event** → `EventManager.createEvent(name, date, totalTickets, initialPrice)`
2. **Fan buys a primary ticket** → `EventManager.buyPrimaryTicket(eventId)` _(payable)_ — mints a new NFT to the fan, forwards payment to the organizer.
3. **Fan resells** →
   1. `Ticket.approve(marketplaceAddress, ticketId)` _(one-time per ticket)_ OR `Ticket.setApprovalForAll(marketplaceAddress, true)` _(once for all)_.
   2. `TicketMarketplace.listTicket(ticketId, priceWei)`
4. **Another fan buys the resale** → `TicketMarketplace.buyTicket(ticketId)` _(payable)_.

## Using with Remix

1. Open https://remix.ethereum.org.
2. In the file explorer, create a workspace and upload all four `.sol` files (or use the **GitHub > Connect** option to load this folder directly).
3. Compile with Solidity `0.8.20` or newer (matches the `pragma`). OpenZeppelin imports are auto-resolved by Remix.
4. Test in the **Remix VM** first (no MetaMask needed).
5. When ready, switch the Environment to **Injected Provider — MetaMask** with MetaMask on the **Sepolia** network.

## Deployment order (Sepolia)

> Get free Sepolia ETH from https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia.

1. Deploy `Ticket` → save **TICKET_ADDR**.
2. Deploy `EventManager(TICKET_ADDR)` → save **EVENT_MGR_ADDR**.
3. **Critical**: in the deployed `Ticket` contract, call `transferOwnership(EVENT_MGR_ADDR)`. Without this, no tickets can be minted.
4. Deploy `TicketMarketplace(TICKET_ADDR)` → save **MARKETPLACE_ADDR**.
5. Deploy `TicketVerifier(TICKET_ADDR, EVENT_MGR_ADDR)` → save **VERIFIER_ADDR**.

After deployment, copy each contract's ABI from Remix's _Compilation Details_ panel into `lib/abis/` in the Next.js project, and put the four addresses into `.env.local` as:

```
NEXT_PUBLIC_TICKET_ADDR=0x...
NEXT_PUBLIC_EVENT_MGR_ADDR=0x...
NEXT_PUBLIC_MARKETPLACE_ADDR=0x...
NEXT_PUBLIC_VERIFIER_ADDR=0x...
```

## Quick sanity test in Remix VM

With all four contracts deployed in the same Remix VM session:

1. `EventManager.createEvent("Test", <future timestamp>, 5, 10000000000000000)` — 0.01 ETH per ticket.
2. Switch to a different VM account.
3. `EventManager.buyPrimaryTicket(0)` with **VALUE = 0.01 ETH** → you now own ticket id 0.
4. `Ticket.approve(MARKETPLACE_ADDR, 0)`.
5. `TicketMarketplace.listTicket(0, 20000000000000000)` — relist for 0.02 ETH.
6. Switch to a third account.
7. `TicketMarketplace.buyTicket(0)` with **VALUE = 0.02 ETH** → ownership transfers, seller receives ETH.
8. `TicketVerifier.verifyTicket(0, 0)` → returns `true`.
