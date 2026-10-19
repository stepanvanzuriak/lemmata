import { Hono } from "hono";
import { mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { FsEntry, FsListResponse } from "shared";
import { validate } from "../validate.js";

const mkdirSchema = z.object({
  path: z.string().trim().min(1, "path is required"),
});

function resolvePath(input: string | undefined) {
  const raw = input?.trim();

  if (!raw || raw === "~") {
    return homedir();
  }

  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : resolve(raw);
}

export function fsRoutes() {
  return new Hono()
    .get("/", async (c) => {
      const path = resolvePath(c.req.query("path"));

      try {
        const entries: FsEntry[] = (
          await readdir(path, { withFileTypes: true })
        )
          .filter((e) => e.isDirectory() && !e.name.startsWith("."))
          .map((e) => ({ name: e.name, path: join(path, e.name) }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const parent = dirname(path);
        const body: FsListResponse = {
          path,
          parent: parent === path ? null : parent,
          entries,
        };

        return c.json(body, 200);
      } catch {
        return c.json({ error: `cannot read folder: ${path}` }, 400);
      }
    })
    .post("/mkdir", validate("json", mkdirSchema), async (c) => {
      const path = resolvePath(c.req.valid("json").path);

      try {
        if (!(await stat(dirname(path))).isDirectory()) {
          throw new Error("parent is not a folder");
        }

        await mkdir(path);
      } catch {
        return c.json({ error: `cannot create folder: ${path}` }, 400);
      }

      const entry: FsEntry = { name: basename(path), path };

      return c.json(entry, 201);
    });
}
