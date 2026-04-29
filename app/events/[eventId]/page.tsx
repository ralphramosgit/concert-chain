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

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const session = useSession();
  const { events, ticketsForSale, buyTicket } = useStore();

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
    if (!session || !ticketToBuy) return;
    setPurchasing(true);
    // simulate on-chain settle
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
                action={
                  <button
                    type="button"
                    disabled={isOwn}
                    onClick={() => setPurchaseTicketId(t.id)}
                    className="cc-btn cc-btn-primary w-full"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {isOwn ? "You own this" : "Buy ticket"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}

      <Modal
        open={!!ticketToBuy}
        onClose={() => !purchasing && setPurchaseTicketId(null)}
        title="Confirm purchase"
      >
        {ticketToBuy && (
          <div className="space-y-4">
            <div className="cc-surface p-4">
              <div
                className="text-sm"
                style={{ color: "var(--cc-text-muted)" }}
              >
                {event.name}
              </div>
              <div className="font-semibold mt-1">{ticketToBuy.seatInfo}</div>
              <div className="cc-divider !my-3" />
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--cc-text-muted)" }}
                >
                  Total
                </span>
                <span className="text-2xl font-bold cc-neon-text">
                  {ticketToBuy.price} ETH
                </span>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--cc-text-dim)" }}>
              Payment will be settled on-chain. Once confirmed, the ticket
              transfers to your wallet.
            </p>
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
                {purchasing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
