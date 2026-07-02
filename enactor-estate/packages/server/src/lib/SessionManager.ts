import {
  ConversationEngine,
  OpenAICompatibleClient,
  DebugLogger,
  ToolRegistry,
  PermissionManager,
  SkillTool,
  ImportEstateConfigTool,
  CheckDeviceTool,
  GetTemplateTool,
  ImportEstateConfigZipTool,
  FetchEstateConfigTool,
} from "@enactor-estate/core";
import { SkillManager } from "./SkillManager";
import { FileTemplateResolver } from "@/FileTemplateResolver";
import path from "path";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionData {
  engine: ConversationEngine;
  lastActivity: number;
  emUrl: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

// ── Singleton SessionManager ───────────────────────────────────────────────────

class SessionManagerImpl {
  private sessions = new Map<string, SessionData>();
  private skillManager = new SkillManager();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Get an existing session or create a new one.
   * Every call refreshes the session's lastActivity timestamp.
   */
  getOrCreateSession(sessionId: string): SessionData {
    let session = this.sessions.get(sessionId);

    if (!session) {
      DebugLogger.log(
        "SERVER",
        `Creating new session: ${sessionId.slice(0, 8)}...`,
      );
      const engine = this.createEngine(sessionId);
      session = {
        engine,
        lastActivity: Date.now(),
        emUrl: "",
      };
      this.sessions.set(sessionId, session);
    }

    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Register tools for a session's engine.
   * Called before each chat request.
   */
  prepareEngineForChat(
    sessionId: string,
    emAuth?: string | null,
    emUrl?: string | null,
  ): ConversationEngine {
    const session = this.getOrCreateSession(sessionId);
    const { engine } = session;

    if (!emUrl) {
      throw new Error(
        "⛔ No Estate Manager URL configured. Please set your target " +
          "Estate Manager URL by clicking the 'Connect Estate Manager' button before making requests.",
      );
    }
    const estateUrl = emUrl;

    session.emUrl = estateUrl; // Update session with the latest URL

    // Re-register tools
    const toolRegistry = new ToolRegistry({ cwd: process.cwd() });
    const skills = this.skillManager.getAvailableSkills();

    if (skills.length > 0) {
      const skillsDir = path.join(process.cwd(), "src", "skills");
      const templateResolver = new FileTemplateResolver(skillsDir);
      toolRegistry.register(new SkillTool(skills, templateResolver));
      toolRegistry.register(new GetTemplateTool(templateResolver));
    }

    toolRegistry.register(new ImportEstateConfigTool(estateUrl, emAuth));
    toolRegistry.register(new CheckDeviceTool(estateUrl, emAuth));
    toolRegistry.register(new ImportEstateConfigZipTool(estateUrl, emAuth));
    toolRegistry.register(new FetchEstateConfigTool(estateUrl, emAuth));

    engine.registerTools(toolRegistry.getDefinitions(), (name, args) => {
      return toolRegistry.execute(name, args);
    });

    DebugLogger.log(
      "SERVER",
      `Engine prepared for session: ${sessionId.slice(0, 8)}...`,
      {
        tools: toolRegistry.getDefinitions().length,
      },
    );

    return engine;
  }

  /**
   * Reset conversation history for a session.
   */
  resetSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.engine.reset();
      DebugLogger.log("SERVER", `Session reset: ${sessionId.slice(0, 8)}...`);
    }
  }

  /**
   * Remove stale sessions that haven't been active for SESSION_TTL_MS.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      DebugLogger.log(
        "SERVER",
        `Session cleanup: removed ${cleaned} stale session(s)`,
        {
          remaining: this.sessions.size,
        },
      );
    }
  }

  /**
   * Create a new ConversationEngine with the LLM client and system prompt configured.
   */
  private createEngine(sessionId: string): ConversationEngine {
    const llmUrl =
      process.env.LLM_URL || "http://10.1.10.36:8090/v1/chat/completions";
    const llmModel = process.env.LLM_MODEL || "Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf";

    const client = new OpenAICompatibleClient({
      url: llmUrl,
      name: llmModel,
      api_key: "",
    });

    const engine = new ConversationEngine(client);
    const skillManager = this.skillManager;
    const sessions = this.sessions;

    engine.setSystemPromptProvider(() => {
      const skills = skillManager.getAvailableSkills();
      const skillList = skills
        .map((s) => `- ${s.name}: ${s.description}`)
        .join("\n");

      const currentEstateUrl =
        sessions.get(sessionId)?.emUrl || "No Estate Manager URL Configured";
      return `You are EnactorAI, an intelligent assistant for managing Enactor Estate Manager configurations.
      
<system-reminder>
Available skills (invoke via the use_skill tool by name):
${skillList}

Target Estate Manager URL: ${currentEstateUrl}
</system-reminder>

<behavioral-rules>
1. When a user asks you to generate an XML configuration, ALWAYS print it out in a markdown code block first so they can review it. 
2. NEVER automatically import or deploy a configuration without the user's explicit permission. You MUST require the user to explicitly type the keyword "APPLY" to approve any deployments or imports.
3. Be concise and never repeat yourself in a single message. Combine multiple tool findings into one single summary.
4. Do not duplicate lists of options in the same response, and stop to wait for the user's selection after presenting options.
5. At the end of any task completion, you MUST provide a final summary of what changes were made and explicitly state the Target Environment URL where they were applied.
</behavioral-rules>

Current time: ${new Date().toISOString()}`;
    });

    return engine;
  }

  /** For debugging: get total active sessions */
  get size(): number {
    return this.sessions.size;
  }
}

/** Global singleton — survives across API route invocations */
export const SessionManager = new SessionManagerImpl();
