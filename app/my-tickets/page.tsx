"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Ticket as TicketIcon, Loader2 } from "lucide-react";
import { useStore, type Ticket } from "../_components/StoreProvider";
import { useSession } from "../_components/SessionProvider";
import { TicketCard } from "../_components/TicketCard";
import { Modal } from "../_components/Modal";
import { useAccount } from "wagmi";
import { useContractStore } from "@/lib/useContractStore";

export default function MyTicketsPage() {
  const session = useSession();
  const { isConnected } = useAccount();
  const { events, ticketsOwnedBy, updateTicket } = useStore();
  const {
    myTokenIds,
    events: chainEvents,
    listTicket,
    cancelListing,
  } = useContractStore();

  // ── Chain mode ────────────────────────────────────────────────────
  // Build lightweight Ticket objects from owned token IDs.
  // eventId is stored on-chain as ticketToEventId; we show "Event #N".
  const chainTickets: Ticket[] = useMemo(
    () =>
      myTokenIds.map((id) => ({
        id: id.toString(),
        // map token → event via chainEvents order (index = eventId)
        eventId: id.toString(),
        ownerId: "",
        ownerName: "",
        seatInfo: `NFT Token #${id}`,
        price: 0,
        originalPrice: 0,
        forSale: false,
        isUsed: false,
        createdAt: new Date().toISOString(),
      })),
    [myTokenIds],
  );

  // ── Mock mode ─────────────────────────────────────────────────────
  const myMockTickets = useMemo(
    () => (session && !isConnected ? ticketsOwnedBy(session.userId) : []),
    [session, isConnected, ticketsOwnedBy],
  );

  const activeTickets = isConnected ? chainTickets : myMockTickets;

  const mockEventById = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, e])),
    [events],
  );

  // For chain mode: group all tokens under a single "On-Chain Tickets" section
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [txStatus, setTxStatus] = useState("");

  if (isConnected) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold cc-neon-text">My Tickets</h1>
          <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
            NFT tickets owned by your connected wallet.
          </p>
        </div>

        {chainTickets.length === 0 ? (
          <div className="cc-surface p-10 text-center">
            <TicketIcon
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: "var(--cc-neon-soft)" }}
            />
            <h3 className="text-lg font-semibold">No NFT tickets yet</h3>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--cc-text-muted)" }}
            >
              Head to the{" "}
              <Link href="/events" className="cc-link">
                events page
              </Link>{" "}
              to buy one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {chainTickets.map((t) => {
              // Find the matching on-chain event name if available
              const chainEvent = chainEvents[Number(t.id)] ?? null;
              return (
                <TicketCard
                  key={t.id}
                  ticket={{
                    ...t,
                    seatInfo: chainEvent
                      ? `${chainEvent.name} — Token #${t.id}`
                      : t.seatInfo,
                  }}
                  action={
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="cc-btn cc-btn-ghost w-full"
                    >
                      <Pencil className="w-4 h-4" /> Manage listing
                    </button>
                  }
                />
              );
            })}
          </div>
        )}

        <ChainListingModal
          ticket={editing}
          onClose={() => {
            setEditing(null);
            setTxStatus("");
          }}
          onList={async (tokenId, priceEth) => {
            setTxStatus("Waiting for MetaMask…");
            await listTicket(tokenId, priceEth);
            setTxStatus("Listed!");
          }}
          onCancel={async (tokenId) => {
            setTxStatus("Waiting for MetaMask…");
            await cancelListing(tokenId);
            setTxStatus("Listing cancelled.");
          }}
          txStatus={txStatus}
        />
      </div>
    );
  }

  // ── Mock / no-wallet mode ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of activeTickets) {
      if (!m.has(t.eventId)) m.set(t.eventId, []);
      m.get(t.eventId)!.push(t);
    }
    return Array.from(m.entries());
  }, [activeTickets]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold cc-neon-text">My Tickets</h1>
        <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
          Manage and resell the tickets you own.
        </p>
      </div>

      {activeTickets.length === 0 ? (
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
            const ev = mockEventById[eventId];
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

// ── Chain listing modal ───────────────────────────────────────────────────────
function ChainListingModal({
  ticket,
  onClose,
  onList,
  onCancel,
  txStatus,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onList: (tokenId: string, priceEth: number) => Promise<void>;
  onCancel: (tokenId: string) => Promise<void>;
  txStatus: string;
}) {
  const [price, setPrice] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleList() {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      setErr("Enter a valid price in ETH.");
      return;
    }
    if (!ticket) return;
    setBusy(true);
    setErr("");
    try {
      await onList(ticket.id, p);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!ticket) return;
    setBusy(true);
    setErr("");
    try {
      await onCancel(ticket.id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!ticket} onClose={onClose} title="Manage listing">
      {ticket && (
        <div className="space-y-4">
          <div className="cc-surface p-3 text-sm">
            <div style={{ color: "var(--cc-text-muted)" }}>Token</div>
            <div className="font-semibold">{ticket.seatInfo}</div>
          </div>

          <div>
            <label htmlFor="chain-price" className="cc-label">
              Listing price (ETH)
            </label>
            <input
              id="chain-price"
              type="number"
              min="0.0001"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="cc-input"
            />
          </div>

          {err && (
            <p className="text-xs" style={{ color: "var(--cc-danger)" }}>
              {err}
            </p>
          )}
          {txStatus && (
            <p className="text-xs" style={{ color: "var(--cc-text-muted)" }}>
              {txStatus}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="cc-btn cc-btn-ghost flex-1"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Cancel listing
            </button>
            <button
              type="button"
              onClick={handleList}
              disabled={busy}
              className="cc-btn cc-btn-primary flex-1"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              List for sale
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Mock edit modal ───────────────────────────────────────────────────────────
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
