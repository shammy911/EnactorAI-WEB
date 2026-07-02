import { SessionManager } from "@/lib/SessionManager";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("eai-session")?.value;
  if (!sessionId) {
    return NextResponse.json(
      { error: "No session. Please refresh the page." },
      { status: 401 },
    );
  }

  SessionManager.resetSession(sessionId);
  return NextResponse.json({ status: "ok" });
}
