// Types extracted from ProjectContext — used by McpManager and McpClient

export interface McpServerConfig {
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}
