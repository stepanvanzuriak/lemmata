import { Hono } from "hono";
import {
  addMemory,
  deleteMemory,
  getProject,
  listMemory,
  MEMORY_KINDS,
  updateMemory,
  type Db,
} from "core";
import { z } from "zod";
import { validate } from "../validate.js";

const kind = z.enum(MEMORY_KINDS);
const text = z.string().trim().min(1, "text is required");

const addSchema = z.object({ kind, text });
const updateSchema = z.object({
  kind: kind.optional(),
  text: text.optional(),
  pinned: z.boolean().optional(),
});
const querySchema = z.object({
  projectId: z.string().optional(),
  kind: kind.optional(),
});

const DUPLICATE = "this project already has that entry";

function isDuplicate(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("UNIQUE constraint failed") ||
    isDuplicate(error.cause)
  );
}

export function memoryRoutes(db: Db) {
  return new Hono()
    .get("/memory", validate("query", querySchema), async (c) =>
      c.json(await listMemory(db, c.req.valid("query"))),
    )
    .post("/projects/:id/memory", validate("json", addSchema), async (c) => {
      const projectId = c.req.param("id");

      if (!(await getProject(db, projectId))) {
        return c.json({ error: "project not found" }, 404);
      }

      const [entry] = await addMemory(db, projectId, [c.req.valid("json")]);

      if (!entry) {
        return c.json({ error: DUPLICATE }, 409);
      }

      return c.json(entry, 201);
    })
    .patch("/memory/:id", validate("json", updateSchema), async (c) => {
      let entry;

      try {
        entry = await updateMemory(db, c.req.param("id"), c.req.valid("json"));
      } catch (error) {
        if (isDuplicate(error)) {
          return c.json({ error: DUPLICATE }, 409);
        }
        throw error;
      }

      if (!entry) {
        return c.json({ error: "memory entry not found" }, 404);
      }

      return c.json(entry, 200);
    })
    .delete("/memory/:id", async (c) => {
      if (!(await deleteMemory(db, c.req.param("id")))) {
        return c.json({ error: "memory entry not found" }, 404);
      }

      return c.body(null, 204);
    });
}
