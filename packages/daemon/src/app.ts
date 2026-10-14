import { Hono } from "hono";
import type { Db } from "core";
import {
  hostAndOrigin,
  requireToken,
  type SecurityOptions,
} from "./security.js";
import { projectRoutes } from "./routes/projects.js";

export function createApp(db: Db, security: SecurityOptions) {
  return new Hono()
    .use("*", hostAndOrigin(security))
    .use("/api/*", requireToken(security))
    .get("/api/health", (c) => c.json({ ok: true }))
    .route("/api/projects", projectRoutes(db))
    .notFound((c) => c.json({ error: "not found" }, 404));
}

export type AppType = ReturnType<typeof createApp>;
