"use client";

import {
  Ticket as TicketIcon,
  ShoppingCart,
  Pencil,
  BadgeCheck,
} from "lucide-react";
import type { Ticket } from "./StoreProvider";

export function TicketCard({
  ticket,
  action,
}: {
  ticket: Ticket;
  action?: React.ReactNode;
}) {
  return (
    <div className="cc-surface-glow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: "rgba(176, 38, 255, 0.12)",
              border: "1px solid var(--cc-border-strong)",
            }}
          >
            <TicketIcon
              className="w-4 h-4"
              style={{ color: "var(--cc-neon-soft)" }}
            />
          </span>
          <div>
            <div
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--cc-text-dim)" }}
            >
              Seat
            </div>
            <div className="text-sm font-semibold">{ticket.seatInfo}</div>
          </div>
        </div>

        {ticket.forSale ? (
          <span className="cc-badge cc-badge-success">
            <BadgeCheck className="w-3 h-3" /> For sale
          </span>
        ) : (
          <span className="cc-badge cc-badge-muted">Not listed</span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--cc-text-dim)" }}
          >
            Price
          </div>
          <div className="text-2xl font-bold cc-neon-text">{ticket.price} ETH</div>
          {ticket.price !== ticket.originalPrice && (
            <div
              className="text-[0.7rem]"
              style={{ color: "var(--cc-text-dim)" }}
            >
              Original: {ticket.originalPrice} ETH
            </div>
          )}
        </div>
        <div
          className="text-xs text-right"
          style={{ color: "var(--cc-text-muted)" }}
        >
          Owned by
          <div className="font-medium" style={{ color: "var(--cc-text)" }}>
            {ticket.ownerName}
          </div>
        </div>
      </div>

      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export const TicketCardIcons = { ShoppingCart, Pencil };
