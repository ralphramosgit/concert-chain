import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = ["/signin", "/signup"];
const FAN_ONLY = ["/my-tickets"];
const MANAGER_ONLY = ["/create-event"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip middleware for static & API auth handlers
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);

  // Auth pages: bounce signed-in users to /events
  if (PUBLIC_PATHS.includes(pathname)) {
    if (session) return NextResponse.redirect(new URL("/events", req.url));
    return NextResponse.next();
  }

  // Root → events (or signin)
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session ? "/events" : "/signin", req.url),
    );
  }

  // Everything else requires auth
  if (!session) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  if (FAN_ONLY.some((p) => pathname.startsWith(p)) && session.role !== "FAN") {
    return NextResponse.redirect(new URL("/events", req.url));
  }
  if (
    MANAGER_ONLY.some((p) => pathname.startsWith(p)) &&
    session.role !== "EVENT_MANAGER"
  ) {
    return NextResponse.redirect(new URL("/events", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
