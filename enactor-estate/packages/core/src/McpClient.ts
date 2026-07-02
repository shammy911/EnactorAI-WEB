import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { DebugLogger } from "./DebugLogger.js";
import { McpServerConfig } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A tool discovered from an MCP server */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
  };
}

// ── McpClient ─────────────────────────────────────────────────────────────────

/**
 * Wraps a single MCP server connection (stdio or SSE/streamable-http).
 * Uses the official @modelcontextprotocol/sdk under the hood.
 */
export class McpClient {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private _connected = false;

  constructor(
    /** Human-readable server name from the config key */
    public readonly name: string,
    private readonly config: McpServerConfig,
    private readonly projectDir: string,
  ) {}

  // ── Connection ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    DebugLogger.log("MCP", `Connecting to ${this.name} (${this.config.type})`, {
      config: this.sanitizedConfig(),
    });

    this.transport = this.createTransport();

    this.client = new Client(
      { name: "enactor-cli", version: "0.1.0" },
      { capabilities: {} },
    );

    try {
      // Start connection (spawns process for stdio).
      // We pass a 2-minute timeout because local stdio servers like `uv run`
      // might need time to download and install packages before starting.
      const connectPromise = this.client.connect(this.transport, {
        timeout: 120000,
      });

      // If it's a stdio transport, capture and log its stderr stream
      if (
        this.transport instanceof StdioClientTransport &&
        this.transport.stderr
      ) {
        this.transport.stderr.on("data", (chunk: Buffer) => {
          const msg = chunk.toString().trim();
          if (msg) {
            DebugLogger.log("ERROR", `${this.name} stderr: ${msg}`);
          }
        });
      }

      await connectPromise;
      this._connected = true;
      DebugLogger.log("MCP", `Connected to ${this.name}`);
    } catch (err) {
      this._connected = false;
      const msg = err instanceof Error ? err.message : String(err);
      DebugLogger.log("ERROR", `MCP connection failed: ${this.name}`, {
        error: msg,
      });
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected || !this.client) return;
    try {
      // stdio transports can hang on close if the child process refuses to exit.
      // We wrap it in a 1-second timeout to ensure the CLI can exit gracefully.
      await Promise.race([
        this.client.close(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout waiting for MCP server to close")),
            1000,
          ),
        ),
      ]);
      DebugLogger.log("MCP", `Disconnected from ${this.name}`);
    } catch (err) {
      DebugLogger.log("ERROR", `MCP disconnect error: ${this.name}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this._connected = false;
      this.client = null;
      this.transport = null;
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  // ── Tool discovery ────────────────────────────────────────────────────────

  async listTools(): Promise<McpTool[]> {
    if (!this.client || !this._connected) {
      throw new Error(`MCP client ${this.name} is not connected`);
    }

    const result = await this.client.listTools();
    const tools: McpTool[] = result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object" as const,
        properties: t.inputSchema.properties as
          | Record<string, object>
          | undefined,
        required: t.inputSchema.required,
      },
    }));

    DebugLogger.log("MCP", `${this.name}: discovered ${tools.length} tools`, {
      names: tools.map((t) => t.name),
    });

    return tools;
  }

  // ── Tool execution ────────────────────────────────────────────────────────

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!this.client || !this._connected) {
      throw new Error(`MCP client ${this.name} is not connected`);
    }

    DebugLogger.log("MCP", `${this.name}: calling ${toolName}`, { args });

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Extract text from MCP content blocks
    const textParts: string[] = [];
    if (Array.isArray(result.content)) {
      for (const block of result.content) {
        if (
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          "text" in block
        ) {
          textParts.push(block.text as string);
        }
      }
    }

    const output = textParts.join("\n");

    DebugLogger.log("MCP", `${this.name}: ${toolName} returned`, {
      resultLength: output.length,
      isError: result.isError ?? false,
    });

    if (result.isError) {
      return `Error from MCP server ${this.name}: ${output}`;
    }

    return output;
  }

  // ── Transport creation ────────────────────────────────────────────────────

  private createTransport(): Transport {
    switch (this.config.type) {
      case "stdio":
        return this.createStdioTransport();
      case "sse":
        return this.createSseTransport();
      default:
        throw new Error(`Unsupported MCP transport type: ${this.config.type}`);
    }
  }

  private createStdioTransport(): StdioClientTransport {
    if (!this.config.command) {
      throw new Error(
        `MCP server ${this.name}: stdio transport requires "command"`,
      );
    }

    const cwd = this.substituteVars(this.config.cwd ?? this.projectDir);
    const args = (this.config.args ?? []).map((a) => this.substituteVars(a));
    const mergedEnv: Record<string, string> = {};

    // Copy process.env but normalize keys on Windows to uppercase to prevent Path/PATH shadowing
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) {
        const key = process.platform === "win32" ? k.toUpperCase() : k;
        mergedEnv[key] = v;
      }
    }

    // Merge config envs
    if (this.config.env) {
      for (const [k, v] of Object.entries(this.config.env)) {
        if (v !== undefined) {
          const key = process.platform === "win32" ? k.toUpperCase() : k;
          mergedEnv[key] = this.substituteVars(String(v));
        }
      }
    }

    const env = Object.keys(mergedEnv).length > 0 ? mergedEnv : undefined;

    DebugLogger.log("MCP", `${this.name}: creating stdio transport`, {
      command: this.config.command,
      args,
      cwd,
    });

    return new StdioClientTransport({
      command: this.config.command,
      args,
      cwd,
      env,
      stderr: "pipe",
    });
  }

  private createSseTransport(): SSEClientTransport {
    if (!this.config.url) {
      throw new Error(`MCP server ${this.name}: SSE transport requires "url"`);
    }

    const url = this.substituteVars(this.config.url);
    DebugLogger.log("MCP", `${this.name}: creating SSE transport`, { url });

    return new SSEClientTransport(new URL(url));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Replace ${ENACTOR_PROJECT_DIR} and other variables in config strings */
  private substituteVars(value: string): string {
    let result = value
      .replace(/\$\{ENACTOR_PROJECT_DIR\}/g, this.projectDir)
      .replace(/\$\{PROJECT_DIR\}/g, this.projectDir)
      .replace(/\$\{CLAUDE_PROJECT_DIR\}/g, this.projectDir);

    // Expand arbitrary environment variables like ${PATH} or ${HOME}
    result = result.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // For Windows we might want a case-insensitive lookup, but Node's process.env
      // handles it automatically if we access it directly via index
      return process.env[varName] !== undefined ? process.env[varName]! : match;
    });

    return result;
  }

  /** Config without sensitive data — for debug logging */
  private sanitizedConfig(): Record<string, unknown> {
    const safe: Record<string, unknown> = { type: this.config.type };
    if (this.config.command) safe.command = this.config.command;
    if (this.config.args) safe.args = this.config.args;
    if (this.config.url) safe.url = this.config.url;
    if (this.config.cwd) safe.cwd = this.config.cwd;
    return safe;
  }
}
