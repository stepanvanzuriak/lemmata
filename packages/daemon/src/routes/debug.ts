import { Hono } from "hono";
import { z } from "zod";
import { listAttempts, listAttemptEvents, type Db } from "core";
import { validate } from "../validate.js";

const page = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Registered only by a daemon running in development mode. */
export function debugRoutes(db: Db) {
  return new Hono()
    .get("/canvases/:canvasId/attempts", async (c) => {
      const canvasId = c.req.param("canvasId");
      if (!(await db.query.canvas.findFirst({ where: { id: canvasId } }))) {
        return c.json({ error: "canvas not found" }, 404);
      }
      return c.json(await listAttempts(db, { canvasId }));
    })
    .get(
      "/canvases/:canvasId/attempts/:attemptId/events",
      validate("query", page),
      async (c) => {
        const attemptId = c.req.param("attemptId");
        const attempt = await db.query.attempt.findFirst({
          where: { id: attemptId, canvasId: c.req.param("canvasId") },
        });
        if (!attempt) {
          return c.json({ error: "attempt not found" }, 404);
        }
        const { after, limit } = c.req.valid("query");
        const rows = await listAttemptEvents(db, attemptId, after, limit + 1);
        const events = rows.slice(0, limit);
        return c.json({
          events,
          nextCursor: rows.length > limit ? events.at(-1)!.id : null,
        });
      },
    );
}
