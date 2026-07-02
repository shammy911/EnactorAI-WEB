import { DebugLogger } from "../DebugLogger";
import { ToolDefinition } from "../ModelClient";
import { LocalTool, ToolContext } from "./LocalTool";

export class ImportEstateConfigTool implements LocalTool {
  constructor(
    private estateUrl: string,
    private estateAuth?: string | null,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "import_estate_config",
        description:
          "Imports an XML configuration payload into Estate Manager. Use this ONLY when the user explicitly asks to 'import', 'upload', or 'deploy' to the server. Do NOT use this tool if the user simply asks to 'generate', 'write', or 'create' a file.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename to import as (e.g. terminal_211.xml)",
            },
            xmlContent: {
              type: "string",
              description: "The raw XML configuration string",
            },
          },
          required: ["filename", "xmlContent"],
        },
      },
    };
  }

  async execute(args: {
    filename: string;
    xmlContent: string;
  }): Promise<string> {
    // Check if user is authenticated
    if (!this.estateAuth) {
      return "Error: Missing Estate Manager credentials. Please inform the user that they need to click 'Connect Estate Manager' in the top right header to provide their credentials before you can perform this action.";
    }

    try {
      // The extension tracks the WebMaintenance UI, but APIs live under WebRestApi/rest
      const apiBaseUrl = this.estateUrl.replace(
        /\/WebMaintenance\/?$/i,
        "/WebRestApi/rest",
      );
      const url = `${apiBaseUrl}/configuration/import/${args.filename}`;

      const endHttpTimer = DebugLogger.time("HTTP", "import_estate_config request", {
        url,
        filename: args.filename,
        xmlLength: args.xmlContent.length,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "x-enactor-connection-process-id": "RetailProcessServer",
          "x-enactor-connection-point-id": "RetailServerJobResults",
          "x-enactor-runtime-context": "Enactor Web Retail Processing",
          Authorization: this.estateAuth,
        },
        body: args.xmlContent,
      });

      const responseText = await response.text();
      endHttpTimer({
        status: response.status,
        body: responseText.slice(0, 500),
      });

      if (!response.ok) {
        return `API Error (${response.status}): ${responseText}`;
      }

      return `Success: Configuration imported successfully as ${args.filename}`;
    } catch (err) {
      DebugLogger.log("ERROR", "import_estate_config failed", {
        error: (err as Error).message,
      });
      return `Network Error: ${(err as Error).message}`;
    }
  }
}
