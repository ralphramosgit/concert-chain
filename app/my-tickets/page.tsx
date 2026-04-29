"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Ticket as TicketIcon, Loader2 } from "lucide-react";
import { useStore, type Ticket } from "../_components/StoreProvider";
import { useSession } from "../_components/SessionProvider";
import { TicketCard } from "../_components/TicketCard";
import { Modal } from "../_components/Modal";

export default function MyTicketsPage() {
  const session = useSession();
  const { events, ticketsOwnedBy, updateTicket } = useStore();

  const myTickets = useMemo(
    () => (session ? ticketsOwnedBy(session.userId) : []),
    [session, ticketsOwnedBy],
  );

  const eventById = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, e])),
    [events],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of myTickets) {
      if (!m.has(t.eventId)) m.set(t.eventId, []);
      m.get(t.eventId)!.push(t);
    }
    return Array.from(m.entries());
  }, [myTickets]);

  const [editing, setEditing] = useState<Ticket | null>(null);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold cc-neon-text">My Tickets</h1>
        <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
          Manage and resell the tickets you own.
        </p>
      </div>

      {myTickets.length === 0 ? (
        <div className="cc-surface p-10 text-center">
          <TicketIcon
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: "var(--cc-neon-soft)" }}
          />
          <h3 className="text-lg font-semibold">No tickets yet</h3>
          <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
            Head to the{" "}
            <Link href="/events" className="cc-link">
              events page
            </Link>{" "}
            to grab one.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([eventId, list]) => {
            const ev = eventById[eventId];
            return (
              <section key={eventId}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-xl font-semibold">
                    {ev?.name ?? "Unknown event"}
                  </h2>
                  {ev && (
                    <Link href={`/events/${ev.id}`} className="cc-link text-sm">
                      View event
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {list.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      action={
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          className="cc-btn cc-btn-ghost w-full"
                        >
                          <Pencil className="w-4 h-4" /> Edit listing
                        </button>
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <EditTicketModal
        key={editing?.id ?? "none"}
        ticket={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateTicket(editing.id, patch);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditTicketModal({
  ticket,
  onClose,
  onSave,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onSave: (patch: { price: number; forSale: boolean }) => void;
}) {
  const [price, setPrice] = useState<string>(() =>
    ticket ? String(ticket.price) : "",
  );
  const [forSale, setForSale] = useState<boolean>(
    () => ticket?.forSale ?? false,
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave({ price: p, forSale });
    setSaving(false);
  }

  return (
    <Modal open={!!ticket} onClose={onClose} title="Edit ticket">
      {ticket && (
        <div className="space-y-4">
          <div className="cc-surface p-3 text-sm">
            <div style={{ color: "var(--cc-text-muted)" }}>Seat</div>
            <div className="font-semibold">{ticket.seatInfo}</div>
          </div>

          <div>
            <label htmlFor="price" className="cc-label">
              Asking price (ETH)
            </label>
            <input
              id="price"
              type="number"
              min="1"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="cc-input"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forSale}
              onChange={(e) => setForSale(e.target.checked)}
              className="w-4 h-4 accent-[var(--cc-neon)]"
            />
            <span className="text-sm">List this ticket for sale</span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cc-btn cc-btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cc-btn cc-btn-primary flex-1"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
