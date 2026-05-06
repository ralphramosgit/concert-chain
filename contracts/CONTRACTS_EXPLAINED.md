# Concert Chain — Smart Contracts Explained

This doc walks through every smart contract in the project and explains what's actually happening on the Ethereum (Sepolia) blockchain when the app runs.

---

## 1. The four contracts

When you deploy, you end up with **four separate contracts**, each at its own address on Sepolia. They reference each other through those addresses (passed into constructors).

| Contract              | Address env var                    | Role                                              |
| --------------------- | ---------------------------------- | ------------------------------------------------- |
| `Ticket`              | `NEXT_PUBLIC_TICKET_ADDR`          | The NFT itself (ERC-721). One token = one ticket. |
| `EventManager`        | `NEXT_PUBLIC_EVENT_MGR_ADDR`       | Creates events. Sells primary tickets.            |
| `TicketMarketplace`   | `NEXT_PUBLIC_MARKETPLACE_ADDR`     | Resale marketplace.                               |
| `TicketVerifier`      | `NEXT_PUBLIC_VERIFIER_ADDR`        | Read-only "is this ticket valid?" helper.         |

---

### `Ticket.sol` — the NFT contract

This is a standard **ERC-721 Enumerable** NFT contract from OpenZeppelin.

- Each ticket is a token with a unique `tokenId` (0, 1, 2, ...).
- A mapping `ticketToEventId[tokenId] => eventId` permanently binds each ticket NFT to the event it was minted for.
- Only the **owner** of this contract can call `mint(...)`. After deployment, ownership is transferred to `EventManager`, so only the event manager can create new tickets.
- `tokensOfOwner(address)` lets the frontend list every ticket a wallet holds — that's what powers the "My Tickets" page.

Key state on-chain:
- `_owners[tokenId] => address` (who currently owns each ticket)
- `ticketToEventId[tokenId] => uint256` (which event it belongs to)
- `_nextTokenId` (auto-incrementing counter)

### `EventManager.sol` — primary market

- Holds an immutable reference to the `Ticket` contract address.
- Anyone can call `createEvent(name, date, totalTickets, initialPrice)`. The caller becomes that event's `organizer` (gets paid for primary sales).
- `buyPrimaryTicket(eventId)` is `payable`: a fan sends ETH, `EventManager` calls `Ticket.mint(buyer, eventId)`, and forwards the ETH to the organizer.
- Stores all events in `mapping(uint256 => Event) _events` keyed by an auto-incrementing `nextEventId`.

### `TicketMarketplace.sol` — secondary market

- Independent of `EventManager`; it only knows about the `Ticket` contract.
- A seller must **first** call `Ticket.approve(marketplaceAddress, ticketId)` (or `setApprovalForAll`) so the marketplace is allowed to move their NFT.
- `listTicket(ticketId, price)` records a `Listing { seller, price, isListed }`.
- `buyTicket(ticketId)` is `payable`: it calls `Ticket.transferFrom(seller, buyer, ticketId)` and pays the seller.
- `updatePrice` / `cancelListing` for sellers to manage their listings.

### `TicketVerifier.sol` — read-only validator

- Pure view contract. Combines a lookup in `Ticket` and `EventManager` to answer "is ticket #N legitimately for event #M?"
- Useful at the venue door, or for a "verified" badge in the UI.

---

## 2. How they're wired together on-chain

After deployment, each contract holds the **address** of the others it depends on:

```
Ticket  ◀──── owned by ──── EventManager ────▶ knows Ticket address
   ▲                                                 (set in constructor)
   │
   │ knows Ticket address
   │
TicketMarketplace ──── transferFrom() ───▶ Ticket
                                                 ▲
TicketVerifier ──── reads ──── Ticket            │
       └─────── reads ──── EventManager ─────────┘
```

Concretely:

1. Deploy `Ticket` → get `TICKET_ADDR`.
2. Deploy `EventManager(TICKET_ADDR)` → it stores `TICKET_ADDR` as `ticketContract`.
3. Call `Ticket.transferOwnership(EVENT_MGR_ADDR)` — now only `EventManager` can mint.
4. Deploy `TicketMarketplace(TICKET_ADDR)`.
5. Deploy `TicketVerifier(TICKET_ADDR, EVENT_MGR_ADDR)`.

Once that's done the addresses are baked in (they're `immutable`), so no further configuration is needed.

---

## 3. What's actually stored on the blockchain

There is **no list of "all events"** sitting on Sepolia as a single object. Events and tickets are stored as **mappings** inside the contract storage at each address.

### The "chain" of events

Inside `EventManager` (at `EVENT_MGR_ADDR`):

```
nextEventId = 3                       ◀── counter, increments on each createEvent

_events[0] = { name: "Coachella",  date: ..., organizer: 0xAlice, ... }
_events[1] = { name: "Tomorrowland", date: ..., organizer: 0xBob,   ... }
_events[2] = { name: "Lollapalooza", date: ..., organizer: 0xCarol, ... }
```

So there is exactly **one address that holds all events** (the EventManager address). Each event is identified by its `eventId` (0, 1, 2, …). The frontend gets the full list with `getAllEvents()`, which loops `0..nextEventId` and returns the structs.

Every `createEvent` call also emits an `EventCreated` event log — those logs sit in the block's receipts forever and are how indexers / The Graph would crawl history.

### The "chain" of tickets per event

Tickets are NFTs living in the **Ticket contract** (at `TICKET_ADDR`). They aren't stored *inside* an event — instead each ticket has a pointer back to the event it belongs to:

```
                    Ticket contract storage
   tokenId   _owners[tokenId]        ticketToEventId[tokenId]
   ───────   ──────────────────      ────────────────────────
      0      0xFanA                    0    ◀── ticket for event 0
      1      0xFanB                    0    ◀── ticket for event 0
      2      0xFanA                    1    ◀── ticket for event 1
      3      0xFanC                    2    ◀── ticket for event 2
      4      0xFanD                    0    ◀── ticket for event 0
```

So if you want "all tickets for event 1", you scan `ticketToEventId` and collect the matching `tokenId`s. Each ticket also has an owner address (the wallet currently holding it), which can change when someone resells through the marketplace.

A ticket's identity on-chain is the pair **(Ticket contract address, tokenId)** — that's literally what an NFT is. Two NFTs at different contracts can both have `tokenId = 0` and be totally unrelated.

### The full picture

```
Sepolia blockchain
│
├── 0xTICKET_ADDR  (Ticket contract)
│      _owners:           tokenId → wallet
│      ticketToEventId:   tokenId → eventId
│      _nextTokenId:      counter
│
├── 0xEVENT_MGR_ADDR  (EventManager contract)
│      _events:           eventId → { name, date, organizer, … }
│      nextEventId:       counter
│      ticketContract:    0xTICKET_ADDR  (immutable pointer)
│
├── 0xMARKETPLACE_ADDR  (TicketMarketplace contract)
│      listings:          tokenId → { seller, price, isListed }
│      ticketContract:    0xTICKET_ADDR  (immutable pointer)
│
└── 0xVERIFIER_ADDR  (TicketVerifier contract)
       ticketContract:    0xTICKET_ADDR
       eventManager:      0xEVENT_MGR_ADDR
```

Every address above is just a slot of state on Sepolia. When wagmi (via the Alchemy RPC) calls `getEvent(1)`, it's literally telling a Sepolia node "execute the `getEvent` function on contract `0xEVENT_MGR_ADDR` with argument `1`" — the node reads its own copy of that storage slot and returns the answer.

---

## 4. Lifecycle of a single ticket

Walking through what happens on-chain when a ticket is bought, resold, and verified:

1. **Organizer creates an event**
   - `EventManager.createEvent("My Show", ...)` from wallet `0xAlice`.
   - Storage: `_events[0] = { organizer: 0xAlice, totalTickets: 100, ... }`, `nextEventId = 1`.
   - Log: `EventCreated(0, 0xAlice, ...)`.

2. **Fan buys primary ticket**
   - `EventManager.buyPrimaryTicket(0)` with `value = 0.01 ETH` from `0xFan`.
   - `EventManager` calls `Ticket.mint(0xFan, 0)`:
     - `Ticket._owners[0] = 0xFan`
     - `Ticket.ticketToEventId[0] = 0`
     - `Ticket._nextTokenId = 1`
   - 0.01 ETH is forwarded from `EventManager` to `0xAlice` in the same transaction.
   - Logs: `TicketMinted`, `Transfer` (ERC-721 standard), `PrimaryTicketSold`.

3. **Fan lists the ticket for resale**
   - `Ticket.approve(MARKETPLACE_ADDR, 0)` — adds `0xFan → MARKETPLACE_ADDR` to the approvals mapping.
   - `TicketMarketplace.listTicket(0, 0.02 ETH)` — writes `listings[0] = { seller: 0xFan, price: 0.02 ETH, isListed: true }`.
   - The NFT itself **does not move**. Ownership is still `0xFan`. The marketplace just has permission.

4. **Another fan buys the resale**
   - `TicketMarketplace.buyTicket(0)` with `value = 0.02 ETH` from `0xFan2`.
   - Marketplace calls `Ticket.transferFrom(0xFan, 0xFan2, 0)` — `_owners[0]` flips to `0xFan2`.
   - 0.02 ETH is sent to `0xFan` in the same transaction.
   - `listings[0].isListed = false`.

5. **Door staff verifies**
   - `TicketVerifier.verifyTicket(0, 0)` → `true` (token exists, mapped to event 0, event exists).

All of this is atomic per transaction — if any step fails (e.g. the seller no longer owns the ticket), the whole transaction reverts and no state changes.

---

## 5. Why it's split into four contracts

- **Separation of concerns.** The NFT contract knows nothing about pricing or events — it just tracks ownership. That makes it reusable and easier to reason about.
- **Upgrade-friendly.** You could deploy a new marketplace contract with different fees and point the frontend at it without touching tickets or events.
- **Trust model.** `Ticket` ownership is locked to `EventManager` so randoms can't mint fake tickets, but the marketplace doesn't need privileged access — it works through the standard ERC-721 approval flow.
- **Gas/clarity.** Each contract has a focused storage layout instead of one mega-contract with everything.
