// ── Core message types ────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on assistant messages when the model requested tool calls */
  tool_calls?: ToolCall[];
  /** Present on tool messages — links the result back to the call */
  tool_call_id?: string;
}

// ── Tool / function-calling types ─────────────────────────────────────────────

/** One function definition passed to the model in the `tools` array */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/** One tool call requested by the model in an assistant message */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments string — parse before calling the tool */
    arguments: string;
  };
}

/**
 * Events yielded by streamWithTools().
 * - `token`      — a streamed content token (display to user)
 * - `tool_calls` — the model wants to call one or more tools (batch, end of turn)
 */
export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_generating"; name: string }
  | { type: "tool_calls"; tool_calls: ToolCall[] };

// ── Client interface ──────────────────────────────────────────────────────────

export interface ModelClient {
  /** Non-streaming — returns the full response at once */
  chat(history: Message[], signal?: AbortSignal): Promise<string>;

  /** Streaming — yields content tokens as they arrive */
  stream(history: Message[], signal?: AbortSignal): AsyncGenerator<string>;

  /**
   * Streaming with function-calling support.
   * Yields `token` events for content and a single `tool_calls` event
   * (if finish_reason === "tool_calls") at the end of the turn.
   *
   * Optional — implement only on clients that support OpenAI function calling.
   * ConversationEngine checks for this before using it.
   */
  streamWithTools?(
    history: Message[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent>;
}
