"use client";

import Link from "next/link";
import { Calendar, ArrowRight, TicketCheck } from "lucide-react";
import type { Event, Ticket } from "./StoreProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventCard({
  event,
  tickets,
}: {
  event: Event;
  tickets: Ticket[];
}) {
  const forSale = tickets.filter((t) => t.forSale && !t.isUsed).length;
  const minPrice =
    forSale > 0
      ? Math.min(
          ...tickets.filter((t) => t.forSale && !t.isUsed).map((t) => t.price),
        )
      : null;

  return (
    <Link
      href={`/events/${event.id}`}
      className="cc-surface-glow p-5 flex flex-col gap-3 group"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-tight group-hover:cc-neon-text transition">
          {event.name}
        </h3>
        <span className="cc-badge shrink-0">
          <TicketCheck className="w-3 h-3" />
          {forSale} for sale
        </span>
      </div>

      <p
        className="text-sm line-clamp-2"
        style={{ color: "var(--cc-text-muted)" }}
      >
        {event.description}
      </p>

      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--cc-text-dim)" }}
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{formatDate(event.date)}</span>
      </div>

      <div className="cc-divider !my-2" />

      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--cc-text-dim)" }}
          >
            From
          </div>
          <div className="font-bold cc-neon-text">
            {minPrice !== null ? `${minPrice} ETH` : "Sold out"}
          </div>
        </div>
        <span className="cc-btn cc-btn-ghost !py-2 !px-3 text-sm">
          View tickets
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
