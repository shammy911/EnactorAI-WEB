export * from "./LocalTool.js";
export * from "./ToolRegistry.js";
export * from "./StoreMemoryTool.js";
export * from "./SkillTool.js";
export * from "./ImportEstateConfigTool.js";
export * from "./ImportEstateConfigZipTool.js";
export * from "./CheckDeviceTool.js";
export * from "./GetTemplateTool.js";
export * from "./FetchEstateConfigTool.js";

import { ToolRegistry } from "./ToolRegistry.js";
import { ToolContext } from "./LocalTool.js";
import { StoreMemoryTool } from "./StoreMemoryTool.js";

/** Creates a registry with estate-relevant built-in tools */
export function createDefaultRegistry(context: ToolContext): ToolRegistry {
  const registry = new ToolRegistry(context);
  registry.register(new StoreMemoryTool());
  return registry;
}
