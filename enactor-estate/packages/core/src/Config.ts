import Conf from "conf";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { join } from "path";
import { fileURLToPath, resolve } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PKG_ROOT = resolve(__dirname, "../.."); // packages/cli/

// Check CWD first (installed user), then package root (developer)
const envPaths = [
  join(process.cwd(), ".env.local"),
  join(PKG_ROOT, ".env.local"),
  join(process.cwd(), ".env"),
  join(PKG_ROOT, ".env"),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// Load .env.local if it exists, otherwise fallback to .env
// if (fs.existsSync(".env.local")) {
//   dotenv.config({ path: ".env.local" });
// } else {
//   dotenv.config();
// }

export type Theme = "dark" | "light" | "high-contrast";

export interface AppConfig {
  theme: Theme;
  trusted: boolean;
  model: {
    url: string;
    name: string;
    api_key: string;
    temperature: number;
    max_tokens: number;
    enable_thinking: boolean;
  };
  mcp: {
    enabled: boolean;
    server_command: string;
    server_args: string[];
  };
}

const DEFAULT_CONFIG: AppConfig = {
  theme: "dark",
  trusted: false,
  model: {
    url: "",
    name: "",
    api_key: "",
    temperature: 0.3,
    max_tokens: 60000,
    enable_thinking: false,
  },
  mcp: {
    enabled: false,
    server_command: "node",
    server_args: [],
  },
};

const store = new Conf<AppConfig>({
  projectName: "enactor-cli",
  defaults: DEFAULT_CONFIG,
});

export const Config = {
  get: (): AppConfig => {
    const config = store.store;
    // Always let environment variables override cached config values
    return {
      ...config,
      model: {
        ...config.model,
        url:
          process.env.ENACTOR_LLM_API_URL ||
          process.env.CUSTOM_LLM_API_URL ||
          config.model?.url,
        name:
          process.env.ENACTOR_LLM_NAME ||
          process.env.CUSTOM_LLM_MODEL ||
          config.model?.name,
        api_key:
          process.env.ENACTOR_LLM_API_KEY ||
          process.env.CUSTOM_LLM_API_KEY ||
          config.model?.api_key,
      },
    };
  },
  set: (values: Partial<AppConfig>): void => {
    Object.entries(values).forEach(([key, val]) => {
      store.set(key, val);
    });
  },
  path: (): string => store.path,
  isFirstRun: (): boolean => !store.has("theme"),
  isConfigured: (): boolean => {
    const model = Config.get().model;
    return !!(model?.url && model?.name);
  },
  getModel: (): AppConfig["model"] => {
    const model = Config.get().model; // reuses get() including env vars
    return {
      ...DEFAULT_CONFIG.model, // fills any missing fields
      ...model, // get() result overrides defaults
    };
  },
};
