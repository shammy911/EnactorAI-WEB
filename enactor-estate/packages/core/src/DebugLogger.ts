import { writeFileSync, appendFileSync } from "fs";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────────
export type LogCategory =
  | "HTTP"
  | "SSE"
  | "ENGINE"
  | "CONFIG"
  | "APP"
  | "ERROR"
  | "PROJECT" // project context detection
  | "VCS" // git/svn detection
  | "WORKSPACE" // EnactorAI workspace layout detection
  | "BUILD" // build system detection
  | "MCP" // MCP server connection and tool calls
  | "HOOK" // hook execution
  | "TOOL" // built-in tool execution
  | "PERMISSION" // permission checks
  | "MEMORY" // memory read/write
  | "SKILL" // skill execution
  | "SERVER";

export interface LogEntry {
  timestamp: Date;
  category: LogCategory;
  message: string;
  data?: unknown;
  durationMs?: number;
}

type Subscriber = (entry?: LogEntry) => void;

// ── Constants ────────────────────────────────────────────────────
const MAX_ENTRIES = 200;
const LOG_FILE = join(process.cwd(), "enactor-debug.log");

// ── Singleton ────────────────────────────────────────────────────
class DebugLoggerImpl {
  private _entries: LogEntry[] = [];
  private _subscribers = new Set<Subscriber>();
  private _fileReady = false;

  /** All stored entries (up to MAX_ENTRIES, oldest first). */
  get entries(): readonly LogEntry[] {
    return this._entries;
  }

  /** Push a new log entry. */
  log(category: LogCategory, message: string, data?: unknown): void {
    const entry: LogEntry = { timestamp: new Date(), category, message, data };

    // Ring buffer — drop oldest when full
    if (this._entries.length >= MAX_ENTRIES) {
      this._entries.shift();
    }
    this._entries.push(entry);

    // Persist to file
    this._appendToFile(entry);

    // Also print to terminal console
    if (category === "ERROR") {
      console.error(`[${category}] ${message}`, data || "");
    } else {
      console.log(`[${category}] ${message}`, data || "");
    }

    // Notify subscribers (React re-render)
    for (const cb of this._subscribers) {
      try {
        cb(entry);
      } catch {
        // never let a bad subscriber break logging
      }
    }
  }

  /** Subscribe to new entries — returns an unsubscribe function. */
  subscribe(cb: Subscriber): () => void {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  /** Clear all in-memory entries. */
  clear(): void {
    this._entries = [];
    for (const cb of this._subscribers) cb();
  }

  /** Measure execution time of a step. Returns an end() function. */
  time(
    category: LogCategory,
    message: string,
    data?: unknown,
  ): (endData?: unknown) => void {
    const start = Date.now();
    this.log(category, `${message} (started)`, data);

    return (endData?: unknown) => {
      const durationMs = Date.now() - start;
      const endMessage = `${message} (finished)`;

      let finalData = data;
      if (endData !== undefined) {
        if (typeof data === "object" && typeof endData === "object") {
          finalData = { ...data, ...endData };
        } else {
          finalData = endData;
        }
      }

      const entry: LogEntry = {
        timestamp: new Date(),
        category,
        message: endMessage,
        data: finalData,
        durationMs,
      };

      if (this._entries.length >= MAX_ENTRIES) {
        this._entries.shift();
      }
      this._entries.push(entry);
      this._appendToFile(entry);

      for (const cb of this._subscribers) {
        try {
          cb(entry);
        } catch {}
      }
    };
  }

  // ── File persistence ───────────────────────────────────────────
  private _appendToFile(entry: LogEntry): void {
    try {
      if (!this._fileReady) {
        writeFileSync(
          LOG_FILE,
          `--- EnactorAI CLI Debug Log — ${new Date().toLocaleString()} ---\n`,
        );
        this._fileReady = true;
      }

      const ts =
        entry.timestamp.toLocaleTimeString("en-US", { hour12: false }) +
        "." +
        String(entry.timestamp.getMilliseconds()).padStart(3, "0");
      const durationStr =
        entry.durationMs !== undefined ? ` [${entry.durationMs}ms]` : "";
      const dataStr =
        entry.data !== undefined ? ` | ${JSON.stringify(entry.data)}` : "";
      appendFileSync(
        LOG_FILE,
        `[${ts}] [${entry.category}] ${entry.message}${durationStr}${dataStr}\n`,
      );
    } catch {
      // If file I/O fails, don't crash the app — debug logging is best-effort
    }
  }
}

/** Global debug logger instance. */
export const DebugLogger = new DebugLoggerImpl();
