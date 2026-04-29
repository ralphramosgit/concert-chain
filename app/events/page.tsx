"use client";

import { useStore } from "../_components/StoreProvider";
import { EventCard } from "../_components/EventCard";
import { useSession } from "../_components/SessionProvider";
import { Calendar } from "lucide-react";
import Link from "next/link";

export default function EventsPage() {
  const { events, ticketsForEvent } = useStore();
  const session = useSession();

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold cc-neon-text">Upcoming events</h1>
          <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
            Browse and grab tickets — verified on-chain.
          </p>
        </div>
        {session?.role === "EVENT_MANAGER" && (
          <Link href="/create-event" className="cc-btn cc-btn-primary">
            <Calendar className="w-4 h-4" /> Create event
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              tickets={ticketsForEvent(ev.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="cc-surface p-10 text-center">
      <Calendar
        className="w-10 h-10 mx-auto mb-3"
        style={{ color: "var(--cc-neon-soft)" }}
      />
      <h3 className="text-lg font-semibold">No events yet</h3>
      <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
        Check back soon — event managers are cooking up something neon.
      </p>
    </div>
  );
}
