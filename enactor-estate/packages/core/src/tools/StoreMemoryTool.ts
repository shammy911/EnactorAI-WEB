import { ToolDefinition } from "../ModelClient.js";
import { LocalTool, ToolContext } from "./LocalTool.js";
import { MemoryManager } from "../MemoryManager.js";
import { DebugLogger } from "../DebugLogger.js";

/**
 * Built-in tool that allows the LLM to persist facts and decisions
 * to the project's cross-session memory (MEMORY.md).
 *
 * The LLM can call this tool whenever it discovers something worth
 * remembering across sessions — e.g., "This project uses apiClient
 * instead of raw fetch" or "The checkout flow lives in CheckoutAction.java".
 *
 * The stored memories are automatically injected into the system prompt
 * on subsequent sessions via ProjectContext.toSystemPrompt().
 */
export class StoreMemoryTool implements LocalTool {
  private memoryManager: MemoryManager | null = null;

  /** Attach a MemoryManager instance (called from App.tsx after init) */
  setMemoryManager(manager: MemoryManager): void {
    this.memoryManager = manager;
  }

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "store_memory",
        description:
          "Store a fact, decision, or piece of knowledge about this project " +
          "that should be remembered across sessions. Use this when you learn " +
          "something important about the codebase, architecture, conventions, " +
          "or user preferences that would be useful in future conversations. " +
          "Each entry should be a concise, self-contained statement.",
        parameters: {
          type: "object",
          properties: {
            fact: {
              type: "string",
              description:
                "A concise statement of the fact or decision to remember. " +
                'Example: "This project uses the apiClient wrapper instead of raw fetch calls."',
            },
          },
          required: ["fact"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    const fact = args.fact as string;

    if (!fact || typeof fact !== "string" || !fact.trim()) {
      return "Error: 'fact' parameter is required and must be a non-empty string.";
    }

    if (!this.memoryManager) {
      DebugLogger.log(
        "ERROR",
        "store_memory called but no MemoryManager attached",
      );
      return "Error: Memory system is not initialized.";
    }

    try {
      await this.memoryManager.appendMemory(fact.trim());
      return `✓ Memory stored: "${fact.trim()}"`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      DebugLogger.log("ERROR", `store_memory failed: ${msg}`);
      return `Error storing memory: ${msg}`;
    }
  }
}
