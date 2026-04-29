"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Sparkles } from "lucide-react";
import { useStore } from "../_components/StoreProvider";
import { useSession } from "../_components/SessionProvider";

type Errors = Partial<
  Record<
    "name" | "description" | "date" | "ticketCount" | "ticketPrice",
    string
  >
>;

export default function CreateEventPage() {
  const router = useRouter();
  const session = useSession();
  const { createEvent } = useStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [ticketCount, setTicketCount] = useState("100");
  const [ticketPrice, setTicketPrice] = useState("50");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 3) e.name = "Name must be at least 3 characters.";
    if (description.trim().length < 10)
      e.description = "Add a longer description (min 10 chars).";
    if (!date) e.date = "Pick an event date.";
    else if (new Date(date).getTime() < Date.now())
      e.date = "Date must be in the future.";
    const count = Number(ticketCount);
    if (!Number.isInteger(count) || count < 1 || count > 100000)
      e.ticketCount = "Enter a whole number between 1 and 100,000.";
    const price = Number(ticketPrice);
    if (!Number.isFinite(price) || price <= 0)
      e.ticketPrice = "Price must be greater than 0.";
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600)); // simulate chain mint
    const ev = createEvent({
      name: name.trim(),
      description: description.trim(),
      date: new Date(date).toISOString(),
      ticketCount: Number(ticketCount),
      ticketPrice: Number(ticketPrice),
      managerId: session.userId,
      managerName: session.name,
    });
    setSubmitting(false);
    router.push(`/events/${ev.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold cc-neon-text flex items-center gap-2">
          <Sparkles className="w-7 h-7" /> Create event
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--cc-text-muted)" }}>
          Mint a new event and its full set of tickets. Ticket count and price
          are fixed once created.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="cc-surface-glow p-6 space-y-5"
        noValidate
      >
        <div>
          <label htmlFor="ev-name" className="cc-label">
            Event name
          </label>
          <input
            id="ev-name"
            className="cc-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Neon Pulse — Live in LA"
          />
          {errors.name && <p className="cc-error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="ev-desc" className="cc-label">
            Description
          </label>
          <textarea
            id="ev-desc"
            className="cc-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What can fans expect?"
          />
          {errors.description && (
            <p className="cc-error">{errors.description}</p>
          )}
        </div>

        <div>
          <label htmlFor="ev-date" className="cc-label">
            Date & time
          </label>
          <div className="relative">
            <Calendar
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--cc-text-dim)" }}
            />
            <input
              id="ev-date"
              type="datetime-local"
              className="cc-input !pl-9"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {errors.date && <p className="cc-error">{errors.date}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ev-count" className="cc-label">
              Number of tickets
            </label>
            <input
              id="ev-count"
              type="number"
              min="1"
              step="1"
              className="cc-input"
              value={ticketCount}
              onChange={(e) => setTicketCount(e.target.value)}
            />
            <p
              className="text-[0.7rem] mt-1"
              style={{ color: "var(--cc-text-dim)" }}
            >
              Cannot be changed after the event is created.
            </p>
            {errors.ticketCount && (
              <p className="cc-error">{errors.ticketCount}</p>
            )}
          </div>
          <div>
            <label htmlFor="ev-price" className="cc-label">
              Ticket price (ETH)
            </label>
            <input
              id="ev-price"
              type="number"
              min="1"
              step="1"
              className="cc-input"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
            />
            <p
              className="text-[0.7rem] mt-1"
              style={{ color: "var(--cc-text-dim)" }}
            >
              All tickets ship at the same price. Fans can resell at their
              chosen price.
            </p>
            {errors.ticketPrice && (
              <p className="cc-error">{errors.ticketPrice}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="cc-btn cc-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cc-btn cc-btn-primary flex-1"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {submitting ? "Minting event..." : "Create event"}
          </button>
        </div>
      </form>
    </div>
  );
}
