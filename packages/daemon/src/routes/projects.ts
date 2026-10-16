import { Hono } from "hono";
import { createProject, listProjects, deleteProject, type Db } from "core";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

export function projectRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listProjects(db)))
    .post("/", async (c) => {
      const body: unknown = await c.req.json().catch(() => null);
      const raw =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {};
      const title = str(raw.title);

      if (!title) {
        return c.json({ error: "title is required" }, 400);
      }

      const project = await createProject(db, {
        title,
        statement: str(raw.statement),
        dir: str(raw.dir) || null,
      });

      return c.json(project, 201);
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id");

      const project = await deleteProject(db, id);

      return c.json(project, 200);
    });
}
