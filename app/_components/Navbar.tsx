import Link from "next/link";
import {
  Ticket,
  LogOut,
  Calendar,
  PlusSquare,
  User as UserIcon,
} from "lucide-react";
import type { SessionPayload } from "@/lib/definitions";
import { signoutAction } from "@/lib/auth-actions";
import { WalletButton } from "./WalletButton";

export function Navbar({ session }: { session: SessionPayload | null }) {
  const isManager = session?.role === "EVENT_MANAGER";
  const isFan = session?.role === "FAN";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[rgba(7,5,13,0.7)] border-b border-[var(--cc-border)]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href={session ? "/events" : "/signin"}
          className="flex items-center gap-2 group"
        >
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--cc-neon)]"
            style={{ boxShadow: "var(--cc-neon-glow)" }}
          >
            <Ticket
              className="w-5 h-5"
              style={{ color: "var(--cc-neon-soft)" }}
            />
          </span>
          <span className="text-lg font-bold tracking-tight cc-neon-text">
            Concert<span className="text-white">Chain</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {session && (
            <Link href="/events" className="cc-btn cc-btn-ghost !px-3 !py-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Events</span>
            </Link>
          )}
          {isFan && (
            <Link
              href="/my-tickets"
              className="cc-btn cc-btn-ghost !px-3 !py-2"
            >
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">My Tickets</span>
            </Link>
          )}
          {isManager && (
            <Link
              href="/create-event"
              className="cc-btn cc-btn-ghost !px-3 !py-2"
            >
              <PlusSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Create Event</span>
            </Link>
          )}

          <WalletButton />
          {session ? (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--cc-border)]">
                <UserIcon
                  className="w-4 h-4"
                  style={{ color: "var(--cc-neon-soft)" }}
                />
                <span className="text-sm">{session.name}</span>
                <span className="cc-badge !text-[0.6rem]">
                  {session.role === "EVENT_MANAGER" ? "Manager" : "Fan"}
                </span>
              </div>
              <form action={signoutAction}>
                <button
                  type="submit"
                  className="cc-btn cc-btn-ghost !px-3 !py-2"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className="cc-btn cc-btn-ghost">
                Sign in
              </Link>
              <Link href="/signup" className="cc-btn cc-btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
