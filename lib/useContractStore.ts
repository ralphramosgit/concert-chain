"use client";

// ================================================================
// useContractStore
// Mirrors the StoreProvider interface but reads/writes real Sepolia
// contracts via wagmi. Used by StoreProvider when wallet is connected.
// ================================================================

import { useCallback } from "react";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useAccount,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
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
  const config = useConfig();

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

  // ── Per-token reads: eventId for each owned token ──────────────
  const { data: tokenEventIds, refetch: refetchTokenEventIds } =
    useReadContracts({
      contracts: myTokenIds.map((id) => ({
        address: TICKET_CONTRACT.address,
        abi: TICKET_CONTRACT.abi,
        functionName: "ticketToEventId",
        args: [id],
      })) as readonly {
        address: `0x${string}`;
        abi: unknown;
        functionName: string;
        args: readonly unknown[];
      }[] as never,
      query: { enabled: myTokenIds.length > 0 },
    });

  // ── Per-token reads: marketplace listing for each owned token ─────
  const { data: tokenListings, refetch: refetchListings } = useReadContracts({
    contracts: myTokenIds.map((id) => ({
      address: MARKETPLACE_CONTRACT.address,
      abi: MARKETPLACE_CONTRACT.abi,
      functionName: "getListing",
      args: [id],
    })) as readonly {
      address: `0x${string}`;
      abi: unknown;
      functionName: string;
      args: readonly unknown[];
    }[] as never,
    query: { enabled: myTokenIds.length > 0 },
  });

  // ── Is the marketplace already approved-for-all by the user? ─────
  const { data: isMarketApproved, refetch: refetchApproval } = useReadContract({
    ...TICKET_CONTRACT,
    functionName: "isApprovedForAll",
    args: address ? [address, MARKETPLACE_CONTRACT.address] : undefined,
    query: { enabled: !!address },
  });

  // ── Build enriched Ticket objects for the connected user ─────────
  const myChainTickets: Ticket[] = myTokenIds.map((id, i) => {
    const eventIdEntry = (
      tokenEventIds as
        | readonly { result?: unknown; status?: string }[]
        | undefined
    )?.[i];
    const listingEntry = (
      tokenListings as
        | readonly { result?: unknown; status?: string }[]
        | undefined
    )?.[i];
    const eventIdRaw = eventIdEntry?.result as bigint | undefined;
    const listing = listingEntry?.result as
      | readonly [`0x${string}`, bigint, boolean]
      | undefined;
    const eventId = eventIdRaw !== undefined ? eventIdRaw.toString() : "";
    const isListed = listing?.[2] ?? false;
    const priceWei = listing?.[1] ?? BigInt(0);
    const priceEth = priceWei > BigInt(0) ? Number(formatEther(priceWei)) : 0;
    return {
      id: id.toString(),
      eventId,
      ownerId: address?.toLowerCase() ?? "",
      ownerName: address ? address.slice(0, 6) + "…" + address.slice(-4) : "",
      seatInfo: `NFT Token #${id}`,
      price: priceEth,
      originalPrice: priceEth,
      forSale: isListed,
      isUsed: false,
      createdAt: new Date().toISOString(),
    };
  });

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
      await waitForTransactionReceipt(config, { hash });
      await refetchEvents();
      return hash;
    },
    [writeContractAsync, config, refetchEvents],
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
      // Wait for the tx to be mined, then refresh on-chain reads so
      // the events list and the user's owned tokens both reflect the
      // new mint.
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([refetchEvents(), refetchOwned()]);
      return hash;
    },
    [writeContractAsync, config, refetchEvents, refetchOwned],
  );

  // ── Write: listTicket (approve + list) ──────────────────────────
  // ── Write: listTicket ───────────────────────────────────────────
  // Uses setApprovalForAll once per wallet so subsequent listings
  // require ONLY a single transaction. The optional onStep callback
  // lets the UI report progress through the multi-step flow.
  const listTicket = useCallback(
    async (
      tokenId: string,
      priceEth: number,
      onStep?: (msg: string) => void,
    ) => {
      // One-time approval for the marketplace operator.
      if (!isMarketApproved) {
        onStep?.("Approving marketplace (one-time)… confirm in wallet");
        const approveHash = await writeContractAsync({
          ...TICKET_CONTRACT,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_CONTRACT.address, true],
        });
        onStep?.("Waiting for approval to confirm on-chain…");
        await waitForTransactionReceipt(config, { hash: approveHash });
        await refetchApproval();
      }
      onStep?.("Listing ticket… confirm in wallet");
      const hash = await writeContractAsync({
        ...MARKETPLACE_CONTRACT,
        functionName: "listTicket",
        args: [BigInt(tokenId), parseEther(priceEth.toString())],
      });
      onStep?.("Waiting for listing to confirm on-chain…");
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([refetchOwned(), refetchListings()]);
      return hash;
    },
    [
      writeContractAsync,
      config,
      isMarketApproved,
      refetchApproval,
      refetchOwned,
      refetchListings,
    ],
  );

  // ── Write: cancelListing ─────────────────────────────────────────
  const cancelListing = useCallback(
    async (tokenId: string) => {
      const hash = await writeContractAsync({
        ...MARKETPLACE_CONTRACT,
        functionName: "cancelListing",
        args: [BigInt(tokenId)],
      });
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([refetchOwned(), refetchListings()]);
      return hash;
    },
    [writeContractAsync, config, refetchOwned, refetchListings],
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
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([refetchOwned(), refetchListings()]);
      return hash;
    },
    [writeContractAsync, config, refetchOwned, refetchListings],
  );

  return {
    events,
    myTokenIds,
    myChainTickets,
    refetchEvents,
    refetchOwned,
    refetchTokenEventIds,
    refetchListings,
    createEventOnChain,
    buyPrimaryTicket,
    listTicket,
    cancelListing,
    buySecondaryTicket,
    formatEther,
    parseEther,
  };
}

// ============================================================================
// useEventListings(eventId)
// Returns the active marketplace listings (secondary resale tickets) for a
// given event, plus a refetch fn. Implemented by enumerating every minted
// token, reading its eventId + listing, and filtering down. Fine for the small
// scale of this demo; for production, index via events / a subgraph instead.
// ============================================================================
export function useEventListings(eventId: string | undefined) {
  const { address } = useAccount();

  const { data: totalMintedData, refetch: refetchTotalMinted } =
    useReadContract({
      ...TICKET_CONTRACT,
      functionName: "totalMinted",
    });

  const totalMinted = Number(
    (totalMintedData as bigint | undefined) ?? BigInt(0),
  );
  const allTokenIds = Array.from({ length: totalMinted }, (_, i) => BigInt(i));

  const { data: tokenEventIds, refetch: refetchTokenEventIds } =
    useReadContracts({
      contracts: allTokenIds.map((id) => ({
        address: TICKET_CONTRACT.address,
        abi: TICKET_CONTRACT.abi,
        functionName: "ticketToEventId",
        args: [id],
      })) as readonly {
        address: `0x${string}`;
        abi: unknown;
        functionName: string;
        args: readonly unknown[];
      }[] as never,
      query: { enabled: totalMinted > 0 && !!eventId },
    });

  const { data: tokenListings, refetch: refetchTokenListings } =
    useReadContracts({
      contracts: allTokenIds.map((id) => ({
        address: MARKETPLACE_CONTRACT.address,
        abi: MARKETPLACE_CONTRACT.abi,
        functionName: "getListing",
        args: [id],
      })) as readonly {
        address: `0x${string}`;
        abi: unknown;
        functionName: string;
        args: readonly unknown[];
      }[] as never,
      query: { enabled: totalMinted > 0 && !!eventId },
    });

  const listings: Ticket[] = (() => {
    if (!eventId || totalMinted === 0) return [];
    const evIds = tokenEventIds as readonly { result?: unknown }[] | undefined;
    const lstgs = tokenListings as readonly { result?: unknown }[] | undefined;
    if (!evIds || !lstgs) return [];

    const out: Ticket[] = [];
    for (let i = 0; i < totalMinted; i++) {
      const eid = evIds[i]?.result as bigint | undefined;
      const listing = lstgs[i]?.result as
        | readonly [`0x${string}`, bigint, boolean]
        | undefined;
      if (eid === undefined || !listing) continue;
      if (eid.toString() !== eventId) continue;
      const [seller, priceWei, isListed] = listing;
      if (!isListed) continue;
      const priceEth = Number(formatEther(priceWei));
      out.push({
        id: i.toString(),
        eventId: eid.toString(),
        ownerId: seller.toLowerCase(),
        ownerName: seller.slice(0, 6) + "…" + seller.slice(-4),
        seatInfo: `NFT Token #${i}`,
        price: priceEth,
        originalPrice: priceEth,
        forSale: true,
        isUsed: false,
        createdAt: new Date().toISOString(),
      });
    }
    return out;
  })();

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchTotalMinted(),
      refetchTokenEventIds(),
      refetchTokenListings(),
    ]);
  }, [refetchTotalMinted, refetchTokenEventIds, refetchTokenListings]);

  return {
    listings,
    currentAddress: address?.toLowerCase() ?? "",
    refetch,
  };
}
