import { LocalTool, ToolContext } from "./LocalTool.js";
import { ToolDefinition } from "../ModelClient.js";
import { DebugLogger } from "../DebugLogger.js";
import { PermissionManager } from "../PermissionManager.js";

/** Executor function for MCP tools — maps prefixed name + args to a result string */
type McpExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string>;

export class ToolRegistry {
  private tools = new Map<string, LocalTool>();
  private mcpDefs: ToolDefinition[] = [];
  private mcpExecutor: McpExecutor | null = null;
  private permissionManager: PermissionManager | null = null;
  private onBeforeExecute?: (name: string, args: Record<string, unknown>) => Promise<boolean>;

  constructor(private context: ToolContext) {}

  // ── Permission management ─────────────────────────────────────────────────

  /**
   * Attach a PermissionManager. All tool calls will be checked against it
   * before execution. Call this after creating the registry, before first use.
   */
  setPermissionManager(pm: PermissionManager): void {
    this.permissionManager = pm;
    DebugLogger.log(
      "PERMISSION",
      "PermissionManager attached to ToolRegistry",
      {
        configured: pm.isConfigured(),
        allow: pm.getAllowPatterns(),
        deny: pm.getDenyPatterns(),
      },
    );
  }

  /**
   * Set an async callback that runs before executing any tool.
   * Useful for UI prompts (e.g., asking the user to approve a high-risk tool).
   * If it returns false, the tool execution is blocked.
   */
  setOnBeforeExecute(callback: (name: string, args: Record<string, unknown>) => Promise<boolean>): void {
    this.onBeforeExecute = callback;
  }

  // ── Built-in tool registration ────────────────────────────────────────────

  register(tool: LocalTool): void {
    const name = tool.getDefinition().function.name;
    this.tools.set(name, tool);
    DebugLogger.log("TOOL", `Registered tool: ${name}`);
  }

  /** Retrieve a registered built-in tool by name */
  getTool(name: string): LocalTool | undefined {
    return this.tools.get(name);
  }

  // ── MCP tool registration ────────────────────────────────────────────────

  /**
   * Register MCP tools from an McpManager.
   * These use a different execution path (delegated to McpManager.executeTool).
   */
  registerMcpTools(definitions: ToolDefinition[], executor: McpExecutor): void {
    this.mcpDefs = [...definitions];
    this.mcpExecutor = executor;
    DebugLogger.log("TOOL", `Registered ${definitions.length} MCP tool(s)`, {
      names: definitions.map((d) => d.function.name),
    });
  }

  // ── Combined definitions ──────────────────────────────────────────────────

  /** Get all tool definitions — built-in + MCP (filtered by permissions) */
  getDefinitions(): ToolDefinition[] {
    const builtIn = Array.from(this.tools.values()).map((t) =>
      t.getDefinition(),
    );
    const allDefs = [...builtIn, ...this.mcpDefs];

    // Filter out tools that are blocked by permissions so the LLM doesn't even see them
    if (this.permissionManager) {
      return allDefs.filter(
        (def) => this.permissionManager!.check(def.function.name).allowed,
      );
    }
    return allDefs;
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   *   1. Permission check — block immediately if denied
   *   2. Built-in tools
   *   3. MCP tools (prefixed mcp__serverName__toolName)
   *   4. Unknown tool error
   */
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    // ① Permission check — runs before anything else
    if (this.permissionManager) {
      const result = this.permissionManager.check(name);
      if (!result.allowed) {
        return `⛔ Permission denied: ${result.reason}`;
      }
    }

    // ② Async before-execute hook (e.g. for manual user approval)
    if (this.onBeforeExecute) {
      const allowed = await this.onBeforeExecute(name, args);
      if (!allowed) {
        DebugLogger.log("PERMISSION", `BLOCKED BY USER: ${name}`);
        return `⛔ Permission denied by user.`;
      }
    }

    // ③ Try built-in tool
    const tool = this.tools.get(name);
    if (tool) {
      try {
        DebugLogger.log("TOOL", `Executing built-in: ${name}`, { args });
        return await tool.execute(args, this.context);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        DebugLogger.log("ERROR", `Tool execution failed: ${name}`, {
          error: msg,
        });
        return `Error executing ${name}: ${msg}`;
      }
    }

    // ③ Try MCP tool (prefixed names like mcp__serverName__toolName)
    if (this.mcpExecutor && name.startsWith("mcp__")) {
      return await this.mcpExecutor(name, args);
    }

    // ④ Unknown tool
    DebugLogger.log("ERROR", `Tool not found: ${name}`);
    return `Error: Unknown tool '${name}'`;
  }
}
