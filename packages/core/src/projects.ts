import { desc, eq } from "drizzle-orm";
import type { Db } from "./db/index.js";
import type { CreateProjectInput, Project, UpdateProjectInput } from "shared";
import { project } from "./db/schema.js";
import { isoNow } from "./ids.js";

export async function createProject(
  db: Db,
  input: CreateProjectInput,
): Promise<Project> {
  const now = isoNow();
  const [row] = await db
    .insert(project)
    .values({
      title: input.title,
      statement: input.statement ?? "",
      dir: input.dir ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row!;
}

export function listProjects(db: Db): Promise<Project[]> {
  return db.select().from(project).orderBy(desc(project.updatedAt));
}

export async function deleteProject(
  db: Db,
  projectId: string,
): Promise<Project> {
  const [row] = await db
    .delete(project)
    .where(eq(project.id, projectId))
    .returning();

  return row!;
}

export async function getProject(db: Db, projectId: string): Promise<Project> {
  const [row] = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId));

  return row!;
}

export async function updateProject(
  db: Db,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const [row] = await db
    .update(project)
    .set({
      title: input.title,
      statement: input.statement,
      dir: input.dir,
      updatedAt: isoNow(),
    })
    .where(eq(project.id, projectId))
    .returning();

  return row!;
}
