import { desc, or, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { project, type Project } from "./db/schema.js";

const LIMIT = 20;

export function searchProjects(db: Db, q: string): Promise<Project[]> {
  const escaped = q
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  return db
    .select()
    .from(project)
    .where(
      or(
        sql`lower(${project.title}) like ${pattern} escape '\\'`,
        sql`lower(${project.statement}) like ${pattern} escape '\\'`,
      ),
    )
    .orderBy(desc(project.updatedAt))
    .limit(LIMIT);
}
