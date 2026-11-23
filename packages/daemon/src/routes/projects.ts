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
import { exportProject } from "../export.js";

/** ASCII fallback plus the UTF-8 name (RFC 6266), so non-Latin titles survive. */
function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function projectRoutes(db: Db, workspaceDir: string) {
  return new Hono()
    .get("/", async (c) => c.json(await listProjects(db)))
    .get("/:id", async (c) => {
      const project = await getProject(db, c.req.param("id"));

      if (!project) {
        return c.json({ error: "project not found" }, 404);
      }

      return c.json(project, 200);
    })
    .get("/:id/export", async (c) => {
      const archive = await exportProject(db, c.req.param("id"), workspaceDir);

      if (!archive) {
        return c.json({ error: "project not found" }, 404);
      }

      return c.body(archive.bytes, 200, {
        "content-type": "application/zip",
        "content-disposition": contentDisposition(archive.fileName),
        "cache-control": "no-store",
      });
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
