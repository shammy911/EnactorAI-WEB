import fs from "fs";
import { LocalTool, ToolContext } from "./LocalTool";
import { ToolDefinition } from "../ModelClient";
import { TemplateResolver } from "../TemplateResolver";

export class SkillTool implements LocalTool {
  constructor(
    private skills: { name: string; bodyPath: string }[],
    private templateResolver: TemplateResolver,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: "use_skill",
        description:
          "Loads the detailed instructions and workflow for a specific skill.",
        parameters: {
          type: "object",
          properties: {
            skillName: {
              type: "string",
              description:
                "The exact name of the skill to load (e.g. 'entity-creation')",
            },
          },
          required: ["skillName"],
        },
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<string> {
    const skillName = args.skillName as string;
    if (!skillName) return "Error: skillName argument is required.";

    const skill = this.skills.find((s) => s.name === skillName);
    if (!skill) return `Error: Skill '${skillName}' is not found.`;

    // ── 1. Load the skill body (generic rules) ──────────────────────────────
    let skillBody: string;
    try {
      skillBody = fs.readFileSync(skill.bodyPath, "utf-8");
      // Strip YAML frontmatter (--- ... ---)
      skillBody = skillBody.replace(/---\n[\s\S]*?\n---/, "").trim();
    } catch (error) {
      return `Failed to read skill file: ${(error as Error).message}`;
    }

    // ── 2. Load entity-specific references and append them ──────────────────
    // References (e.g. references/patterns.md) contain entity-specific
    // instructions and template locations. They are kept separate from the
    // generic skill body so each concern can evolve independently.
    let referencesContent: string = "";
    try {
      referencesContent = await this.templateResolver.loadReferences(skillName);
    } catch (error) {
      // Non-fatal: if no references folder exists, continue with skill body only.
      // This keeps SkillTool working for simple skills that have no references.
    }

    if (!referencesContent) return skillBody;

    return [skillBody, "---", "## Entity References", referencesContent].join(
      "\n\n",
    );
  }
}
