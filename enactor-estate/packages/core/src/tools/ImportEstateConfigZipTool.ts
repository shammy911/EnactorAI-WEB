import AdmZip from "adm-zip";
import { ToolDefinition } from "../ModelClient";
import { LocalTool, ToolContext } from "./LocalTool";
import { DebugLogger } from "../DebugLogger";

export class ImportEstateConfigZipTool implements LocalTool {
  constructor(
    private estateUrl: string,
    private estateAuth?: string | null,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "import_estate_config_zip",
        description:
          "Compresses multiple XML files into a ZIP archive and imports it into Estate Manager. Use this when setting up complex workflows (like Payment Devices) that require multiple linked XML entities to be deployed simultaneously.",
        parameters: {
          type: "object",
          properties: {
            files: {
              type: "array",
              description: "Array of XML files to be included in the zip",
              items: {
                type: "object",
                properties: {
                  filename: {
                    type: "string",
                    description: "The filename (e.g. terminal_211.xml)",
                  },
                  xmlContent: {
                    type: "string",
                    description: "The raw XML configuration string",
                  },
                },
                required: ["filename", "xmlContent"],
              },
            },
          },
          required: ["files"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    const files = args.files as Array<{ filename: string; xmlContent: string }>;
    if (!this.estateAuth) {
      return "Error: Missing Estate Manager credentials. Please inform the user that they need to click 'Connect Estate Manager' in the top right header.";
    }

    try {
      const apiBaseUrl = this.estateUrl.replace(
        /\/WebMaintenance\/?$/i,
        "/WebRestApi/rest",
      );
      const url = `${apiBaseUrl}/configuration/import/setup.zip`;

      const endHttpTimer = DebugLogger.time("HTTP", "import_estate_config_zip request", {
        url,
        fileCount: files.length,
      });

      // 1. Create the ZIP archive in memory
      const zip = new AdmZip();
      for (const file of files) {
        zip.addFile(file.filename, Buffer.from(file.xmlContent, "utf8"));
      }

      const zipBuffer = zip.toBuffer();
      DebugLogger.log("TOOL", "import_estate_config_zip zip", {
        size: zipBuffer.length,
      });

      // 2. Upload the ZIP to Estate Manager
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "x-enactor-connection-process-id": "RetailProcessServer",
          "x-enactor-connection-point-id": "RetailServerJobResults",
          "x-enactor-runtime-context": "Enactor Web Retail Processing",
          Authorization: this.estateAuth,
        },
        body: zipBuffer,
      });

      const responseText = await response.text();
      endHttpTimer({
        status: response.status,
        body: responseText.slice(0, 500),
      });
      if (!response.ok) {
        return `API Error (${response.status}): ${responseText}`;
      }
      return `Success: Successfully imported ${files.length} files as a ZIP archive!`;
    } catch (error) {
      DebugLogger.log("ERROR", "import_estate_config_zip failed", {
        error: (error as Error).message,
      });
      return `Network Error: ${(error as Error).message}`;
    }
  }
}
