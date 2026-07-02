import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DebugLogger } from "./DebugLogger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionMeta {
  sessionId: string;
  startTime: string; // ISO string
  cwd: string;
  endTime: string | null; // ISO string or null if session is active
  messageCount: number;
  summary: string | null; // Optional summary of the session
}

// ── MemoryManager ─────────────────────────────────────────────────────────────

/**
 * Manages persistent cross-session memory for a project.
 *
 * Storage layout (mirrors P0 read path so they stay in sync):
 *
 *   ~/.enactor/projects/<hash>/
 *     memory/
 *       MEMORY.md          ← injected as system prompt by ProjectContext (P0)
 *     sessions/
 *       <sessionId>/
 *         meta.json        ← session start/end times, message count
 *
 * Usage:
 *   const mem = new MemoryManager(ctx.cwd);
 *   await mem.startSession();
 *   await mem.appendMemory("We use CheckoutAction for the checkout flow");
 *   await mem.endSession();
 */
export class MemoryManager {
  private readonly projectHash: string;
  private readonly projectDir: string;
  private _messageCount = 0;

  /** Unique ID for this session — set once on construction */
  readonly sessionId: string;

  constructor(cwd: string) {
    this.projectDir = cwd;
    this.projectHash = MemoryManager.hashCwd(cwd);
    this.sessionId = MemoryManager.makeSessionId();

    DebugLogger.log("MEMORY", "MemoryManager initialized", {
      hash: this.projectHash,
      sessionId: this.sessionId,
    });
  }

  // ── Paths ─────────────────────────────────────────────────────────────────

  /** Path to the persistent MEMORY.md file for this project */
  getMemoryPath(): string {
    return path.join(
      os.homedir(),
      ".enactor",
      "projects",
      this.projectHash,
      "memory",
      "MEMORY.md",
    );
  }

  /** Path to the meta.json for a given session */
  getSessionMetaPath(sessionId: string = this.sessionId): string {
    return path.join(
      os.homedir(),
      ".enactor",
      "projects",
      this.projectHash,
      "sessions",
      sessionId,
      "meta.json",
    );
  }

  // ── Memory read/write ─────────────────────────────────────────────────────

  /**
   * Read the current MEMORY.md synchronously.
   * Returns null if no memory has been saved yet.
   */
  loadMemory(): string | null {
    try {
      return fs.readFileSync(this.getMemoryPath(), "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Append a single memory entry to MEMORY.md.
   * Creates the file (with a header) if it does not exist yet.
   *
   * Format:
   *   - [YYYY-MM-DD] <entry text>
   */
  async appendMemory(entry: string): Promise<void> {
    const memPath = this.getMemoryPath();
    fs.mkdirSync(path.dirname(memPath), { recursive: true });

    // Write header if file is new
    if (!fs.existsSync(memPath)) {
      fs.writeFileSync(
        memPath,
        "# Project Memory\n\nPersistent notes and decisions for this workspace.\n\n",
        "utf-8",
      );
      DebugLogger.log("MEMORY", "Created new MEMORY.md", { path: memPath });
    }

    const date = new Date().toISOString().slice(0, 10); //YYYY-MM-DD
    const line = `- [${date}] ${entry.trim()}\n`;
    fs.appendFileSync(memPath, line, "utf-8");

    DebugLogger.log("MEMORY", "Appended memory entry", {
      entry: entry.slice(0, 100),
      path: memPath,
    });
  }

  /**
   * Reset MEMORY.md to an empty state (header only).
   * The file is not deleted so the path remains stable.
   */
  async clearMemory(): Promise<void> {
    const memPath = this.getMemoryPath();
    try {
      fs.mkdirSync(path.dirname(memPath), { recursive: true });
      fs.writeFileSync(
        memPath,
        "# Project Memory\n\nPersistent notes and decisions for this workspace.\n\n",
        "utf-8",
      );
      DebugLogger.log("MEMORY", "Memory cleared", { path: memPath });
    } catch (err) {
      DebugLogger.log("ERROR", "Failed to clear memory", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── Session tracking ──────────────────────────────────────────────────────

  /**
   * Create a session meta.json marking the start of this session.
   * Call once during app init (after handleInitComplete).
   */
  async startSession(): Promise<void> {
    const metaPath = this.getSessionMetaPath();
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });

    const meta: SessionMeta = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      cwd: this.projectDir,
      endTime: null,
      messageCount: 0,
      summary: null,
    };

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    DebugLogger.log("MEMORY", "Session started", {
      sessionId: this.sessionId,
    });
  }

  /**
   * Increment the in-memory message counter.
   * Call once per user message in handleSubmit.
   */
  incrementMessageCount(): void {
    this._messageCount++;
  }

  /**
   * Write end time, message count and optional summary to meta.json.
   * Call from handleExit before closing the app.
   */
  async endSession(summary?: string): Promise<void> {
    const metaPath = this.getSessionMetaPath();
    try {
      const raw = fs.readFileSync(metaPath, "utf-8");
      const existing = JSON.parse(raw) as SessionMeta;

      const updated: SessionMeta = {
        ...existing,
        endTime: new Date().toISOString(),
        messageCount: this._messageCount,
        summary: summary ?? null,
      };

      fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), "utf-8");
      DebugLogger.log("MEMORY", "Session ended", {
        sessionId: this.sessionId,
        messages: this._messageCount,
      });
    } catch (err) {
      // Best-effort — don't crash on exit if session file is missing
      DebugLogger.log("ERROR", "Failed to end session", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /**
   * Derive a stable project hash from the cwd.
   * Matches the hash used by ProjectContext.loadMemory() so they read the same file.
   */
  static hashCwd(cwd: string): string {
    return Buffer.from(cwd)
      .toString("base64")
      .replace(/[/+=]/g, "_")
      .slice(0, 32);
  }

  /** Generate a human-readable, sortable session ID from the current time */
  static makeSessionId(): string {
    return new Date()
      .toISOString()
      .replace("T", "_")
      .replace(/:/g, "-")
      .slice(0, 19); // YYYY-MM-DD_HH-mm-ss
  }
}
