import { DebugLogger } from "../DebugLogger";
import { ToolDefinition } from "../ModelClient";
import { LocalTool, ToolContext } from "./LocalTool";

export class CheckDeviceTool implements LocalTool {
  constructor(
    private estateUrl: string,
    private estateAuth?: string | null,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "check_device",
        description:
          "Checks if a device exists in Estate Manager by its device ID. " +
          "Returns device details if found, or a 'not found' message if the device doesn't exist. " +
          "Use this BEFORE creating a POS terminal to verify the device is available.",
        parameters: {
          type: "object",
          properties: {
            deviceId: {
              type: "string",
              description:
                "The device ID to check (e.g. 'aut.MPOS1@0001.enactor')",
            },
          },
          required: ["deviceId"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    if (!this.estateAuth) {
      return "Error: Missing Estate Manager credentials. Please inform the user that they need to click 'Connect Estate Manager' in the top right header to provide their credentials before you can perform this action.";
    }

    const deviceId = args.deviceId as string;
    // Build URL: estateUrl → swap /WebMaintenance → /WebRestApi/rest
    const apiBaseUrl = this.estateUrl.replace(
      /\/WebMaintenance\/?$/i,
      "/WebRestApi/rest",
    );
    const url = `${apiBaseUrl}/devices/${encodeURIComponent(deviceId)}`;

    try {
      const endHttpTimer = DebugLogger.time("HTTP", "check_device request", {
        url,
        deviceId,
      });
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/xml, application/json",
          "x-enactor-connection-process-id": "RetailProcessServer",
          "x-enactor-connection-point-id": "RetailServerJobResults",
          "x-enactor-runtime-context": "Enactor Web Retail Processing",
          Authorization: this.estateAuth,
        },
      });

      if (response.status === 404) {
        endHttpTimer({
          deviceId,
          status: response.status,
          message: "Device not found",
        });
        return `Device '${deviceId}' was NOT found in Estate Manager. It needs to be created before a terminal can use it.`;
      }

      if (!response.ok) {
        endHttpTimer({
          deviceId,
          status: response.status,
          message: "API Error",
        });
        return `API Error (${response.status}): ${await response.text()}`;
      }

      const data = await response.text();
      endHttpTimer({
        deviceId,
        status: response.status,
        data: data.slice(0, 500),
      });
      return `Device '${deviceId}' EXISTS in Estate Manager. Details:\n${data}`;
    } catch (err) {
      DebugLogger.log("ERROR", "check_device failed", {
        error: (err as Error).message,
      });
      return `Network Error checking device: ${(err as Error).message}`;
    }
  }
}
