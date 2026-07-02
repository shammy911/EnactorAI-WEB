import fs from "fs";
import path from "path";

export interface SkillMeta {
  name: string;
  description: string;
  bodyPath: string;
}

export class SkillManager {
  private skillsDir = path.join(process.cwd(), "src", "skills");

  public getAvailableSkills(): SkillMeta[] {
    const skills: SkillMeta[] = [];
    if (!fs.existsSync(this.skillsDir)) return skills;

    const folders = fs.readdirSync(this.skillsDir);
    for (const folder of folders) {
      const skillPath = path.join(this.skillsDir, folder, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        const match = content.match(/---\n([\s\S]*?)\n---/);

        let name = folder;
        let description = "No description provided.";

        if (match) {
          const frontmatter = match[1];
          const nameMatch = frontmatter.match(/name:\s*(.+)/);
          const descMatch = frontmatter.match(/description:\s*(.+)/);
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
        skills.push({ name, description, bodyPath: skillPath });
      }
    }
    return skills;
  }
}
