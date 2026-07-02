import AdmZip from "adm-zip";
import { ToolDefinition } from "../ModelClient";
import { LocalTool, ToolContext } from "./LocalTool";
import { DebugLogger } from "../DebugLogger";

export class FetchEstateConfigTool implements LocalTool {
  constructor(
    private estateUrl: string,
    private estateAuth?: string | null,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "fetch_estate_config",
        description:
          "Fetches existing entity XML configuration from Estate Manager. Returns the raw XML content. Use this when you need to read or modify an existing entity's current configuration (e.g., fetching a POS terminal before updating its payment settings).",
        parameters: {
          type: "object",
          properties: {
            entityType: {
              type: "string",
              description:
                "The entity QName to fetch (e.g., 'posTerminal', 'device', 'user', 'location', 'product').",
            },
            filterField: {
              type: "string",
              description:
                "The filter column ID to search by. CRITICAL: Enactor filter IDs always start with a Capital letter (e.g., 'DeviceId', 'UserId', 'LocationId'). Do NOT use camelCase like 'deviceId' or it will fail. If omitted, fetches all entities of the given type.",
            },
            filterValue: {
              type: "string",
              description: "The value to match against the filter field.",
            },
            comparisonOperator: {
              type: "string",
              description:
                "The comparison operator for filtering. Defaults to 'EQUALS'. Supported: EQUALS, NOT_EQUALS, STARTS_WITH, CONTAINS, IN, NOT_IN.",
            },
            summaryOnly: {
              type: "boolean",
              description:
                "If true, returns only a compact summary (IDs, descriptions, key fields) instead of the full XML content. Use this when you need to present a selection list to the user rather than read the full entity configuration.",
            },
          },
          required: ["entityType"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    const entityType = args.entityType as string;
    const filterField = args.filterField as string | undefined;
    const filterValue = args.filterValue as string | undefined;
    const comparisonOperator = args.comparisonOperator as string | undefined;
    const summaryOnly = args.summaryOnly as boolean | undefined;

    // Auth check
    if (!this.estateAuth) {
      return "Error: Missing Estate Manager credentials. Please inform the user that they need to click 'Connect Estate Manager' in the top right header to provide their credentials before you can perform this action.";
    }

    try {
      // Build the URL
      const apiBaseUrl = this.estateUrl.replace(
        /\/WebMaintenance\/?$/i,
        "/WebRestApi/rest",
      );
      const url = `${apiBaseUrl}/configuration/export`;

      // Build the reuest body
      const body: Record<string, unknown> = {
        entityQNames: [entityType],
      };

      if (filterField && filterValue) {
        body.criteria = {
          filters: [
            {
              "@type": "TextValueFilter",
              id: filterField,
              comparisonOperator: comparisonOperator || "EQUALS",
              supportValues: [{ value: filterValue }],
            },
          ],
        };
      }

      const endHttpTimer = DebugLogger.time("HTTP", "fetch_estate_config request", {
        url,
        body,
      });

      // Make the Request
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/typed+json",
          Accept: "application/octet-stream",
          "x-enactor-connection-process-id": "RetailProcessServer",
          "x-enactor-connection-point-id": "RetailServerJobResults",
          "x-enactor-runtime-context": "Enactor Web Retail Processing",
          Authorization: this.estateAuth,
        },
        body: JSON.stringify(body),
      });

      endHttpTimer({
        status: response.status,
      });

      // Handle 204 No Content
      if (response.status === 204) {
        const filterInfo = filterField
          ? ` matching ${filterField} = '${filterValue}'`
          : "";
        return `No ${entityType} found${filterInfo}. The entity may not exist in Estate Manager.`;
      }

      // Handle other errors
      if (!response.ok) {
        const responseText = await response.text();
        return `API Error (${response.status}): ${responseText}`;
      }

      // Read the ZIP response
      const arrayBuffer = await response.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      // Filter for XML files only
      const xmlEntries = entries.filter(
        (entry) => !entry.isDirectory && entry.entryName.endsWith(".xml"),
      );

      if (xmlEntries.length === 0) {
        return `The export returned a ZIP but it contained no XML files.`;
      }

      // Safety cap - don't dump too many XMLs into context
      if (xmlEntries.length > 5 && !summaryOnly) {
        const fileList = xmlEntries.map((e) => e.entryName).join("\n  - ");
        return `Found ${xmlEntries.length} ${entityType} entities. Too many to return at once. Please narrow your filter, or use summaryOnly: true to fetch a compact list.\n\nFiles found:\n  - ${fileList}`;
      }

      // Extract and Return XML content
      if (summaryOnly) {
        // Compact mode — no safety cap needed since output is small
        const summaries = xmlEntries.map((entry, i) => {
          const xml = entry.getData().toString("utf-8");
          const summary = this.extractSummary(xml);
          return `[${i + 1}]\n${summary}`;
        });
        return summaries.join("\n\n");
      }
      // Full mode — existing logic with safety cap
      const results = xmlEntries.map((entry) => {
        const content = entry.getData().toString("utf-8");
        return content;
      });

      if (results.length === 1) {
        return results[0];
      }

      // Multiple results - seperate them clearly
      return results
        .map((xml, i) => `--- File ${i + 1} of ${results.length} ---\n${xml}`)
        .join("\n\n");
    } catch (error) {
      DebugLogger.log("ERROR", "fetch_estate_config failed", {
        error: (error as Error).message,
      });
      return `Network Error: ${(error as Error).message}`;
    }
  }

  private extractSummary(xml: string): string {
    const lines: string[] = [];
    // Match all simple <retail:tagName>value</retail:tagName> pairs
    const tagRegex = /<retail:(\w+)>([^<]+)<\/retail:\1>/g;
    let match;

    while ((match = tagRegex.exec(xml)) !== null) {
      const [, tagName, value] = match;
      const trimmed = value.trim();
      // Skip tags with very long content (like keysFile, certificate data)
      if (trimmed.length > 200) continue;
      // Skip boolean/numeric noise like "false", "0"
      if (["false", "true", "0"].includes(trimmed)) continue;
      lines.push(`  ${tagName}: ${trimmed}`);
    }
    return lines.join("\n");
  }
}
