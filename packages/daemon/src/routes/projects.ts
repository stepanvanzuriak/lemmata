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
import { join } from "node:path";
import { exportProject } from "../export.js";
import { ImportError, importProject } from "../import.js";
import { resolvePath } from "./fs.js";

/** ASCII fallback plus the UTF-8 name (RFC 6266), so non-Latin titles survive. */
function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function projectRoutes(db: Db, workspaceDir: string) {
  return (
    new Hono()
      .get("/", async (c) => c.json(await listProjects(db)))
      .get("/:id", async (c) => {
        const project = await getProject(db, c.req.param("id"));

        if (!project) {
          return c.json({ error: "project not found" }, 404);
        }

        return c.json(project, 200);
      })
      .get("/:id/export", async (c) => {
        const archive = await exportProject(
          db,
          c.req.param("id"),
          workspaceDir,
        );

        if (!archive) {
          return c.json({ error: "project not found" }, 404);
        }

        return c.body(archive.stream, 200, {
          "content-type": "application/zip",
          "content-disposition": contentDisposition(archive.fileName),
          "cache-control": "no-store",
        });
      })
      // The archive is the raw request body; `parent` and `name` give the folder to create for it.
      .post("/import", async (c) => {
        const name = c.req.query("name")?.trim() ?? "";
        const body = c.req.raw.body;

        if (!name || /[/\\]/.test(name) || name === "." || name === "..") {
          return c.json(
            { error: "folder name is required, without slashes" },
            400,
          );
        }

        if (!body) {
          return c.json({ error: "no .lemmata file was sent" }, 400);
        }

        try {
          const project = await importProject(db, body, {
            dir: join(resolvePath(c.req.query("parent")), name),
            workspaceDir,
          });

          return c.json(project, 201);
        } catch (error) {
          if (error instanceof ImportError) {
            return c.json({ error: error.message }, 400);
          }

          throw error;
        }
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
      })
  );
}
