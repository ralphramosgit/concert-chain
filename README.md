# Concert Chain — Frontend

A neon-purple / black themed concert ticket marketplace built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **Prisma + PostgreSQL** (auth only), and **lucide-react** icons.

The Solidity / on-chain layer is **not** wired up yet — events and tickets live in a client-side mock store (localStorage) so the UI can be exercised end-to-end. Swap `app/_components/StoreProvider.tsx` for contract calls when the chain backend is ready.

## Stack

| Concern       | Choice                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| Framework     | Next.js 16 App Router, React 19                                             |
| Styling       | Tailwind v4 + `app/globals.css` neon-purple design tokens                   |
| Icons         | `lucide-react`                                                              |
| Auth          | Email + bcrypt password, JWT cookie session via `jose`, Prisma + PostgreSQL |
| Authorization | `middleware.ts` (route gating by role)                                      |
| Mock data     | React context + `localStorage` (see `StoreProvider.tsx`)                    |
| Validation    | `zod`                                                                       |

## Routes

| Route               | Access             | Notes                                               |
| ------------------- | ------------------ | --------------------------------------------------- |
| `/`                 | redirect           | → `/events` if signed in, else `/signin`            |
| `/signin`           | public             | Bounces signed-in users to `/events`                |
| `/signup`           | public             | Role picker: Fan / Event Manager                    |
| `/events`           | authenticated      | List of `EventCard`s                                |
| `/events/[eventId]` | authenticated      | Ticket listings for that event + buy modal          |
| `/my-tickets`       | Fan only           | Owned tickets + edit-listing modal                  |
| `/create-event`     | Event Manager only | Create event + mint full ticket batch (count fixed) |

## Folder structure

```
app/
  layout.tsx                 Global shell (Navbar + providers)
  page.tsx                   Empty — middleware redirects
  globals.css                Neon-purple/black theme + design-system classes
  (auth)/
    signin/                  Server page + client form
    signup/                  Server page + client form with role picker
  events/
    page.tsx                 List of events
    [eventId]/page.tsx       Event detail + ticket listings + purchase modal
  my-tickets/page.tsx        Owned tickets + edit-ticket modal
  create-event/page.tsx      Event manager: create event + ticket batch
  _components/
    Navbar.tsx
    SessionProvider.tsx
    StoreProvider.tsx        Mock events/tickets store (swap for chain calls later)
    EventCard.tsx
    TicketCard.tsx
    Modal.tsx
lib/
  definitions.ts             zod schemas, Role/SessionPayload types
  session.ts                 JWT cookie session (jose) — server-only
  auth-actions.ts            "use server" signup/signin/signout
  prisma.ts                  Prisma client singleton
middleware.ts                Route gating by session role
prisma/schema.prisma         User table only (events/tickets stay off-DB until chain)
```

## Schema decisions (vs. the original brief)

The original spec had two parallel tables (Event Manager, Fans) plus redundant `publicTickets` / `publicEvents` arrays. Adjusted as follows:

- Single `User` table with `role: FAN | EVENT_MANAGER`.
- `User.walletAddress` (nullable) — reserved for future on-chain identity link.
- Event/Ticket data is **not** in Postgres for this pass — the chain is the source of truth. The mock client store mirrors the eventual on-chain shape:
  - `Event { id, name, description, date, managerId, managerName, createdAt }`
  - `Ticket { id, eventId, ownerId, ownerName, seatInfo, price, originalPrice, forSale, isUsed, createdAt }`
- `publicTickets` / `publicEvents` arrays were dropped — the same data is derivable through filters (`ticketsForSale`, `ticketsOwnedBy`).

## Getting started

1. Install Postgres locally (or point at any Postgres instance).
2. Copy env: `cp .env.example .env` then fill in:
   ```
   DATABASE_URL="postgresql://user:pass@localhost:5432/concert_chain?schema=public"
   SESSION_SECRET="$(openssl rand -base64 32)"
   ```
3. Push schema and start dev:
   ```
   npx prisma migrate dev --name init
   npm run dev
   ```
4. Open http://localhost:3000 → sign up as either a Fan or Event Manager.

## Where to plug in the Solidity backend

Replace the implementations inside `app/_components/StoreProvider.tsx`:

| Mock action                | On-chain replacement                                      |
| -------------------------- | --------------------------------------------------------- |
| `createEvent`              | Call event-factory contract → mint NFT tickets in a batch |
| `buyTicket`                | Call marketplace `buy(ticketId)` with payment             |
| `updateTicket`             | Call ticket NFT `setPrice` / `setForSale`                 |
| `events` / `tickets` reads | Read from contract events / view functions                |

The UI components consume the store through `useStore()` only — no other file needs to change when wiring the chain.
