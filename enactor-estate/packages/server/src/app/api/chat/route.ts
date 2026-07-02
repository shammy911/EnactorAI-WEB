import { SessionManager } from "@/lib/SessionManager";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Read the session cookie
    const sessionId = req.cookies.get("eai-session")?.value;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "No session. Please refresh the page." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Read the custom auth and url headers
    const emAuth = req.headers.get("x-em-auth");
    const emUrl = req.headers.get("x-em-url");

    // Pass the auth header to the SessionManager to validate and retrieve the session
    // Get the per-user engine with tools registered using that session's authToken
    const engine = SessionManager.prepareEngineForChat(
      sessionId,
      emAuth,
      emUrl,
    );

    // Create a ReadableStream that sends SSE events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of engine.send(message)) {
            let sseData: string;
            switch (event.type) {
              case "status":
                sseData = JSON.stringify({
                  type: "status",
                  content: event.content,
                });
                break;
              case "token":
                sseData = JSON.stringify({
                  type: "token",
                  content: event.content,
                });
                break;
              case "tool_start":
                sseData = JSON.stringify({
                  type: "tool_start",
                  name: event.name,
                  args: event.args,
                });
                break;
              case "tool_end":
                sseData = JSON.stringify({
                  type: "tool_end",
                  name: event.name,
                  result: event.result,
                });
                break;
              case "tool_generating":
                sseData = JSON.stringify({
                  type: "tool_generating",
                  name: event.name,
                });
                break;
              default:
                continue;
            }
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          }
          // Send done event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: errorMsg })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
