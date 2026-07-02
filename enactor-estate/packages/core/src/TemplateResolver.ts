/**
 * Abstraction for loading skill-related content — XML templates and
 * entity-specific reference files.
 *
 * Today this is implemented by FileTemplateResolver (reads from disk).
 * When templates are moved to a database, a DatabaseTemplateResolver
 * can be swapped in without changing SkillTool or any skill/template files.
 *
 * This is the migration seam — the only thing that changes when you
 * switch storage backends is which implementation gets injected into
 * SessionManager.
 */

export interface TemplateResolver {
  /**
   * Resolve an XML template by entity name.
   *
   * @param entityName - The logical entity type (e.g. "pos-terminal", "device").
   *                     Maps to a folder on disk, or a primary key in a DB.
   * @returns The raw template content (XML string).
   * @throws If the template cannot be found or loaded.
   */
  resolve(entityName: string): Promise<string>;

  /**
   * Load all reference content for a given skill.
   *
   * References are entity-specific instruction files that live inside the
   * skill's own folder (e.g. entity-creation/references/patterns.md).
   * They are appended to the skill body by SkillTool before returning
   * content to the LLM.
   *
   * @param skillName - The skill whose references/ subfolder to read
   *                    (e.g. "entity-creation").
   * @returns The combined content of all reference files, or an empty
   *          string if none exist.
   */
  loadReferences(skillName: string): Promise<string>;
}
