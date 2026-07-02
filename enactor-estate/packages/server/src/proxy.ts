import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware that auto-assigns an `eai-session` cookie to every request.
 * This gives each browser tab/window a unique session ID without requiring login.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("eai-session");

  // If the session cookie already exists, pass through
  if (sessionCookie?.value) {
    return NextResponse.next();
  }

  // Generate a new UUID session ID
  const sessionId = crypto.randomUUID();

  const response = NextResponse.next();
  response.cookies.set("eai-session", sessionId, {
    httpOnly: true, // Session cookie for chat
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}

// Run proxy on all routes
export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|media/).*)",
  ],
};
