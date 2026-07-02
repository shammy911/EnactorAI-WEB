import { McpClient, McpTool } from "./McpClient.js";
import { McpConfig, McpServerConfig } from "./types.js";
import { ToolDefinition } from "./ModelClient.js";
import { DebugLogger } from "./DebugLogger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type McpConnectionStatus =
  | "pending"
  | "connecting"
  | "connected"
  | "failed"
  | "disconnected";

export interface McpServerStatus {
  name: string;
  type: "stdio" | "sse";
  status: McpConnectionStatus;
  toolCount: number;
  error?: string;
}

/** Callback fired whenever a server's status changes (for UI updates) */
export type McpStatusCallback = (statuses: McpServerStatus[]) => void;

// ── McpManager ────────────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of all MCP server connections.
 *
 * Usage:
 *   const mgr = new McpManager(projectDir);
 *   mgr.loadConfig(ctx.mcpConfig);
 *   await mgr.connectAll(onStatusChange);
 *   // Tools are now available via getToolDefinitions() / executeTool()
 *   // ... later ...
 *   await mgr.disconnectAll();
 */
export class McpManager {
  private clients = new Map<string, McpClient>();
  private serverTools = new Map<string, McpTool[]>();
  private statuses = new Map<string, McpServerStatus>();

  constructor(private readonly projectDir: string) {}

  // ── Config loading ────────────────────────────────────────────────────────

  /**
   * Parse MCP config and create clients (does NOT connect yet).
   * Call connectAll() after this to start servers.
   */
  loadConfig(config: McpConfig): void {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      const client = new McpClient(name, serverConfig, this.projectDir);
      this.clients.set(name, client);
      this.statuses.set(name, {
        name,
        type: serverConfig.type,
        status: "pending",
        toolCount: 0,
      });

      DebugLogger.log("MCP", `Loaded config for server: ${name}`, {
        type: serverConfig.type,
      });
    }
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /**
   * Connect to all configured servers in parallel.
   * Uses Promise.allSettled — one failing server doesn't block others.
   *
   * @param onStatusChange Optional callback fired on each status transition (for UI)
   * @returns Final status array for all servers
   */
  async connectAll(
    onStatusChange?: McpStatusCallback,
  ): Promise<McpServerStatus[]> {
    const entries = Array.from(this.clients.entries());

    if (entries.length === 0) {
      DebugLogger.log("MCP", "No MCP servers configured — skipping");
      return [];
    }

    DebugLogger.log("MCP", `Connecting to ${entries.length} MCP server(s)`);

    // Fire all connections in parallel
    const promises = entries.map(([name, client]) =>
      this.connectOne(name, client, onStatusChange),
    );

    await Promise.allSettled(promises);

    const finalStatuses = this.getServerStatuses();
    const connected = finalStatuses.filter((s) => s.status === "connected");
    const failed = finalStatuses.filter((s) => s.status === "failed");

    DebugLogger.log("MCP", "Connection results", {
      total: entries.length,
      connected: connected.length,
      failed: failed.length,
      totalTools: connected.reduce((sum, s) => sum + s.toolCount, 0),
    });

    return finalStatuses;
  }

  /** Connect a single server, discover its tools, update status */
  private async connectOne(
    name: string,
    client: McpClient,
    onStatusChange?: McpStatusCallback,
  ): Promise<void> {
    // Mark connecting
    this.updateStatus(name, { status: "connecting" });
    onStatusChange?.(this.getServerStatuses());

    try {
      await client.connect();

      // Discover tools
      const tools = await client.listTools();
      this.serverTools.set(name, tools);

      this.updateStatus(name, {
        status: "connected",
        toolCount: tools.length,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.updateStatus(name, {
        status: "failed",
        error: errorMsg,
      });
    }

    onStatusChange?.(this.getServerStatuses());
  }

  // ── Disconnection ─────────────────────────────────────────────────────────

  /** Gracefully disconnect all servers */
  async disconnectAll(): Promise<void> {
    DebugLogger.log("MCP", "Disconnecting all MCP servers");

    const promises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
          this.updateStatus(name, { status: "disconnected", toolCount: 0 });
        } catch {
          // Best-effort — don't throw on cleanup
        }
      },
    );

    await Promise.allSettled(promises);
    this.serverTools.clear();
  }

  // ── Tool definitions (for LLM) ───────────────────────────────────────────

  /**
   * Get all tool definitions from all connected MCP servers,
   * formatted as OpenAI function-calling ToolDefinitions.
   *
   * Tool names are prefixed with `mcp__<serverName>__` to avoid
   * collisions with built-in tools.
   */
  getToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];

    for (const [serverName, tools] of this.serverTools.entries()) {
      for (const tool of tools) {
        const prefixedName = `mcp__${serverName}__${tool.name}`;

        // Convert MCP inputSchema properties to the simpler format
        // our ToolDefinition expects
        const properties: Record<
          string,
          { type: string; description?: string }
        > = {};
        if (tool.inputSchema.properties) {
          for (const [key, schema] of Object.entries(
            tool.inputSchema.properties,
          )) {
            const s = schema as { type?: string; description?: string };
            properties[key] = {
              type: s.type ?? "string",
              description: s.description,
            };
          }
        }

        defs.push({
          type: "function",
          function: {
            name: prefixedName,
            description:
              tool.description ?? `MCP tool from ${serverName}: ${tool.name}`,
            parameters: {
              type: "object",
              properties,
            },
          },
        });
      }
    }

    return defs;
  }

  // ── Tool execution ────────────────────────────────────────────────────────

  /**
   * Execute a tool call by its prefixed name.
   * Parses `mcp__<serverName>__<toolName>` and routes to the correct client.
   */
  async executeTool(
    prefixedName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // Parse: mcp__serverName__toolName
    const match = prefixedName.match(/^mcp__(.+?)__(.+)$/);
    if (!match) {
      return `Error: Invalid MCP tool name format: ${prefixedName}`;
    }

    const [, serverName, toolName] = match;
    const client = this.clients.get(serverName);
    if (!client) {
      return `Error: MCP server '${serverName}' not found`;
    }
    if (!client.isConnected()) {
      return `Error: MCP server '${serverName}' is not connected`;
    }

    try {
      return await client.callTool(toolName, args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      DebugLogger.log("ERROR", `MCP tool call failed: ${prefixedName}`, {
        error: msg,
      });
      return `Error calling MCP tool ${toolName} on ${serverName}: ${msg}`;
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getServerStatuses(): McpServerStatus[] {
    return Array.from(this.statuses.values());
  }

  /** Total number of tools across all connected servers */
  getTotalToolCount(): number {
    let count = 0;
    for (const tools of this.serverTools.values()) {
      count += tools.length;
    }
    return count;
  }

  /** Check if any servers are configured */
  hasServers(): boolean {
    return this.clients.size > 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private updateStatus(name: string, update: Partial<McpServerStatus>): void {
    const current = this.statuses.get(name);
    if (current) {
      this.statuses.set(name, { ...current, ...update });
    }
  }
}
