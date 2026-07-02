import {
  Message,
  ModelClient,
  ToolCall,
  ToolDefinition,
} from "./ModelClient.js";
import { DebugLogger } from "./DebugLogger.js";

/** Callback that executes a tool by name and returns its result as a string */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string>;

export type EngineEvent =
  | { type: "token"; content: string }
  | { type: "tool_generating"; name: string }
  | { type: "tool_start"; name: string; args: string }
  | { type: "tool_end"; name: string; result: string }
  | { type: "status"; content: "thinking" | "typing" };

/** Safety cap — prevents runaway tool loops */
const MAX_TOOL_ROUNDS = 16;

export class ConversationEngine {
  private history: Message[] = [];
  private toolDefs: ToolDefinition[] = [];
  private toolExecutor: ToolExecutor | null = null;
  private systemPromptProvider?: () => Promise<string> | string;

  constructor(private client: ModelClient) {}

  updateClient(client: ModelClient): void {
    this.client = client;
    DebugLogger.log("ENGINE", "Client updated");
  }

  // ── Tool registration ────────────────────────────────────────────────────────

  /**
   * Register tool definitions and an executor.
   * Call this after connecting MCP servers (P2) — before the user's first message.
   * Calling again replaces the previous registration.
   */
  registerTools(tools: ToolDefinition[], executor: ToolExecutor): void {
    this.toolDefs = [...tools];
    this.toolExecutor = executor;
    DebugLogger.log("ENGINE", "Tools registered", {
      count: tools.length,
      names: tools.map((t) => t.function.name),
    });
  }

  /** Clear all registered tools (e.g. on reset or MCP disconnect) */
  clearTools(): void {
    this.toolDefs = [];
    this.toolExecutor = null;
    DebugLogger.log("ENGINE", "Tools cleared");
  }

  // ── History management ───────────────────────────────────────────────────────

  /**
   * Provide a callback that evaluates the system prompt dynamically
   * just before it's sent to the model.
   */
  setSystemPromptProvider(provider: () => Promise<string> | string): void {
    this.systemPromptProvider = provider;
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  setHistory(history: Message[]): void {
    this.history = [...history];
  }

  reset(): void {
    DebugLogger.log("ENGINE", "Conversation reset", {
      previousLength: this.history.length,
    });
    this.history = [];
    // Note: registered tools survive a reset — they come from MCP, not the conversation
  }

  // ── History management ───────────────────────────────────────────────────────

  async getEffectiveHistory(): Promise<Message[]> {
    if (this.systemPromptProvider) {
      const content = await this.systemPromptProvider();
      return [{ role: "system", content }, ...this.history];
    }
    return this.history;
  }

  /**
   * Send a user message and stream the response.
   *
   * If tools are registered AND the client supports streamWithTools(), this runs
   * an agentic loop:
   *   stream → tool_calls? → execute tools → stream again → … → final answer
   *
   * All content tokens from every round are yielded so the UI sees a continuous
   * stream. The user doesn't need to know about the tool rounds happening inside.
   */

  // Returns an async generator — caller streams tokens to the UI
  async *send(
    userInput: string,
    signal?: AbortSignal,
  ): AsyncGenerator<EngineEvent> {
    const rollbackLength = this.history.length;
    this.history.push({ role: "user", content: userInput });

    DebugLogger.log("ENGINE", "send() called", {
      historyLength: this.history.length,
      inputLength: userInput.length,
      toolsRegistered: this.toolDefs.length,
    });

    try {
      const effectiveHistory = await this.getEffectiveHistory();
      yield* this._agentLoop(signal);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      DebugLogger.log("ERROR", `send() error: ${msg}`);
      // Roll back the user message so history stays clean
      this.history.length = rollbackLength; // atomic rollback — removes everything added
      yield { type: "token", content: `\n[Error: ${msg}]` };
    }
  }

  // ── Non-streaming send ───────────────────────────────────────────────────────

  // Non-streaming version — returns the full response at once (no tool loop)
  async sendOnce(userInput: string, signal?: AbortSignal): Promise<string> {
    this.history.push({ role: "user", content: userInput });
    DebugLogger.log("ENGINE", "sendOnce() called", {
      historyLength: this.history.length,
      inputLength: userInput.length,
    });

    try {
      const effectiveHistory = await this.getEffectiveHistory();
      const response = await this.client.chat(effectiveHistory, signal);
      DebugLogger.log("ENGINE", "sendOnce() completed", {
        responseLength: response.length,
      });
      this.history.push({ role: "assistant", content: response });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      DebugLogger.log("ERROR", `sendOnce() error: ${msg}`);
      this.history.pop();
      throw err;
    }
  }

  // ── Private: agentic loop ────────────────────────────────────────────────────

  /**
   * Core agentic loop.
   *
   * Round 1+:
   *   - Stream model response (with tools if available)
   *   - If finish_reason === "tool_calls": execute tools, add results, loop
   *   - If finish_reason === "stop": push assistant message, done
   *
   * Falls back to plain streaming when:
   *   - No tools are registered, or
   *   - The client doesn't implement streamWithTools()
   */
  private async *_agentLoop(
    //effectiveHistory: Message[],
    signal?: AbortSignal,
  ): AsyncGenerator<EngineEvent> {
    const hasToolSupport =
      this.toolDefs.length > 0 &&
      this.toolExecutor !== null &&
      typeof this.client.streamWithTools === "function";

    if (!hasToolSupport) {
      yield* this._plainStream(signal);
      return;
    }

    for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
      const effectiveHistory = await this.getEffectiveHistory();

      DebugLogger.log("ENGINE", `Agent loop round ${round}`, {
        historyLength: this.history.length,
        tools: this.toolDefs.length,
      });

      // Tell the UI we're thinking before we start streaming tokens
      yield { type: "status", content: "thinking" };

      const collectedCalls: ToolCall[] = [];
      let fullContent = "";
      let isFirstToken = true; // Flag to track if the first token has been received

      // Stream model turn with tools enabled
      for await (const event of this.client.streamWithTools!(
        effectiveHistory,
        this.toolDefs,
        signal,
      )) {
        if (event.type === "token") {
          // Ignore empty or purely whitespace tokens sent right before tool calls
          if (isFirstToken && event.content.trim().length > 0) {
            yield { type: "status", content: "typing" }; // Notify UI that typing has started
            isFirstToken = false; // Reset the flag after the first token
          }

          fullContent += event.content;
          yield { type: "token", content: event.content };
        } else if (event.type === "tool_generating") {
          yield { type: "tool_generating", name: event.name };
        } else if (event.type === "tool_calls") {
          collectedCalls.push(...event.tool_calls);
        }
      }

      // No tool calls → model gave a final answer
      if (collectedCalls.length === 0) {
        if (isFirstToken && fullContent.trim().length === 0) {
          yield { type: "status", content: "typing" };
          fullContent =
            "\n\n⚠️ **Error**: The AI model crashed and returned an empty response. This usually means your local LLM hit its max context window (memory limit) while processing the tools. Please increase your model's Context Length to at least `32768` (32K) and try again.";
          yield { type: "token", content: fullContent };
        }
        this.history.push({ role: "assistant", content: fullContent });
        DebugLogger.log("ENGINE", "Agent loop done — no tool calls", { round });
        return;
      }

      // ① Push assistant message with the tool_calls request to both actual history and effectiveHistory
      const toolCallMsg: Message = {
        role: "assistant",
        content: fullContent,
        tool_calls: collectedCalls,
      };
      this.history.push(toolCallMsg);
      //effectiveHistory.push(toolCallMsg);

      DebugLogger.log(
        "ENGINE",
        `Executing ${collectedCalls.length} tool call(s)`,
        {
          round,
          names: collectedCalls.map((c) => c.function.name),
        },
      );

      // ② Execute each tool call and push the result
      for (const call of collectedCalls) {
        const toolName = call.function.name;
        const toolArgsRaw = call.function.arguments;
        let result: string;

        yield { type: "tool_start", name: toolName, args: toolArgsRaw };
        const endLog = DebugLogger.time("TOOL", `${toolName} executing`, {
          args: toolArgsRaw,
        });

        try {
          const args = JSON.parse(toolArgsRaw) as Record<string, unknown>;
          result = await this.toolExecutor!(toolName, args);
          endLog({ resultLength: result.length });

          // // Phase 4: Execute PostToolUse hooks (Blocking execution)
          // if (this.hookManager) {
          //   await this.hookManager.runPostToolUseHooks(toolName);
          // }
        } catch (err) {
          result = `Error executing ${toolName}: ${
            err instanceof Error ? err.message : String(err)
          }`;
          endLog({ error: result });
          DebugLogger.log("ERROR", `Tool execution failed: ${toolName}`, {
            error: result,
          });
        }

        const toolResultMsg: Message = {
          role: "tool",
          content: result,
          tool_call_id: call.id,
        };
        this.history.push(toolResultMsg);
        //effectiveHistory.push(toolResultMsg);
        yield { type: "tool_end", name: toolName, result };
      }

      // ③ Loop — model will now see the tool results and respond
    }

    // Reached the loop limit without a final answer
    DebugLogger.log("ENGINE", "Agent loop limit reached", {
      limit: MAX_TOOL_ROUNDS,
    });
    yield {
      type: "token",
      content: "\n[Tool loop limit reached — please rephrase your request]",
    };
  }

  /** Plain streaming with no tools — preserves original send() behaviour */
  private async *_plainStream(
    //effectiveHistory: Message[],
    signal?: AbortSignal,
  ): AsyncGenerator<EngineEvent> {
    const effectiveHistory = await this.getEffectiveHistory();
    let fullResponse = "";

    for await (const token of this.client.stream(effectiveHistory, signal)) {
      fullResponse += token;
      yield { type: "token", content: token };
    }

    DebugLogger.log("ENGINE", "Plain stream completed", {
      responseLength: fullResponse.length,
    });
    this.history.push({ role: "assistant", content: fullResponse });
  }
}
