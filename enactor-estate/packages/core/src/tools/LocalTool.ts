import { ToolDefinition } from "../ModelClient.js";

/** Context provided to all local tools when they execute */
export interface ToolContext {
  cwd: string;
}

/** Interface for built-in tool implementations */
export interface LocalTool {
  /** Get the JSON Schema definition for this tool to send to the model */
  getDefinition(): ToolDefinition;

  /** Execute the tool with the given arguments */
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}
