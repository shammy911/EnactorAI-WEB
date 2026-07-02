import { LocalTool, ToolContext } from "./LocalTool";
import { ToolDefinition } from "../ModelClient";
import { TemplateResolver } from "../TemplateResolver";
import { DebugLogger } from "../DebugLogger";

export class GetTemplateTool implements LocalTool {
  constructor(private templateResolver: TemplateResolver) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "get_template",
        description:
          "Fetches the raw XML template for a specific entity type so it can be filled out with actual values.",
        parameters: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description:
                "The exact name of the entity type (e.g. 'device', 'pos-terminal', 'payment-device', 'payment-device-host', 'icc-reader').",
            },
          },
          required: ["entityName"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    const entityName = args.entityName as string;
    if (!entityName) return "Error: entityName argument is required.";

    try {
      DebugLogger.log("TOOL", "get_template request", {
        entityName,
      });
      const templateContent = await this.templateResolver.resolve(entityName);
      DebugLogger.log("TOOL", "get_template response", {
        entityName,
        templateContent: templateContent.slice(0, 500),
      });
      return templateContent;
    } catch (error) {
      DebugLogger.log("ERROR", "get_template failed", {
        error: (error as Error).message,
      });
      return `Failed to fetch template: ${(error as Error).message}`;
    }
  }
}
