"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ShoppingCart,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../../_components/StoreProvider";
import { useSession } from "../../_components/SessionProvider";
import { TicketCard } from "../../_components/TicketCard";
import { Modal } from "../../_components/Modal";
import { useAccount } from "wagmi";
import { useContractStore, useEventListings } from "@/lib/useContractStore";

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const session = useSession();
  const { isConnected } = useAccount();
  const { events, ticketsForSale, buyTicket } = useStore();
  const { buyPrimaryTicket, buySecondaryTicket } = useContractStore();
  const {
    listings: secondaryListings,
    currentAddress,
    refetch: refetchSecondaryListings,
  } = useEventListings(params.eventId);

  // Only Fan accounts may purchase tickets. Managers can browse but
  // never see a buy button.
  const canBuy = session?.role === "FAN";

  const event = useMemo(
    () => events.find((e) => e.id === params.eventId),
    [events, params.eventId],
  );
  const tickets = useMemo(
    () => (event ? ticketsForSale(event.id) : []),
    [event, ticketsForSale],
  );

  const [purchaseTicketId, setPurchaseTicketId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [txError, setTxError] = useState("");

  if (!event) {
    return (
      <div className="cc-surface p-10 text-center">
        <AlertTriangle
          className="w-10 h-10 mx-auto mb-3"
          style={{ color: "var(--cc-danger)" }}
        />
        <h2 className="text-lg font-semibold">Event not found</h2>
        <Link href="/events" className="cc-link mt-3 inline-block">
          Back to events
        </Link>
      </div>
    );
  }

  const ticketToBuy = tickets.find((t) => t.id === purchaseTicketId) ?? null;

  async function confirmPurchase() {
    if (!session || !purchaseTicketId || !event) return;
    if (!canBuy) {
      setTxError("Only Fan accounts can purchase tickets.");
      return;
    }
    setPurchasing(true);
    setTxError("");

    if (isConnected) {
      try {
        if (purchaseTicketId.startsWith("primary")) {
          const priceEth = event.initialPrice ?? 0;
          await buyPrimaryTicket(event.id, priceEth);
          setPurchasedId("primary");
        } else {
          // Secondary purchase: purchaseTicketId is the tokenId.
          const listing = secondaryListings.find(
            (l) => l.id === purchaseTicketId,
          );
          if (!listing) throw new Error("Listing no longer available");
          await buySecondaryTicket(listing.id, listing.price);
          await refetchSecondaryListings();
          setPurchasedId(listing.id);
        }
        setPurchaseTicketId(null);
      } catch (err: unknown) {
        setTxError(err instanceof Error ? err.message : "Transaction failed");
      } finally {
        setPurchasing(false);
      }
      return;
    }

    // Mock fallback
    const ticketToBuy = tickets.find((t) => t.id === purchaseTicketId);
    if (!ticketToBuy) {
      setPurchasing(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
    buyTicket(ticketToBuy.id, { id: session.userId, name: session.name });
    setPurchasing(false);
    setPurchasedId(ticketToBuy.id);
    setPurchaseTicketId(null);
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/events")}
        className="cc-btn cc-btn-ghost !px-3 !py-2"
      >
        <ArrowLeft className="w-4 h-4" /> All events
      </button>

      <header className="cc-surface-glow p-6">
        <h1 className="text-3xl font-bold cc-neon-text">{event.name}</h1>
        <p className="mt-2" style={{ color: "var(--cc-text-muted)" }}>
          {event.description}
        </p>
        <div
          className="flex items-center gap-2 mt-4 text-sm"
          style={{ color: "var(--cc-text-dim)" }}
        >
          <Calendar className="w-4 h-4" />
          {new Date(event.date).toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          <span className="mx-2">·</span>
          <span>Hosted by {event.managerName}</span>
        </div>
      </header>

      {/* ── On-chain: render one card per remaining (un-minted) ticket ── */}
      {isConnected ? (
        (() => {
          const total = event.totalTickets ?? 0;
          const minted = event.ticketsMinted ?? 0;
          const remaining = Math.max(total - minted, 0);
          const resaleCount = secondaryListings.length;
          const totalForSale = remaining + resaleCount;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Tickets for sale</h2>
                <span className="cc-badge cc-badge-muted">
                  {totalForSale} of {total} available
                </span>
              </div>

              {!canBuy && (
                <div
                  className="cc-surface p-4 text-sm"
                  style={{ color: "var(--cc-text-muted)" }}
                >
                  Only Fan accounts can purchase tickets.
                </div>
              )}

              {purchasedId && (
                <div
                  className="cc-surface p-4 flex items-center gap-3"
                  style={{ borderColor: "rgba(56, 245, 177, 0.4)" }}
                >
                  <span className="cc-badge cc-badge-success">Success</span>
                  <span className="text-sm">
                    NFT ticket transferred to your wallet. Find it under{" "}
                    <Link href="/my-tickets" className="cc-link">
                      My Tickets
                    </Link>
                    .
                  </span>
                </div>
              )}

              {totalForSale === 0 ? (
                <div
                  className="cc-surface p-8 text-center text-sm"
                  style={{ color: "var(--cc-text-muted)" }}
                >
                  No tickets currently for sale.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Primary (un-minted) tickets */}
                  {Array.from({ length: remaining }).map((_, i) => {
                    const slotNumber = minted + i + 1;
                    const priceEth = event.initialPrice ?? 0;
                    const primaryTicket = {
                      id: `primary:${slotNumber}`,
                      eventId: event.id,
                      ownerId: "",
                      ownerName: "",
                      seatInfo: `Ticket #${slotNumber}`,
                      price: priceEth,
                      originalPrice: priceEth,
                      forSale: true,
                      isUsed: false,
                      createdAt: new Date().toISOString(),
                    };
                    return (
                      <TicketCard
                        key={`primary-${slotNumber}`}
                        ticket={primaryTicket}
                        event={event}
                        action={
                          <button
                            type="button"
                            disabled={!canBuy}
                            onClick={() =>
                              setPurchaseTicketId(`primary:${slotNumber}`)
                            }
                            className="cc-btn cc-btn-primary w-full"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {canBuy ? "Buy ticket" : "Fans only"}
                          </button>
                        }
                      />
                    );
                  })}

                  {/* Secondary (resale) listings */}
                  {secondaryListings.map((t) => {
                    const isOwn = t.ownerId === currentAddress;
                    return (
                      <TicketCard
                        key={`resale-${t.id}`}
                        ticket={t}
                        event={event}
                        action={
                          <button
                            type="button"
                            disabled={isOwn || !canBuy}
                            onClick={() => setPurchaseTicketId(t.id)}
                            className="cc-btn cc-btn-primary w-full"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {!canBuy
                              ? "Fans only"
                              : isOwn
                                ? "You own this"
                                : "Buy ticket"}
                          </button>
                        }
                      />
                    );
                  })}
                </div>
              )}
              {txError && (
                <p className="text-xs" style={{ color: "var(--cc-danger)" }}>
                  {txError}
                </p>
              )}
            </div>
          );
        })()
      ) : (
        /* ── Mock mode: ticket cards ── */
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tickets for sale</h2>
            <span className="cc-badge cc-badge-muted">
              {tickets.length} available
            </span>
          </div>

          {purchasedId && (
            <div
              className="cc-surface p-4 flex items-center gap-3"
              style={{ borderColor: "rgba(56, 245, 177, 0.4)" }}
            >
              <span className="cc-badge cc-badge-success">Success</span>
              <span className="text-sm">
                Ticket purchased. Find it under{" "}
                <Link href="/my-tickets" className="cc-link">
                  My Tickets
                </Link>
                .
              </span>
            </div>
          )}

          {tickets.length === 0 ? (
            <div
              className="cc-surface p-8 text-center text-sm"
              style={{ color: "var(--cc-text-muted)" }}
            >
              No tickets currently for sale.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tickets.map((t) => {
                const isOwn = session?.userId === t.ownerId;
                return (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    event={event}
                    action={
                      <button
                        type="button"
                        disabled={isOwn || !canBuy}
                        onClick={() => setPurchaseTicketId(t.id)}
                        className="cc-btn cc-btn-primary w-full"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {!canBuy
                          ? "Fans only"
                          : isOwn
                            ? "You own this"
                            : "Buy ticket"}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!purchaseTicketId}
        onClose={() => !purchasing && setPurchaseTicketId(null)}
        title="Confirm purchase"
      >
        <div className="space-y-4">
          {(() => {
            // Derive the seat label and price for the modal preview based
            // on whether this is a primary mint, a chain resale, or a
            // mock-mode ticket.
            let seatLabel = "—";
            let priceLabel = "—";
            let kindLabel: string | null = null;
            if (purchaseTicketId) {
              if (isConnected) {
                if (purchaseTicketId.startsWith("primary:")) {
                  const slot = purchaseTicketId.split(":")[1];
                  seatLabel = `Ticket #${slot}`;
                  priceLabel =
                    event.initialPrice !== undefined
                      ? `${event.initialPrice} ETH`
                      : "—";
                  kindLabel = "Primary";
                } else {
                  const l = secondaryListings.find(
                    (x) => x.id === purchaseTicketId,
                  );
                  if (l) {
                    seatLabel = l.seatInfo;
                    priceLabel = `${l.price} ETH`;
                    kindLabel = "Resale";
                  }
                }
              } else {
                const t = tickets.find((x) => x.id === purchaseTicketId);
                if (t) {
                  seatLabel = t.seatInfo;
                  priceLabel = `${t.price} ETH`;
                }
              }
            }
            return (
              <div className="cc-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className="text-[0.65rem] uppercase tracking-wider"
                      style={{ color: "var(--cc-text-dim)" }}
                    >
                      Event
                    </div>
                    <div className="text-base font-semibold leading-tight">
                      {event.name}
                    </div>
                    <div
                      className="flex items-center gap-1.5 mt-1 text-xs"
                      style={{ color: "var(--cc-text-muted)" }}
                    >
                      <Calendar className="w-3 h-3" />
                      {new Date(event.date).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {kindLabel && (
                    <span className="cc-badge cc-badge-muted">{kindLabel}</span>
                  )}
                </div>
                <div className="cc-divider !my-1" />
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs uppercase tracking-wider"
                    style={{ color: "var(--cc-text-dim)" }}
                  >
                    Seat
                  </span>
                  <span className="text-sm font-semibold">{seatLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm"
                    style={{ color: "var(--cc-text-muted)" }}
                  >
                    Total
                  </span>
                  <span className="text-2xl font-bold cc-neon-text">
                    {priceLabel}
                  </span>
                </div>
              </div>
            );
          })()}
          <p className="text-xs" style={{ color: "var(--cc-text-dim)" }}>
            Payment will be settled on-chain. Once confirmed, the ticket
            transfers to your wallet.
          </p>
          {txError && (
            <p className="text-xs" style={{ color: "var(--cc-danger)" }}>
              {txError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPurchaseTicketId(null)}
              disabled={purchasing}
              className="cc-btn cc-btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPurchase}
              disabled={purchasing}
              className="cc-btn cc-btn-primary flex-1"
            >
              {purchasing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              {purchasing ? "Processing…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
