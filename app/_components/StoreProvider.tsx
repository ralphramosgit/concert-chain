"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { useContractStore } from "@/lib/useContractStore";

export type Event = {
  id: string;
  name: string;
  description: string;
  date: string; // ISO
  managerId: string;
  managerName: string;
  createdAt: string;
  // On-chain extras (undefined in mock mode)
  initialPrice?: number; // in ETH
  totalTickets?: number;
  ticketsMinted?: number;
};

export type Ticket = {
  id: string;
  eventId: string;
  ownerId: string;
  ownerName: string;
  seatInfo: string;
  price: number; // current asking price
  originalPrice: number;
  forSale: boolean;
  isUsed: boolean;
  createdAt: string;
};

type Store = {
  events: Event[];
  tickets: Ticket[];
};

type Ctx = {
  events: Event[];
  tickets: Ticket[];
  ticketsForEvent: (eventId: string) => Ticket[];
  ticketsForSale: (eventId: string) => Ticket[];
  ticketsOwnedBy: (userId: string) => Ticket[];
  createEvent: (input: {
    name: string;
    description: string;
    date: string;
    ticketCount: number;
    ticketPrice: number;
    managerId: string;
    managerName: string;
  }) => Event;
  buyTicket: (ticketId: string, buyer: { id: string; name: string }) => void;
  updateTicket: (
    ticketId: string,
    patch: { price?: number; forSale?: boolean },
  ) => void;
};

const STORAGE_KEY = "cc_mock_store_v1";

const defaultStore: Store = { events: [], tickets: [] };

const StoreContext = createContext<Ctx | null>(null);

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function seedStore(): Store {
  const managerId = "seed_manager";
  const managerName = "Demo Manager";
  const now = new Date();
  const ev1: Event = {
    id: genId("evt"),
    name: "Neon Pulse — Live in LA",
    description: "An electrifying night of synthwave and neon visuals.",
    date: new Date(now.getTime() + 14 * 86400000).toISOString(),
    managerId,
    managerName,
    createdAt: now.toISOString(),
  };
  const ev2: Event = {
    id: genId("evt"),
    name: "Midnight Echoes Tour",
    description: "Indie rock under the stars at the Open Air Arena.",
    date: new Date(now.getTime() + 30 * 86400000).toISOString(),
    managerId,
    managerName,
    createdAt: now.toISOString(),
  };
  const tickets: Ticket[] = [];
  for (let i = 0; i < 5; i++) {
    tickets.push({
      id: genId("tkt"),
      eventId: ev1.id,
      ownerId: managerId,
      ownerName: managerName,
      seatInfo: `Section A · Row ${i + 1} · Seat ${i + 5}`,
      price: 80,
      originalPrice: 80,
      forSale: true,
      isUsed: false,
      createdAt: now.toISOString(),
    });
  }
  for (let i = 0; i < 4; i++) {
    tickets.push({
      id: genId("tkt"),
      eventId: ev2.id,
      ownerId: managerId,
      ownerName: managerName,
      seatInfo: `GA · Standing ${i + 1}`,
      price: 60,
      originalPrice: 60,
      forSale: true,
      isUsed: false,
      createdAt: now.toISOString(),
    });
  }
  return { events: [ev1, ev2], tickets };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const chain = useContractStore();

  const [store, setStore] = useState<Store>(defaultStore);
  const [hydrated, setHydrated] = useState(false);

  // One-time hydration from localStorage on the client. This is the
  // canonical pattern for syncing with a browser-only storage API; the
  // ESLint rule below does not apply to legitimate external-store sync.
  useEffect(() => {
    let initial: Store;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      initial = raw ? (JSON.parse(raw) as Store) : seedStore();
    } catch {
      initial = seedStore();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(initial);
    setHydrated(true);
  }, []);

  // Persist on every change (after hydration only).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }, [store, hydrated]);

  const value: Ctx = {
    events: store.events,
    tickets: store.tickets,
    ticketsForEvent: (eventId) =>
      store.tickets.filter((t) => t.eventId === eventId),
    ticketsForSale: (eventId) =>
      store.tickets.filter(
        (t) => t.eventId === eventId && t.forSale && !t.isUsed,
      ),
    ticketsOwnedBy: (userId) =>
      store.tickets.filter((t) => t.ownerId === userId),

    createEvent: ({
      name,
      description,
      date,
      ticketCount,
      ticketPrice,
      managerId,
      managerName,
    }) => {
      const ev: Event = {
        id: genId("evt"),
        name,
        description,
        date,
        managerId,
        managerName,
        createdAt: new Date().toISOString(),
      };
      const newTickets: Ticket[] = Array.from(
        { length: ticketCount },
        (_, i) => ({
          id: genId("tkt"),
          eventId: ev.id,
          ownerId: managerId,
          ownerName: managerName,
          seatInfo: `Seat #${i + 1}`,
          price: ticketPrice,
          originalPrice: ticketPrice,
          forSale: true,
          isUsed: false,
          createdAt: new Date().toISOString(),
        }),
      );
      setStore((s) => ({
        events: [ev, ...s.events],
        tickets: [...s.tickets, ...newTickets],
      }));
      return ev;
    },

    buyTicket: (ticketId, buyer) => {
      setStore((s) => ({
        ...s,
        tickets: s.tickets.map((t) =>
          t.id === ticketId && t.forSale && !t.isUsed
            ? { ...t, ownerId: buyer.id, ownerName: buyer.name, forSale: false }
            : t,
        ),
      }));
    },

    updateTicket: (ticketId, patch) => {
      setStore((s) => ({
        ...s,
        tickets: s.tickets.map((t) =>
          t.id === ticketId ? { ...t, ...patch } : t,
        ),
      }));
    },
  };

  // ── Chain value: used when MetaMask is connected ─────────────────
  // Events come from the contract. Tickets are the user's owned NFTs
  // enriched with their on-chain eventId + marketplace listing data
  // (see useContractStore.myChainTickets).
  const chainValue: Ctx = {
    events: chain.events,
    tickets: chain.myChainTickets,
    ticketsForEvent: (eventId) =>
      chain.myChainTickets.filter((t) => t.eventId === eventId),
    ticketsForSale: (eventId) =>
      chain.myChainTickets.filter(
        (t) => t.eventId === eventId && t.forSale && !t.isUsed,
      ),
    ticketsOwnedBy: () => chain.myChainTickets,
    createEvent: () => {
      throw new Error("Use chain.createEventOnChain() directly");
    },
    buyTicket: () => {
      throw new Error("Use chain.buyPrimaryTicket() directly");
    },
    updateTicket: () => {
      throw new Error(
        "Use chain.listTicket() or chain.cancelListing() directly",
      );
    },
  };

  const activeValue = isConnected ? chainValue : value;

  return (
    <StoreContext.Provider value={activeValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
