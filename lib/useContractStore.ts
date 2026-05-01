"use client";

// ================================================================
// useContractStore
// Mirrors the StoreProvider interface but reads/writes real Sepolia
// contracts via wagmi. Used by StoreProvider when wallet is connected.
// ================================================================

import { useCallback } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  EVENT_MGR_CONTRACT,
  MARKETPLACE_CONTRACT,
  TICKET_CONTRACT,
} from "./contracts";
import type { Event, Ticket } from "@/app/_components/StoreProvider";

// ── Shape returned by EventManager.getAllEvents() ──────────────────
type ChainEvent = {
  name: string;
  date: bigint;
  totalTickets: bigint;
  ticketsMinted: bigint;
  initialPrice: bigint;
  organizer: `0x${string}`;
};

// ── Shape returned by TicketMarketplace.getListing() ──────────────
type ChainListing = {
  seller: `0x${string}`;
  price: bigint;
  isListed: boolean;
};

// ── Shape returned by TicketVerifier.ticketInfo() ─────────────────
// (exists_, owner, eventId)

function chainEventToStore(ev: ChainEvent, id: bigint): Event {
  return {
    id: id.toString(),
    name: ev.name,
    description: "",
    date: new Date(Number(ev.date) * 1000).toISOString(),
    managerId: ev.organizer.toLowerCase(),
    managerName: ev.organizer.slice(0, 6) + "…" + ev.organizer.slice(-4),
    createdAt: new Date().toISOString(),
    initialPrice: Number(formatEther(ev.initialPrice)),
    totalTickets: Number(ev.totalTickets),
    ticketsMinted: Number(ev.ticketsMinted),
  };
}

export function useContractStore() {
  const { address } = useAccount();

  // ── Read all events ──────────────────────────────────────────────
  const { data: allEventsData, refetch: refetchEvents } = useReadContract({
    ...EVENT_MGR_CONTRACT,
    functionName: "getAllEvents",
  });

  const events: Event[] = (() => {
    if (!allEventsData) return [];
    const [chainEvents, ids] = allEventsData as [ChainEvent[], bigint[]];
    return chainEvents.map((ev, i) => chainEventToStore(ev, ids[i]));
  })();

  // ── Read tickets owned by current user ──────────────────────────
  const { data: ownedTokenIds, refetch: refetchOwned } = useReadContract({
    ...TICKET_CONTRACT,
    functionName: "tokensOfOwner",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Build Ticket objects from owned token IDs.
  // We read each ticket's eventId from ticketToEventId mapping.
  // For listings we'd need per-token reads; we approximate with a
  // combined hook below.
  const myTokenIds: bigint[] = (ownedTokenIds as bigint[] | undefined) ?? [];

  // ── Write: createEvent ──────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();

  const createEventOnChain = useCallback(
    async (input: {
      name: string;
      date: string; // ISO string
      totalTickets: number;
      initialPrice: number; // in ETH
    }) => {
      const dateUnix = BigInt(
        Math.floor(new Date(input.date).getTime() / 1000),
      );
      const priceWei = parseEther(input.initialPrice.toString());
      const hash = await writeContractAsync({
        ...EVENT_MGR_CONTRACT,
        functionName: "createEvent",
        args: [input.name, dateUnix, BigInt(input.totalTickets), priceWei],
      });
      return hash;
    },
    [writeContractAsync],
  );

  // ── Write: buyPrimaryTicket ──────────────────────────────────────
  const buyPrimaryTicket = useCallback(
    async (eventId: string, priceEth: number) => {
      const hash = await writeContractAsync({
        ...EVENT_MGR_CONTRACT,
        functionName: "buyPrimaryTicket",
        args: [BigInt(eventId)],
        value: parseEther(priceEth.toString()),
      });
      return hash;
    },
    [writeContractAsync],
  );

  // ── Write: listTicket (approve + list) ──────────────────────────
  const listTicket = useCallback(
    async (tokenId: string, priceEth: number) => {
      // Step 1: approve marketplace
      await writeContractAsync({
        ...TICKET_CONTRACT,
        functionName: "approve",
        args: [MARKETPLACE_CONTRACT.address, BigInt(tokenId)],
      });
      // Step 2: list
      const hash = await writeContractAsync({
        ...MARKETPLACE_CONTRACT,
        functionName: "listTicket",
        args: [BigInt(tokenId), parseEther(priceEth.toString())],
      });
      return hash;
    },
    [writeContractAsync],
  );

  // ── Write: cancelListing ─────────────────────────────────────────
  const cancelListing = useCallback(
    async (tokenId: string) => {
      const hash = await writeContractAsync({
        ...MARKETPLACE_CONTRACT,
        functionName: "cancelListing",
        args: [BigInt(tokenId)],
      });
      return hash;
    },
    [writeContractAsync],
  );

  // ── Write: buySecondaryTicket ────────────────────────────────────
  const buySecondaryTicket = useCallback(
    async (tokenId: string, priceEth: number) => {
      const hash = await writeContractAsync({
        ...MARKETPLACE_CONTRACT,
        functionName: "buyTicket",
        args: [BigInt(tokenId)],
        value: parseEther(priceEth.toString()),
      });
      return hash;
    },
    [writeContractAsync],
  );

  return {
    events,
    myTokenIds,
    refetchEvents,
    refetchOwned,
    createEventOnChain,
    buyPrimaryTicket,
    listTicket,
    cancelListing,
    buySecondaryTicket,
    formatEther,
    parseEther,
  };
}
