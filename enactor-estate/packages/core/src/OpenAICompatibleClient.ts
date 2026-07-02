import { AppConfig } from "./Config";
import {
  Message,
  ModelClient,
  StreamEvent,
  ToolCall,
  ToolDefinition,
} from "./ModelClient";
import { DebugLogger } from "./DebugLogger.js";

// ── Request body ──────────────────────────────────────────────────────────────

interface RequestBody {
  model: string;
  messages: Message[];
  temperature: number;
  max_tokens: number;
  stream?: boolean;
  chat_template_kwargs: {
    enable_thinking: boolean;
  };
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | "required";
}

// ── Tool call delta accumulator ───────────────────────────────────────────────

interface ToolCallAccum {
  id: string;
  name: string;
  argsBuffer: string;
}

// ── Client ────────────────────────────────────────────────────────────────────

export class OpenAICompatibleClient implements ModelClient {
  private readonly url: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly enableThinking: boolean;

  constructor(config: AppConfig["model"]) {
    this.url = config.url;
    this.model = config.name;
    this.apiKey = config.api_key;
    this.temperature = config.temperature;
    this.maxTokens = config.max_tokens;
    this.enableThinking = config.enable_thinking;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildBody(
    history: Message[],
    stream: boolean,
    tools?: ToolDefinition[],
  ): RequestBody {
    const body: RequestBody = {
      model: this.model,
      messages: history,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream,
      chat_template_kwargs: {
        enable_thinking: this.enableThinking,
      },
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    return body;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  /** Parse a single SSE line — returns the JSON payload or null */
  private parseSseLine(line: string): unknown | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;
    const colonIdx = trimmed.indexOf(":");
    const payload = trimmed.slice(colonIdx + 1).trim();
    if (payload === "[DONE]") return "[DONE]";
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  // Non-streaming - single response
  async chat(history: Message[], signal?: AbortSignal): Promise<string> {
    DebugLogger.log("HTTP", `POST ${this.url}`, {
      model: this.model,
      stream: false,
      messages: history.length,
    });

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(history, false)),
        signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        DebugLogger.log("HTTP", "Request aborted by user");
        throw err;
      }
      const cause = err.cause ? ` (Cause: ${err.cause.message})` : "";
      throw new Error(`fetch failed to connect to ${this.url}${cause}`);
    }

    DebugLogger.log("HTTP", `Response ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      DebugLogger.log("ERROR", `Model error ${res.status}`, {
        body: text.slice(0, 200),
      });
      throw new Error(`Model error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    const content = data.choices[0]?.message?.content ?? "";
    DebugLogger.log("HTTP", `Chat response received`, {
      length: content.length,
    });
    return content;
  }

  // Streaming (content only) - yields tokens as they arrive
  async *stream(
    history: Message[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    DebugLogger.log("HTTP", `POST ${this.url} (stream)`, {
      model: this.model,
      messages: history.length,
    });

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(history, true)),
        signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        DebugLogger.log("HTTP", "Stream aborted by user");
        throw err;
      }
      const cause = err.cause ? ` (Cause: ${err.cause.message})` : "";
      throw new Error(`fetch failed to connect to ${this.url}${cause}`);
    }

    DebugLogger.log("HTTP", `Stream response ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      DebugLogger.log("ERROR", `Stream error ${res.status}`, {
        body: text.slice(0, 200),
      });
      throw new Error(`Model error ${res.status}: ${text}`);
    }

    if (!res.body) {
      DebugLogger.log("ERROR", "No response body for streaming");
      throw new Error("No response body for streaming");
    }

    yield* this._readTokenStream(res.body);
  }

  // ── Streaming with tool/function calling ─────────────────────────────────────

  async *streamWithTools(
    history: Message[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    DebugLogger.log("HTTP", `POST ${this.url} (stream+tools)`, {
      model: this.model,
      messages: history.length,
      tools: tools.map((t) => t.function.name),
    });

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(history, true, tools)),
        signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        DebugLogger.log("HTTP", "Stream+tools aborted by user");
        throw err;
      }
      const cause = err.cause ? ` (Cause: ${err.cause.message})` : "";
      throw new Error(`fetch failed to connect to ${this.url}${cause}`);
    }

    DebugLogger.log(
      "HTTP",
      `Stream+tools response ${res.status} ${res.statusText}`,
    );

    if (!res.ok) {
      const text = await res.text();
      DebugLogger.log("ERROR", `Stream+tools error ${res.status}`, {
        body: text.slice(0, 200),
      });
      throw new Error(`Model error ${res.status}: ${text}`);
    }

    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Accumulate tool_call deltas keyed by index
    const accumulator = new Map<number, ToolCallAccum>();
    let finishReason: string | null = null;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const parsed = this.parseSseLine(line);
        if (parsed === null) continue;
        if (parsed === "[DONE]") break outer;

        const chunk = parsed as {
          choices: Array<{
            delta: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
        };

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;

        // ① Regular content token
        if (delta.content) {
          yield { type: "token", content: delta.content };
        }

        // ② Tool call delta — accumulate across chunks
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!accumulator.has(idx)) {
              accumulator.set(idx, { id: "", name: "", argsBuffer: "" });
            }
            const acc = accumulator.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) {
              acc.name += tc.function.name;
              yield { type: "tool_generating", name: acc.name };
            }
            if (tc.function?.arguments) acc.argsBuffer += tc.function.arguments;
          }
        }
      }
    }

    // ③ Emit assembled tool calls if any were accumulated.
    // NOTE: Some OpenAI-compatible servers (llama.cpp, Ollama, LM Studio)
    // use finish_reason="stop" even when tool calls are present in the
    // streamed deltas. We therefore rely on the accumulator contents
    // rather than strictly requiring finishReason === "tool_calls".
    if (accumulator.size > 0) {
      // If the model hit its token limit, the tool call JSON is likely truncated.
      // Validate before emitting to avoid downstream JSON.parse crashes.
      if (finishReason === "length") {
        const truncated: string[] = [];
        for (const [, acc] of accumulator) {
          try {
            JSON.parse(acc.argsBuffer);
          } catch {
            truncated.push(acc.name);
          }
        }
        if (truncated.length > 0) {
          DebugLogger.log(
            "ERROR",
            "Tool call(s) truncated by max_tokens limit",
            {
              tools: truncated,
              finishReason,
            },
          );
          yield {
            type: "token" as const,
            content: `\n\n⚠️ Tool call was truncated (max_tokens limit reached). Try increasing max_tokens in your model config, or ask the model to produce a shorter response.`,
          };
          return; // Don't emit broken tool calls
        }
      }

      const calls: ToolCall[] = [];
      for (const [, acc] of accumulator) {
        calls.push({
          id:
            acc.id ||
            `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "function",
          function: { name: acc.name, arguments: acc.argsBuffer },
        });
      }
      DebugLogger.log("SSE", "Tool calls assembled", {
        count: calls.length,
        names: calls.map((c) => c.function.name),
        finishReason,
      });
      yield { type: "tool_calls", tool_calls: calls };
    }
  }

  // ── Shared SSE token reader (used by stream()) ────────────────────────────────

  private async *_readTokenStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let tokenCount = 0;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) {
        DebugLogger.log("SSE", "Stream ended", { totalTokens: tokenCount });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const parsed = this.parseSseLine(line);
        if (parsed === null) continue;
        if (parsed === "[DONE]") {
          DebugLogger.log("SSE", "Received [DONE]", {
            totalTokens: tokenCount,
          });
          break outer;
        }

        const chunk = parsed as {
          choices: { delta: { content?: string } }[];
        };
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          tokenCount++;
          yield token;
        }
      }
    }
  }
}
