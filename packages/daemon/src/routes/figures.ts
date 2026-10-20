import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import type { Db } from "core";
import { figuresDir } from "../runCard.js";

const FIGURE_NAME = /^fig-\d+(-views)?\.png$/;

export function figureRoutes({
  db,
  workspaceDir,
}: {
  db: Db;
  workspaceDir: string;
}) {
  return new Hono().get("/nodes/:id/figures/:name", async (c) => {
    const id = c.req.param("id");
    const name = c.req.param("name");

    if (!FIGURE_NAME.test(name)) {
      return c.json({ error: "bad figure name" }, 400);
    }

    const node = await db.query.canvasNode.findFirst({ where: { id } });
    const bytes = node
      ? await readFile(join(figuresDir(workspaceDir, id), name)).catch(
          () => null,
        )
      : null;

    if (!bytes) {
      return c.json({ error: "figure not found" }, 404);
    }

    return c.body(new Uint8Array(bytes), 200, {
      "content-type": "image/png",
      "cache-control": "no-cache",
    });
  });
}
