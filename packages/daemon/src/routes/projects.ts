import { Hono } from "hono";
import {
  createProject,
  createProjectSchema,
  listProjects,
  deleteProject,
  getProject,
  type Db,
} from "core";
import { validate } from "../validate.js";

export function projectRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listProjects(db)))
    .get("/:id", async (c) => {
      const project = await getProject(db, c.req.param("id"));

      if (!project) {
        return c.json({ error: "project not found" }, 404);
      }

      return c.json(project, 200);
    })
    .post("/", validate("json", createProjectSchema), async (c) => {
      const project = await createProject(db, c.req.valid("json"));

      return c.json(project, 201);
    })
    .delete("/:id", async (c) => {
      const project = await deleteProject(db, c.req.param("id"));

      if (!project) {
        return c.json({ error: "project not found" }, 404);
      }

      return c.json(project, 200);
    });
}
