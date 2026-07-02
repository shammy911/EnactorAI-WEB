import fs from "fs/promises";
import path from "path";
import { TemplateResolver } from "@enactor-estate/core";

/**
 * File-system implementation of TemplateResolver.
 *
 * Directory conventions:
 *
 *   Templates (entity XML structures):
 *     <skillsDir>/templates/<entityName>/pattern.md
 *     e.g. src/skills/templates/pos-terminal/pattern.md
 *
 *   References (entity-specific instructions, per skill):
 *     <skillsDir>/<skillName>/references/<file>.md
 *     e.g. src/skills/entity-creation/references/patterns.md
 *
 * ── Migration note ──────────────────────────────────────────────────────────
 * When moving to a database, implement DatabaseTemplateResolver with the same
 * TemplateResolver interface and inject it in SessionManager instead.
 * No other files (SkillTool, SKILL.md, patterns.md) need to change.
 */

export class FileTemplateResolver implements TemplateResolver {
  constructor(private readonly skillsDir: string) {}

  /**
   * Loads the XML template for a given entity type.
   *
   * Path: <skillsDir>/templates/<entityName>/pattern.md
   *
   * Note: skillName is no longer part of this path. Templates are shared
   * across all skills and live at the skills root — not inside any one skill.
   * When migrating to a DB, entityName becomes the primary key.
   */
  async resolve(entityName: string): Promise<string> {
    const templatePath = path.join(
      this.skillsDir,
      "templates",
      entityName,
      "pattern.md",
    );

    try {
      return await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      throw new Error(
        `Template not found for entity '${entityName}'. ` +
          `Expected file at: ${templatePath}`,
      );
    }
  }

  /**
   * Loads all reference files from a skill's references/ subfolder
   * and returns their combined content.
   *
   * Path: <skillsDir>/<skillName>/references/*.md
   *
   * Files are sorted alphabetically for deterministic ordering.
   * Returns an empty string if the references/ folder doesn't exist —
   * this is intentional so skills without references work without errors.
   */
  async loadReferences(skillName: string): Promise<string> {
    const referencesDir = path.join(this.skillsDir, skillName, "references");

    let files: string[];
    try {
      const entries = await fs.readdir(referencesDir);
      files = entries.filter((f) => f.endsWith(".md")).sort(); // deterministic ordering
    } catch (error) {
      // references/ folder doesn't exist — not an error, just no references
      return "";
    }

    if (files.length === 0) return "";

    const contents = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(referencesDir, file);
        return await fs.readFile(filePath, "utf-8");
      }),
    );

    return contents.join("\n\n");
  }
}
