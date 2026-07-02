// ── Types ─────────────────────────────────────────────────────────────────────

import { DebugLogger } from "./DebugLogger";

export interface PermissionConfig {
  allow?: string[];
  deny?: string[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  /** Human-readable reason — set when blocked */
  reason?: string;
  /** The pattern that matched */
  matchedRule?: string;
}

// ── Tool categories for policy guidance ───────────────────────────────────────

/**
 * Tools that read state without changing anything.
 * Safe by default — no special handling needed.
 */

export const READ_TOOLS = ["read_file", "glob", "grep", "list_dir"] as const;

/**
 * Tools that write, delete, or execute — higher risk.
 * These are still allowed by default but users should consider
 * explicitly listing them in permissions.allow if they want tighter control.
 */
export const WRITE_TOOLS = ["write_file", "edit_file", "bash"] as const;

// ── PermissionManager ─────────────────────────────────────────────────────────

/**
 * Checks tool calls against the allow/deny lists from project config.
 *
 * ## Evaluation Priority
 *   1. **Deny list** — blocks immediately (takes precedence over allow).
 *   2. **Allow list empty** → allow all (default-open policy for dev tools).
 *   3. **Allow list non-empty** → tool must match at least one allow pattern.
 *
 * ## Pattern Matching Syntax
 * The matching is performed ONLY against the **Tool Name** (`toolName`), not its parameters.
 *
 * - **Exact Match**: `"bash"`
 *     Matches only the exact tool name "bash".
 * - **Prefix Wildcard**: `"mcp__enactor-local__*"` or `"mcp__*"`
 *     Matches any tool name that starts with the string before the `*`.
 *     Crucial for allowing all tools from a specific MCP server.
 * - **Suffix Wildcard**: `"*_file"`
 *     Matches any tool name that ends with the string after the `*` 
 *     (e.g., "read_file", "write_file").
 * - **Global Wildcard**: `"*"`
 *     Matches literally any tool.
 *
 * ⚠️ **IMPORTANT LIMITATION**: Parameter-based matching is NOT supported.
 * Patterns like `"Bash(grep *)"` or `"Skill(enactor*)"` will be evaluated as 
 * literal tool names. Because no tool is actually named `"Bash(grep *)"`, 
 * these patterns will never match. You must match on the tool name itself 
 * (e.g., `"bash"`, `"mcp__enactor-local__*"`).
 *
 * ## Example .enactor/config.json
 * ```json
 * {
 *   "permissions": {
 *     "allow": ["read_file", "write_file", "mcp__enactor-remote__*"],
 *     "deny":  ["bash"]
 *   }
 * }
 * ```
 */
export class PermissionManager {
  private readonly allowPatterns: string[];
  private readonly denyPatterns: string[];
  private readonly configured: boolean;

  constructor(config?: PermissionConfig) {
    let allow = config?.allow ?? [];
    let deny = config?.deny ?? [];

    // Filter out Claude Code parameterized rules (e.g. "Bash(grep *)", "Skill(...)")
    allow = allow.filter((p) => !p.includes("("));
    deny = deny.filter((p) => !p.includes("("));

    // If an allow list is provided but it doesn't explicitly mention ANY core tools,
    // we assume the user only wanted to restrict MCP tools, so we auto-inject the core tools.
    const allCoreTools = [
      ...READ_TOOLS,
      ...WRITE_TOOLS,
      "store_memory",
      "get_diagnostics",
      "get_open_editors",
      "native_search",
    ];
    const hasCoreToolRule = allow.some((p) => allCoreTools.includes(p) || p === "*");
    
    if (allow.length > 0 && !hasCoreToolRule) {
      allow.push(...allCoreTools);
    }

    this.allowPatterns = allow;
    this.denyPatterns = deny;
    this.configured = this.allowPatterns.length > 0 || this.denyPatterns.length > 0;

    DebugLogger.log("PERMISSION", "PermissionManager initialised", {
      allow: this.allowPatterns,
      deny: this.denyPatterns,
      configured: this.configured,
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  /**
   * Check whether a tool is allowed to execute.
   * Call this before every tool execution.
   */
  check(toolName: string): PermissionCheckResult {
    // ① Deny list takes precedence
    for (const pattern of this.denyPatterns) {
      if (this.matches(toolName, pattern)) {
        DebugLogger.log("PERMISSION", `BLOCKED: ${toolName}`, {
          rule: pattern,
          list: "deny",
        });
        return {
          allowed: false,
          reason:
            `'${toolName}' is blocked by deny rule '${pattern}'. ` +
            `Remove it from the deny list in .enactor/config.json or .claude/settings.json to enable it.`,
          matchedRule: pattern,
        };
      }
    }

    // ② Allow list empty → allow all (default-open policy)
    if (this.allowPatterns.length === 0) {
      DebugLogger.log("PERMISSION", `ALLOWED: ${toolName}`, {
        reason: "default-open (no allow list configured)",
      });
      return { allowed: true };
    }

    // ③ Allow list non-empty → must match at least one pattern
    for (const pattern of this.allowPatterns) {
      if (this.matches(toolName, pattern)) {
        DebugLogger.log("PERMISSION", `ALLOWED: ${toolName}`, {
          rule: pattern,
          list: "allow",
        });
        return { allowed: true, matchedRule: pattern };
      }
    }

    // ④ Not on the allow list
    DebugLogger.log("PERMISSION", `BLOCKED: ${toolName}`, {
      reason: "not in allow list",
    });
    return {
      allowed: false,
      reason:
        `'${toolName}' is not in the allow list. ` +
        `Add '${toolName}' (or a matching pattern like '${this.suggestPattern(toolName)}') ` +
        `to permissions.allow in .enactor/config.json or .claude/settings.json.`,
    };
  }

  /** True if any allow or deny rules are configured */
  isConfigured(): boolean {
    return this.configured;
  }

  getAllowPatterns(): string[] {
    return [...this.allowPatterns];
  }

  getDenyPatterns(): string[] {
    return [...this.denyPatterns];
  }

  // ── Pattern matching ───────────────────────────────────────────────────────

  private matches(toolName: string, pattern: string): boolean {
    // Wildcard — matches everything
    if (pattern === "*") return true;

    // Exact match
    if (pattern === toolName) return true;

    // Prefix wildcard: "mcp__*" → matches "mcp__server__tool"
    if (pattern.endsWith("*")) {
      return toolName.startsWith(pattern.slice(0, -1));
    }

    // Suffix wildcard: "*_file" → matches "read_file", "write_file"
    if (pattern.startsWith("*")) {
      return toolName.endsWith(pattern.slice(1));
    }

    return false;
  }

  /** Suggest a useful pattern for the error message */
  private suggestPattern(toolName: string): string {
    // MCP tools → suggest server-level wildcard
    if (toolName.startsWith("mcp__")) {
      const parts = toolName.split("__");
      if (parts.length >= 2) return `mcp__${parts[1]}__*`;
      return "mcp__*";
    }
    return toolName;
  }
}
