import { Hono } from "hono";
import {
  type Db,
  createProject,
  createProjectSchema,
  listProjects,
  deleteProject,
  getProject,
  updateProjectSchema,
  updateProject,
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
    .patch("/:id", validate("json", updateProjectSchema), async (c) => {
      const project = await updateProject(
        db,
        c.req.param("id"),
        c.req.valid("json"),
      );

      return c.json(project, 200);
    })
    .delete("/:id", async (c) => {
      const project = await deleteProject(db, c.req.param("id"));

      if (!project) {
        return c.json({ error: "project not found" }, 404);
      }

      return c.json(project, 200);
    });
}
